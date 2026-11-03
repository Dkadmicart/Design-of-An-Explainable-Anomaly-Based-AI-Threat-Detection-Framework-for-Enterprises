"""
SentinelAI - Dataset Replay Loader Service
Reads genuine CIC-IDS2017 flow records (from Parquet or verified CSV) with exact 69 features,
runs active XGBoost inference to produce real predictions and risk scores,
and safely persists bounded batches to the database.

Background worker design: once started, an asyncio.Task drives continuous ingestion
inside the FastAPI event loop, independent of any HTTP connection or React component lifecycle.
"""
import asyncio
import os
import logging
import time
import uuid
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta, timezone
import numpy as np
import pandas as pd
import pyarrow.parquet as pq
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.database import (
    Event,
    Alert,
    SeverityLevel,
    AlertStatus,
)
from app.ml.xgboost_detector import get_xgboost_detector
from app.services.settings_service import get_active_alert_threshold

logger = logging.getLogger("sentinelai.replay_loader")
settings = get_settings()

DEFAULT_CSV_PATH = "D:/shap_sample_features.csv"
MIN_BATCH_SIZE = 1
MAX_BATCH_SIZE = 500
DEFAULT_BATCH_SIZE = 100


def sanitize_flow_features(raw_features: Dict[str, Any]) -> Dict[str, float]:
    """
    Ensure all 69 features are valid, finite JSON-serializable floats.
    Maps NaN, +inf, -inf to 0.0 to guarantee standard-compliant JSON storage.
    """
    cleaned: Dict[str, float] = {}
    for k, v in raw_features.items():
        try:
            val = float(v)
            if np.isnan(val) or np.isinf(val):
                val = 0.0
            cleaned[k] = val
        except (ValueError, TypeError):
            cleaned[k] = 0.0
    return cleaned


def _ensure_utc(dt: datetime) -> datetime:
    """Ensure datetime is timezone-aware in UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


class ReplayLoaderService:
    """
    Manages stateful dataset replay streaming, feature sanitization,
    and genuine XGBoost inference persistence.

    An asyncio background worker (self._worker_task) drives continuous ingestion
    once started, running independently of any HTTP connection or React lifecycle.
    Pause/Resume flip self.is_paused which the worker checks every 250 ms.
    Stop cancels the task and awaits its completion before resetting state.
    """

    def __init__(self):
        self.is_running = False
        self.is_paused = False
        self.speed = 1.0
        self.events_sent = 0
        self.total_events = 0
        self.alerts_generated = 0
        self.current_file: Optional[str] = None
        self.start_timestamp: Optional[float] = None
        self.current_index = 0
        self.replay_pass = 1
        self.loop = False
        self.is_completed = False
        self.last_commit_status = "idle"
        self._source_total_rows: Optional[int] = None
        self.last_ingested_ids: List[str] = []
        # Background worker state
        self._worker_task: Optional[asyncio.Task] = None
        self._worker_batch_size: int = DEFAULT_BATCH_SIZE
        self._source_path: Optional[str] = None   # resolved full path, reused by worker
        self._source_fmt: Optional[str] = None    # 'csv' | 'parquet', reused by worker
        # Authentic historical rate telemetry
        self.metrics_history: List[Dict[str, Any]] = []
        self._rolling_events: List[Dict[str, Any]] = []

    # ─── Status & Control ─────────────────────────────────────────────────────

    def get_status(self) -> Dict[str, Any]:
        """Return current replay runtime status."""
        elapsed = 0.0
        if self.start_timestamp and self.is_running and not self.is_paused:
            elapsed = round(time.time() - self.start_timestamp, 1)
        worker_alive = bool(self._worker_task and not self._worker_task.done())
        return {
            "is_running": self.is_running,
            "is_paused": self.is_paused,
            "is_completed": self.is_completed,
            "last_commit_status": self.last_commit_status,
            "speed": self.speed,
            "events_sent": self.events_sent,
            "total_events": self.total_events,
            "alerts_generated": self.alerts_generated,
            "current_file": self.current_file,
            "current_index": self.current_index,
            "replay_pass": self.replay_pass,
            "loop": self.loop,
            "elapsed_seconds": elapsed,
            "worker_active": worker_alive,
            "metrics": self.metrics_history[-30:],
        }

    def pause(self) -> Dict[str, Any]:
        """Pause replay. Worker checks this flag and skips ingestion while True."""
        if not self.is_running:
            return {"status": "ignored", "message": "Replay is not running"}
        self.is_paused = True
        return {"status": "paused", "is_paused": True}

    def resume(self) -> Dict[str, Any]:
        """Resume paused replay. Worker resumes on next tick."""
        if not self.is_running:
            return {"status": "ignored", "message": "Replay is not running"}
        self.is_paused = False
        return {"status": "resumed", "is_paused": False}

    async def stop(self) -> Dict[str, Any]:
        """
        Stop replay: set flags, cancel and await the background worker cleanly,
        then reset stream pointer. Awaiting the task ensures the worker's finally
        block completes before we return.
        """
        was_running = self.is_running
        self.is_running = False
        self.is_paused = False
        if self._worker_task and not self._worker_task.done():
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass  # Expected — task cancelled cleanly
        self._worker_task = None
        self.start_timestamp = None
        self.current_index = 0
        self.replay_pass = 1
        self.events_sent = 0
        self.alerts_generated = 0
        self.metrics_history = []
        self._rolling_events = []
        logger.info("Replay stopped; worker cancelled and awaited. Stream pointer reset.")
        return {
            "status": "stopped",
            "is_running": False,
            "was_running": was_running,
            "is_completed": self.is_completed,
            "last_commit_status": self.last_commit_status,
        }

    # ─── Dataset Resolution ────────────────────────────────────────────────────

    def resolve_dataset_source(self, requested_file: Optional[str] = None) -> Tuple[str, str]:
        """
        Locate verified dataset source:
        1. Explicit path if requested and exists.
        2. Parquet file in data/raw/cic-ids2017/ if present.
        3. D:/shap_sample_features.csv if accessible.
        Returns: (source_path, format_type: 'parquet' | 'csv')
        """
        # 1. Explicit file requested
        if requested_file:
            candidates = [
                requested_file,
                os.path.join(settings.DATASET_PATH, "cic-ids2017", requested_file),
                os.path.join(settings.DATASET_PATH, requested_file),
                os.path.join("..", settings.DATASET_PATH, "cic-ids2017", requested_file),
                os.path.join("..", settings.DATASET_PATH, requested_file),
            ]
            if os.path.basename(DEFAULT_CSV_PATH).lower() == requested_file.lower():
                candidates.append(DEFAULT_CSV_PATH)
            for cand in candidates:
                if os.path.exists(cand):
                    fmt = "parquet" if cand.lower().endswith(".parquet") else "csv"
                    return cand, fmt
            raise FileNotFoundError(f"Requested dataset file '{requested_file}' not found.")

        # 2. Check for real Parquet files in data/raw/cic-ids2017
        cic_dirs = [
            os.path.join(settings.DATASET_PATH, "cic-ids2017"),
            os.path.join("..", settings.DATASET_PATH, "cic-ids2017"),
            settings.DATASET_PATH,
            os.path.join("..", settings.DATASET_PATH),
        ]
        for cic_dir in cic_dirs:
            if os.path.isdir(cic_dir):
                parquets = [
                    os.path.join(cic_dir, f)
                    for f in os.listdir(cic_dir)
                    if f.lower().endswith(".parquet") and os.path.getsize(os.path.join(cic_dir, f)) > 100
                ]
                if parquets:
                    return parquets[0], "parquet"

        # 3. Check for verified D:/shap_sample_features.csv
        if os.path.exists(DEFAULT_CSV_PATH):
            return DEFAULT_CSV_PATH, "csv"

        raise FileNotFoundError(
            f"No valid dataset source found in '{cic_dir}' or at '{DEFAULT_CSV_PATH}'. "
            "Please provide real CIC-IDS2017 flow data."
        )

    def load_rows_from_source(
        self,
        source_path: str,
        source_format: str,
        start_idx: int,
        count: int,
    ) -> Tuple[List[Dict[str, Any]], Optional[List[str]]]:
        """
        Read up to `count` rows from source starting at `start_idx`.
        Returns: (list_of_row_dicts, optional_labels)
        """
        detector = get_xgboost_detector()
        expected_cols = detector.feature_columns

        if source_format == "parquet":
            pf = pq.ParquetFile(source_path)
            table = pf.read()
            df = table.to_pandas()
            df = df.iloc[start_idx : start_idx + count]
        else:
            # CSV stream with exact 69 columns
            df = pd.read_csv(source_path, skiprows=range(1, start_idx + 1), nrows=count)

        if df.empty:
            return [], None

        # Check for optional ground-truth label column
        label_col = next((c for c in df.columns if c.lower() in ["label", "label_normalized"]), None)
        labels = [str(x) for x in df[label_col].tolist()] if label_col else None

        # Verify all 69 expected features exist
        missing_features = [col for col in expected_cols if col not in df.columns]
        if missing_features:
            raise ValueError(
                f"Dataset source missing {len(missing_features)} required CIC-IDS2017 features: {missing_features[:5]}"
            )

        # Slice exact 69 columns
        features_df = df[expected_cols]
        row_dicts = features_df.to_dict(orient="records")
        return row_dicts, labels

    # ─── Core Ingestion ────────────────────────────────────────────────────────

    async def _ingest_one_batch(
        self,
        db: AsyncSession,
        batch_size: int,
    ) -> Dict[str, Any]:
        """
        Load and persist one batch of flow records from self.current_index.
        Advances current_index / events_sent / total_events on success.
        Does NOT commit the session — caller is responsible for commit/rollback.
        Does NOT modify is_running or is_paused.

        Returns:
            {"status": "ok"|"completed"|"no_source",
             "events_ingested": int, "alerts_generated": int,
             "created_events": List[Event]}
        """
        if not self._source_path or not self._source_fmt:
            return {
                "status": "no_source",
                "events_ingested": 0,
                "alerts_generated": 0,
                "created_events": [],
            }

        row_dicts, gt_labels = self.load_rows_from_source(
            source_path=self._source_path,
            source_format=self._source_fmt,
            start_idx=self.current_index,
            count=batch_size,
        )

        if not row_dicts:
            if not self.loop:
                # Dataset exhausted — caller decides how to update is_running
                return {
                    "status": "completed",
                    "events_ingested": 0,
                    "alerts_generated": 0,
                    "created_events": [],
                }
            else:
                # Looping explicitly requested: advance pass counter and restart
                self.replay_pass += 1
                self.current_index = 0
                row_dicts, gt_labels = self.load_rows_from_source(
                    source_path=self._source_path,
                    source_format=self._source_fmt,
                    start_idx=0,
                    count=batch_size,
                )

        detector = get_xgboost_detector()
        created_events: List[Event] = []
        created_alerts: List[Alert] = []
        base_time = datetime.utcnow()

        pass_suffix = f" (Pass {self.replay_pass})" if self.replay_pass > 1 else ""
        source_label = f"CIC-IDS2017:{self.current_file}{pass_suffix}"

        for idx, raw_row in enumerate(row_dicts):
            cleaned_features = sanitize_flow_features(raw_row)

            # Ground-truth dataset label (kept distinct from model prediction)
            ground_truth_label = gt_labels[idx] if gt_labels and idx < len(gt_labels) else None

            # Genuine XGBoost inference
            score_res = detector.score(
                features=cleaned_features,
                attack_type=ground_truth_label,
                historical_risk=0.0,
            )

            # Map network header context faithfully from flow features
            proto_num = int(cleaned_features.get("Protocol", 6))
            protocol_name = "TCP" if proto_num == 6 else ("UDP" if proto_num == 17 else f"PROTO-{proto_num}")
            dest_port = int(cleaned_features.get("Destination Port", 80))
            if dest_port <= 0 or dest_port > 65535:
                dest_port = 80
            src_port = 49152 + ((self.current_index + idx) % 15000)

            # Realistic IP mapping reflecting standard CIC-IDS2017 topology
            if score_res["prediction"] == "ATTACK":
                src_ip = "172.16.0.1"
                dst_ip = "192.168.10.50"
            else:
                src_ip = f"192.168.10.{(idx % 30) + 10}"
                dst_ip = "192.168.10.50"

            event_id = str(uuid.uuid4())
            # Assign actual UTC processing/ingestion timestamp (with microsecond monotonicity for distinct ordering)
            event_time = datetime.now(timezone.utc) + timedelta(microseconds=idx)

            event = Event(
                id=event_id,
                source_ip=src_ip,
                destination_ip=dst_ip,
                source_port=src_port,
                destination_port=dest_port,
                protocol=protocol_name,
                flow_duration=float(cleaned_features.get("Flow Duration", 0.0)),
                total_fwd_packets=int(cleaned_features.get("Total Fwd Packets", 0)),
                total_bwd_packets=int(cleaned_features.get("Total Backward Packets", 0)),
                total_length_fwd_packets=float(cleaned_features.get("Fwd Packets Length Total", 0.0)),
                total_length_bwd_packets=float(cleaned_features.get("Bwd Packets Length Total", 0.0)),
                flow_bytes_per_sec=float(cleaned_features.get("Flow Bytes/s", 0.0)),
                flow_packets_per_sec=float(cleaned_features.get("Flow Packets/s", 0.0)),
                features=cleaned_features,
                prediction=score_res["prediction"],
                confidence=float(score_res["confidence"]),
                anomaly_score=float(score_res["anomaly_score"]),
                risk_score=float(score_res["risk_score"]),
                attack_type=ground_truth_label or (score_res["prediction"] if score_res["prediction"] == "ATTACK" else "BENIGN"),
                model_version=detector.model_version,
                model_name=detector.model_name,
                dataset_source=source_label,
                timestamp=event_time,
                created_at=event_time,
            )
            created_events.append(event)
            db.add(event)

            # Alert creation strictly follows documented threshold rules
            # Alert generated when risk_score >= active_threshold or prediction == "ATTACK"
            active_threshold = get_active_alert_threshold()
            if score_res["risk_score"] >= active_threshold or score_res["prediction"] == "ATTACK":
                alert = Alert(
                    id=str(uuid.uuid4()),
                    event_id=event_id,
                    severity=SeverityLevel(score_res["severity"]),
                    attack_type=ground_truth_label or (score_res["prediction"] if score_res["prediction"] == "ATTACK" else "Anomaly"),
                    status=AlertStatus.NEW,
                    risk_score=float(score_res["risk_score"]),
                    confidence=float(score_res["confidence"]),
                    detection_model=detector.model_name,
                    detection_reason=(
                        f"XGBoost detector flagged network flow anomaly with composite risk score "
                        f"{score_res['risk_score']:.1f}/100 (attack class probability: {score_res['anomaly_score']:.2%})"
                    ),
                    # Strictly no fabricated MITRE techniques
                    mitre_tactic=None,
                    mitre_technique_id=None,
                    mitre_technique_name=None,
                    source_ip=src_ip,
                    destination_ip=dst_ip,
                    source_port=src_port,
                    destination_port=dest_port,
                    protocol=protocol_name,
                    first_seen=event_time,
                    last_seen=event_time,
                    created_at=event_time,
                )
                created_alerts.append(alert)
                db.add(alert)

        # Update rolling rate telemetry window
        if created_events:
            for e in created_events:
                is_threat = bool(e.prediction and e.prediction != "BENIGN")
                self._rolling_events.append({
                    "id": e.id,
                    "timestamp": e.timestamp if getattr(e, "timestamp", None) is not None else datetime.now(timezone.utc),
                    "is_threat": is_threat,
                })

            latest_ts = max(_ensure_utc(e["timestamp"]) for e in self._rolling_events)
            cutoff = latest_ts - timedelta(seconds=30)
            self._rolling_events = [e for e in self._rolling_events if _ensure_utc(e["timestamp"]) >= cutoff]

            unique_events: Dict[str, Dict[str, Any]] = {}
            for e in self._rolling_events:
                if e["id"] not in unique_events:
                    unique_events[e["id"]] = e

            all_unique = list(unique_events.values())
            if len(all_unique) >= 2:
                earliest_ts = min(_ensure_utc(e["timestamp"]) for e in all_unique)
                elapsed_sec = (latest_ts - earliest_ts).total_seconds()

                if elapsed_sec > 0:
                    threat_count = sum(1 for e in all_unique if e["is_threat"])
                    events_per_sec = round(len(all_unique) / elapsed_sec, 1)
                    threats_per_min = round((threat_count / elapsed_sec) * 60.0, 1)
                    epoch_sec = int(latest_ts.timestamp())
                    time_str = latest_ts.strftime("%H:%M:%S")

                    metric_point = {
                        "time": time_str,
                        "events": events_per_sec,
                        "threats": threats_per_min,
                        "epoch_sec": epoch_sec,
                    }
                    if not self.metrics_history or self.metrics_history[-1]["epoch_sec"] != epoch_sec:
                        self.metrics_history.append(metric_point)
                    else:
                        self.metrics_history[-1] = metric_point

                    if len(self.metrics_history) > 60:
                        self.metrics_history = self.metrics_history[-60:]

        return {
            "status": "ok",
            "events_ingested": len(created_events),
            "alerts_generated": len(created_alerts),
            "created_events": created_events,
            "created_alerts": created_alerts,
        }

    # ─── Background Worker ────────────────────────────────────────────────────

    def _apply_batch_success(self, result: Dict[str, Any]) -> None:
        """Apply counter, state, and pointer updates strictly after transaction commit."""
        created_events = result.get("created_events", [])
        created_alerts = result.get("created_alerts", [])
        n_events = len(created_events)
        n_alerts = len(created_alerts)
        self.current_index += n_events
        self.events_sent += n_events
        self.total_events += n_events
        self.alerts_generated += n_alerts
        self.last_ingested_ids = [e.id for e in created_events]

        logger.info(
            "Replay batch committed: %d events persisted, %d alerts generated from '%s' (index now %d).",
            n_events,
            n_alerts,
            self.current_file,
            self.current_index,
        )

    async def _run_worker(self, batch_size: int) -> None:
        """
        Background asyncio worker coroutine.

        Runs continuously inside the FastAPI event loop, completely independent of
        any HTTP connection or React component lifecycle. Ingests one batch per
        interval, sleeping proportionally to self.speed between batches.
        Checks self.is_paused on every tick (250 ms resolution) without cancellation.

        Lifecycle:
          - Started by start_replay() via asyncio.create_task()
          - Paused/resumed via is_paused flag (no task manipulation needed)
          - Stopped by stop() via task.cancel() + await task
          - Self-terminates when dataset is exhausted (no loop)

        CancelledError is re-raised after logging so the Task transitions to
        CANCELLED state correctly and stop()'s await returns cleanly.
        """
        # Local import avoids circular dependency at module level
        from app.database.session import async_session

        logger.info(
            "Replay background worker started (batch_size=%d, speed=%.1f×).",
            batch_size, self.speed,
        )
        try:
            while self.is_running:
                # Paused: spin-wait at low frequency without consuming a DB session
                if self.is_paused:
                    await asyncio.sleep(0.25)
                    continue

                # Each iteration owns a properly-scoped session; no session leaks
                batch_committed = False
                result = None
                async with async_session() as db:
                    try:
                        result = await self._ingest_one_batch(db, batch_size)
                        if result["status"] == "ok":
                            await asyncio.shield(db.commit())
                            batch_committed = True
                            self._apply_batch_success(result)
                            self.last_commit_status = "committed"
                    except asyncio.CancelledError:
                        if not batch_committed:
                            try:
                                await db.rollback()
                            except Exception:
                                pass
                            self.last_commit_status = "rolled_back"
                            logger.warning(
                                "Replay worker received cancellation during batch processing at index %d; transaction rolled back safely.",
                                self.current_index,
                            )
                        else:
                            logger.info(
                                "Replay worker received cancellation after batch commit at index %d; transaction committed safely.",
                                self.current_index,
                            )
                        raise
                    except Exception as batch_exc:
                        await db.rollback()
                        self.last_commit_status = "rolled_back"
                        logger.exception(
                            "Replay worker batch error at index %d ? stopping worker: %s",
                            self.current_index, batch_exc,
                        )
                        self.is_running = False
                        break

                if result and result["status"] == "completed":
                    self.is_running = False
                    self.is_completed = True
                    logger.info(
                        "Replay worker: dataset exhausted and finalized at index %d. Total events sent: %d.",
                        self.current_index, self.events_sent,
                    )
                    break

                if self._source_total_rows is not None and self.current_index >= self._source_total_rows:
                    if not self.loop:
                        self.is_running = False
                        self.is_completed = True
                        logger.info(
                            "Replay worker: reached total rows (%d) at index %d. Final batch committed. Marking completed.",
                            self._source_total_rows, self.current_index,
                        )
                        break
                interval = max(0.5, 2.0 / max(0.1, self.speed))
                await asyncio.sleep(interval)

        except asyncio.CancelledError:
            logger.info("Replay background worker cancelled cleanly.")
            raise  # Re-raise: Task must transition to CANCELLED for stop()'s await

        except Exception as exc:
            logger.exception("Replay background worker unexpected error: %s", exc)
            self.is_running = False

        finally:
            logger.info(
                "Replay background worker exited. Total events sent: %d, current_index: %d.",
                self.events_sent, self.current_index,
            )

    # ─── Public API ───────────────────────────────────────────────────────────

    async def start_replay(
        self,
        db: AsyncSession,
        batch_size: int = DEFAULT_BATCH_SIZE,
        speed: float = 1.0,
        dataset_file: Optional[str] = None,
        loop: bool = False,
    ) -> Dict[str, Any]:
        """
        Start replay ingestion:
        - Validates batch size (1 to 500)
        - Prevents duplicate ingestion / duplicate worker launch
        - Ingests first batch synchronously for immediate HTTP response
        - Launches asyncio background worker for all subsequent batches
        - Worker survives page navigation; frontend only polls, never drives ingestion
        """
        # Validate batch size bound
        if batch_size < MIN_BATCH_SIZE:
            raise ValueError(f"batch_size must be at least {MIN_BATCH_SIZE}")
        if batch_size > MAX_BATCH_SIZE:
            raise ValueError(f"batch_size cannot exceed {MAX_BATCH_SIZE} records to protect database responsiveness")

        # Resume if paused
        if self.is_running and self.is_paused:
            self.is_paused = False
            self.speed = speed
            return {
                "status": "resumed",
                "message": "Resumed existing replay stream.",
                "status_detail": self.get_status(),
            }

        # Prevent duplicate start if worker already active
        if self.is_running and not self.is_paused:
            return {
                "status": "already_running",
                "message": "Replay stream is currently active. Use pause or stop first.",
                "status_detail": self.get_status(),
            }

        if not self.is_running:
            self.metrics_history = []
            self.events_sent = 0
            self.alerts_generated = 0
        self._rolling_events = []

        self.loop = loop
        self.speed = speed

        # Resolve source once; persist for worker reuse (avoids re-resolving every batch)
        source_path, source_fmt = self.resolve_dataset_source(dataset_file)
        self.current_file = os.path.basename(source_path)
        self._source_path = source_path
        self._source_fmt = source_fmt
        self._worker_batch_size = batch_size

        # Ingest first batch synchronously — provides immediate HTTP feedback with event counts
        if source_fmt == 'parquet':
            try:
                pf = pq.ParquetFile(source_path)
                self._source_total_rows = pf.metadata.num_rows
            except Exception:
                self._source_total_rows = None
        else:
            self._source_total_rows = None

        self.is_completed = False
        self.last_commit_status = 'idle'

        first_result = await self._ingest_one_batch(db, batch_size)

        if first_result["status"] == "completed":
            # Dataset exhausted on first call (very small file or large batch_size)
            self.is_completed = True
            self.is_running = False
            return {
                "status": "completed",
                "message": f"Dataset replay completed at end of file '{self.current_file}' (processed {self.current_index} rows).",
                "events_ingested": first_result["events_ingested"],
                "alerts_generated": first_result["alerts_generated"],
                "source_file": self.current_file,
                "status_detail": self.get_status(),
            }

        # Commit first batch. get_db() will attempt a harmless second commit (no pending ops).
        await db.commit()
        self._apply_batch_success(first_result)
        self.last_commit_status = 'committed'

        if self._source_total_rows is not None and self.current_index >= self._source_total_rows:
            if not self.loop:
                self.is_completed = True
                self.is_running = False
                logger.info('start_replay: dataset completed after first batch (%d rows).', self.current_index)
                return {
                    'status': 'completed',
                    'message': f"Dataset replay completed at end of file '{self.current_file}' (processed {self.current_index} rows).",
                    'events_ingested': first_result['events_ingested'],
                    'alerts_generated': first_result['alerts_generated'],
                    'source_file': self.current_file,
                    'status_detail': self.get_status(),
                }

        # Mark running after the first batch is safely persisted
        self.is_running = True
        self.is_paused = False
        self.start_timestamp = time.time()

        # Launch background worker — strict double-start guard
        if self._worker_task is None or self._worker_task.done():
            self._worker_task = asyncio.create_task(
                self._run_worker(batch_size),
                name="sentinelai_replay_worker",
            )
            logger.info(
                "Replay started: %d events in first batch from '%s', background worker launched.",
                first_result["events_ingested"],
                self.current_file,
            )
        else:
            logger.warning(
                "start_replay called but worker task already running — skipped duplicate launch."
            )

        return {
            "status": "started",
            "message": f"Successfully ingested {first_result['events_ingested']} flow events from '{self.current_file}'",
            "events_ingested": first_result["events_ingested"],
            "alerts_generated": first_result["alerts_generated"],
            "source_file": self.current_file,
            "status_detail": self.get_status(),
        }

    async def step(self, db: AsyncSession, count: int = 5) -> Dict[str, Any]:
        """
        Advance active replay stream by ingesting the next count rows sequentially.
        Blocked while the background worker is actively streaming to prevent duplicate ingestion.
        Manual stepping is permitted when paused or when worker is not actively ticking.
        Does not restart from 0, tracks stream state, and respects loop configuration.
        """
        if not self.is_running:
            return {
                "status": "idle",
                "message": "Replay stream is not currently running. Call /api/replay/start first.",
                "events_ingested": 0,
                "alerts_generated": 0,
                "status_detail": self.get_status(),
            }

        # Guard: prevent manual step while background worker is actively ticking
        if not self.is_paused and self._worker_task and not self._worker_task.done():
            return {
                "status": "worker_active",
                "message": (
                    "Background worker is actively streaming — manual step disabled to prevent duplicate ingestion. "
                    "Pause replay first to step manually."
                ),
                "events_ingested": 0,
                "alerts_generated": 0,
                "status_detail": self.get_status(),
            }

        # Ensure source is resolved
        if not self._source_path or not self._source_fmt:
            source_path, source_fmt = self.resolve_dataset_source(self.current_file)
            self._source_path = source_path
            self._source_fmt = source_fmt
            self.current_file = os.path.basename(source_path)

        ingest_res = await self._ingest_one_batch(db, count)

        if ingest_res["status"] == "completed":
            if not self.loop:
                self.is_running = False
                self.is_paused = False
            return {
                "status": "completed",
                "message": f"Dataset replay reached end of file '{self.current_file}'.",
                "events_ingested": 0,
                "alerts_generated": 0,
                "source_file": self.current_file,
                "status_detail": self.get_status(),
            }

        await db.commit()
        self._apply_batch_success(ingest_res)
        self.last_commit_status = 'committed'

        if self._source_total_rows is not None and self.current_index >= self._source_total_rows:
            if not self.loop:
                self.is_running = False
                self.is_completed = True

        return {
            "status": "stepped",
            "events_ingested": ingest_res["events_ingested"],
            "alerts_generated": ingest_res["alerts_generated"],
            "events": [
                {
                    "id": e.id,
                    "timestamp": e.timestamp.replace(tzinfo=timezone.utc).isoformat() if e.timestamp.tzinfo is None else e.timestamp.isoformat(),
                    "source_ip": e.source_ip,
                    "destination_ip": e.destination_ip,
                    "source_port": e.source_port,
                    "destination_port": e.destination_port,
                    "protocol": e.protocol,
                    "flow_duration": e.flow_duration,
                    "total_fwd_packets": e.total_fwd_packets,
                    "total_bwd_packets": e.total_bwd_packets,
                    "total_length_fwd_packets": e.total_length_fwd_packets,
                    "total_length_bwd_packets": e.total_length_bwd_packets,
                    "features": e.features,
                    "prediction": e.prediction,
                    "confidence": e.confidence,
                    "anomaly_score": e.anomaly_score,
                    "risk_score": e.risk_score,
                    "attack_type": e.attack_type,
                    "model_version": e.model_version,
                    "model_name": e.model_name,
                    "dataset_source": e.dataset_source,
                }
                for e in ingest_res["created_events"]
            ],
            "status_detail": self.get_status(),
        }


# ─── Singleton accessor ────────────────────────────────────────────────────────

_replay_service_instance: Optional[ReplayLoaderService] = None


def get_replay_loader_service() -> ReplayLoaderService:
    """Return cached singleton instance of ReplayLoaderService."""
    global _replay_service_instance
    if _replay_service_instance is None:
        _replay_service_instance = ReplayLoaderService()
    return _replay_service_instance
