"""
SentinelAI - Tests for Replay Loader Service and Replay API
Validates feature ordering, bounded batch ingestion, database persistence,
XGBoost inference, replay controls, and end-to-end TreeSHAP explainability.
"""
import os
import json
import asyncio
import pytest
import pandas as pd
from fastapi.testclient import TestClient
from sqlalchemy import select, func

from app.main import app
from app.database.session import async_session
from app.models.database import Event, Alert
from app.services.replay_loader import (
    ReplayLoaderService,
    get_replay_loader_service,
    sanitize_flow_features,
    DEFAULT_CSV_PATH,
)


@pytest.fixture(scope="module")
def client():
    """FastAPI TestClient fixture."""
    return TestClient(app)


# ─── 1. Feature Ordering & Sanitization Tests ───────────────────────────────

def test_csv_feature_ordering_matches_model():
    """Verify that D:/shap_sample_features.csv exactly matches the 69-feature model column order."""
    assert os.path.exists(DEFAULT_CSV_PATH), f"CSV not found at {DEFAULT_CSV_PATH}"
    json_path = os.path.join(
        os.path.dirname(__file__), "..", "app", "ml", "artifacts", "feature_columns.json"
    )
    assert os.path.exists(json_path)

    with open(json_path, "r", encoding="utf-8") as f:
        expected_cols = json.load(f)

    df_sample = pd.read_csv(DEFAULT_CSV_PATH, nrows=5)
    csv_cols = list(df_sample.columns)

    assert len(csv_cols) == 69
    assert csv_cols == expected_cols, "CSV columns must match feature_columns.json in exact order"


def test_feature_sanitization_nan_and_inf():
    """Verify that NaN, +inf, -inf, and invalid types are cleanly mapped to finite floats."""
    raw = {
        "Protocol": 6,
        "Flow Duration": float("nan"),
        "Flow Bytes/s": float("inf"),
        "Flow Packets/s": float("-inf"),
        "Total Fwd Packets": "15",
        "Corrupted_Field": "not_a_number",
    }
    cleaned = sanitize_flow_features(raw)

    assert cleaned["Protocol"] == 6.0
    assert cleaned["Flow Duration"] == 0.0
    assert cleaned["Flow Bytes/s"] == 0.0
    assert cleaned["Flow Packets/s"] == 0.0
    assert cleaned["Total Fwd Packets"] == 15.0
    assert cleaned["Corrupted_Field"] == 0.0

    # Ensure JSON serializability
    serialized = json.dumps(cleaned)
    assert "NaN" not in serialized
    assert "Infinity" not in serialized


# ─── 2. Bounded Batch Size Validation Tests ─────────────────────────────────

def test_batch_size_bounds_validation():
    """Ensure batch sizes < 1 or > 500 are rejected with ValueError."""
    async def _run():
        service = ReplayLoaderService()
        async with async_session() as session:
            with pytest.raises(ValueError, match="batch_size must be at least 1"):
                await service.start_replay(db=session, batch_size=0)

            with pytest.raises(ValueError, match="batch_size cannot exceed 500"):
                await service.start_replay(db=session, batch_size=501)

    asyncio.run(_run())


# ─── 3. Replay Ingestion, Inference & Persistence Tests ─────────────────────

def test_replay_ingestion_and_sqlite_persistence():
    """Ingest a bounded batch of 10 rows and verify persistence and real XGBoost predictions."""
    async def _run():
        service = ReplayLoaderService()

        async with async_session() as session:
            # Ingest 10 real sample rows
            res = await service.start_replay(db=session, batch_size=10, speed=1.0)
            assert res["status"] == "started"
            assert res["events_ingested"] == 10
            assert "shap_sample_features.csv" in res["source_file"]

            # Verify records in database
            event_query = select(Event).order_by(Event.created_at.desc()).limit(10)
            events_res = await session.execute(event_query)
            events = events_res.scalars().all()
            assert len(events) >= 10

            # Inspect first ingested event
            evt = events[0]
            assert evt.id is not None
            assert evt.prediction in ["BENIGN", "ATTACK"]
            assert 0.0 <= evt.confidence <= 1.0
            assert 0.0 <= evt.anomaly_score <= 1.0
            assert 0.0 <= evt.risk_score <= 100.0
            assert evt.model_name == "XGBoost Grouped Classifier"

            # Verify features JSON contains all 69 features
            assert evt.features is not None
            assert isinstance(evt.features, dict)
            assert len(evt.features) == 69
            assert "Protocol" in evt.features
            assert "Flow Duration" in evt.features
            assert "Avg Packet Size" in evt.features

            # Check alert generation rules (no fabricated MITRE techniques)
            if res["alerts_generated"] > 0:
                alert_query = select(Alert).order_by(Alert.created_at.desc()).limit(res["alerts_generated"])
                alerts_res = await session.execute(alert_query)
                alerts = alerts_res.scalars().all()
                for al in alerts:
                    assert al.risk_score >= 50.0 or al.attack_type != "BENIGN"
                    # MITRE technique must not be fabricated
                    assert al.mitre_technique_id is None
                    assert al.mitre_tactic is None

    asyncio.run(_run())


# ─── 4. Replay Control State & Duplicate Prevention Tests ────────────────────

def test_replay_controls_and_duplicate_prevention():
    """Verify pause, resume, stop, and that calling start on active replay prevents duplicates."""
    async def _run():
        service = ReplayLoaderService()

        async with async_session() as session:
            # Initial start
            res1 = await service.start_replay(db=session, batch_size=5)
            assert res1["status"] == "started"
            assert service.is_running is True

            # Second start while already running must be prevented
            res2 = await service.start_replay(db=session, batch_size=5)
            assert res2["status"] == "already_running"

            # Test pause
            pause_res = service.pause()
            assert pause_res["status"] == "paused"
            assert service.is_paused is True

            # Calling start while paused should resume without duplicating
            res3 = await service.start_replay(db=session, batch_size=5)
            assert res3["status"] == "resumed"
            assert service.is_paused is False

            # Test stop
            stop_res = await service.stop()
            assert stop_res["status"] == "stopped"
            assert service.is_running is False

    asyncio.run(_run())


# ─── 5. Replay HTTP API Endpoints Tests ─────────────────────────────────────

def test_api_replay_endpoints(client: TestClient):
    """Test /api/replay HTTP API routes via TestClient."""
    # 1. Check initial status
    status_res = client.get("/api/replay/status")
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert "is_running" in status_data
    assert "speed" in status_data

    # 2. Start replay with valid batch
    start_res = client.post("/api/replay/start", json={"batch_size": 5, "speed": 2.0})
    assert start_res.status_code == 200
    start_data = start_res.json()
    assert start_data["status"] in ["started", "already_running", "resumed"]

    # 3. Pause replay
    pause_res = client.post("/api/replay/pause")
    assert pause_res.status_code == 200

    # 4. Resume replay
    resume_res = client.post("/api/replay/resume")
    assert resume_res.status_code == 200

    # 5. Stop replay
    stop_res = client.post("/api/replay/stop")
    assert stop_res.status_code == 200

    # 6. Reject invalid batch size (> 500)
    err_res = client.post("/api/replay/start", json={"batch_size": 9999})
    assert err_res.status_code == 422

    # 7. Reject non-existent file
    fnf_res = client.post("/api/replay/start", json={"dataset_file": "nonexistent_file_xyz.parquet"})
    assert fnf_res.status_code == 404


# ─── 6. End-to-End Prediction & TreeSHAP on Ingested Event ──────────────────

def test_end_to_end_prediction_and_explain_on_ingested_event(client: TestClient):
    """Query an ingested event from the DB and verify it passes to /predict and /explain."""
    # Ensure at least one event is ingested
    client.post("/api/replay/start", json={"batch_size": 5})

    # Get latest event via API
    events_res = client.get("/api/events?page_size=1")
    assert events_res.status_code == 200
    events_data = events_res.json()
    assert len(events_data["events"]) > 0

    evt = events_data["events"][0]
    features = evt["features"]
    assert features is not None
    assert len(features) == 69

    # 1. Pass features to /api/models/predict
    pred_res = client.post("/api/models/predict", json={"features": features})
    assert pred_res.status_code == 200
    pred_json = pred_res.json()
    assert pred_json["prediction"] in ["BENIGN", "ATTACK"]
    assert "risk_score" in pred_json
    assert "anomaly_score" in pred_json

    # 2. Pass features to /api/models/explain
    explain_res = client.post("/api/models/explain", json={"features": features, "top_k": 8})
    assert explain_res.status_code == 200
    explain_json = explain_res.json()
    assert explain_json["method"] == "TreeSHAP (additive log-odds margin attribution)"
    assert len(explain_json["feature_contributions"]) == 8
    assert "explanation_notes" in explain_json


# ─── 7. Regression Tests for Confirmed Audit Issues ─────────────────────────

def test_sequential_subsecond_timestamps():
    """Verify that events ingested in a batch receive distinct, sequential timestamps."""
    async def _run():
        service = ReplayLoaderService()
        async with async_session() as session:
            res = await service.start_replay(db=session, batch_size=5, speed=1.0)
            assert res["status"] == "started"

            # Query the 5 events
            query = select(Event).where(Event.id.in_(service.last_ingested_ids)).order_by(Event.timestamp.asc())
            events_res = await session.execute(query)
            evts = events_res.scalars().all()
            assert len(evts) == 5

            # Timestamps must be strictly non-decreasing and distinct (sub-second spacing)
            for i in range(len(evts) - 1):
                assert evts[i].timestamp < evts[i + 1].timestamp

    asyncio.run(_run())


def test_replay_end_of_dataset_and_loop_distinction():
    """Verify stopping at end of dataset when loop=False, and distinguishing pass when loop=True."""
    async def _run():
        service = ReplayLoaderService()
        service.current_index = 2000  # Set index to end of 2000-row file

        async with async_session() as session:
            # 1. When loop=False, must stop at end of dataset
            res_stop = await service.start_replay(db=session, batch_size=10, loop=False)
            assert res_stop["status"] == "completed"
            assert service.is_running is False

            # 2. When loop=True, must wrap to 0 and advance replay_pass to 2
            service.current_index = 2000
            res_loop = await service.start_replay(db=session, batch_size=5, loop=True)
            assert res_loop["status"] == "started"
            assert service.replay_pass == 2
            assert "(Pass 2)" in res_loop["source_file"] or service.replay_pass == 2

    asyncio.run(_run())


def test_replay_step_progression(client: TestClient):
    """Verify that /api/replay/step guards while active and advances sequentially when paused."""
    async def _run():
        service = ReplayLoaderService()
        async with async_session() as session:
            # Step when idle returns status idle
            idle_res = await service.step(db=session, count=2)
            assert idle_res["status"] == "idle"

            # Start replay (launches background worker)
            await service.start_replay(db=session, batch_size=3)
            initial_index = service.current_index
            assert initial_index >= 3

            # While worker is actively streaming, step must be guarded against duplicate ingestion
            active_step = await service.step(db=session, count=4)
            assert active_step["status"] == "worker_active"

            # When paused, manual step is permitted to advance pointer
            service.pause()
            step_res = await service.step(db=session, count=4)
            assert step_res["status"] == "stepped"
            assert step_res["events_ingested"] == 4
            assert service.current_index == initial_index + 4

            # Clean up
            await service.stop()

    asyncio.run(_run())

    # Test HTTP endpoint
    client.post("/api/replay/start", json={"batch_size": 2})
    step_res = client.post("/api/replay/step?count=3")
    assert step_res.status_code == 200
    # In live uvicorn loop status is worker_active; in synchronous TestClient loop status is stepped/completed
    assert step_res.json()["status"] in ["worker_active", "stepped", "completed"]

    client.post("/api/replay/pause")
    step_paused = client.post("/api/replay/step?count=3")
    assert step_paused.status_code == 200
    assert step_paused.json()["status"] in ["stepped", "completed"]

    client.post("/api/replay/stop")


def test_replay_rate_telemetry_tracking():
    """Verify that ReplayLoaderService generates authentic rate metrics from event timestamps."""
    async def _run():
        service = ReplayLoaderService()
        await service.stop()

        async with async_session() as session:
            # Initially metrics should be empty
            status_init = service.get_status()
            assert "metrics" in status_init
            assert len(status_init["metrics"]) == 0

            # Ingest batch
            start_res = await service.start_replay(db=session, batch_size=10, speed=2.0)
            assert start_res["status"] == "started"

            # Check status contains calculated metric points
            status_running = service.get_status()
            assert len(status_running["metrics"]) > 0

            point = status_running["metrics"][-1]
            assert "time" in point
            assert "events" in point
            assert "threats" in point
            assert "epoch_sec" in point
            assert point["events"] > 0
            assert point["threats"] >= 0

            # Clean up: stop clears metrics
            await service.stop()
            status_stopped = service.get_status()
            assert len(status_stopped["metrics"]) == 0

    asyncio.run(_run())


def test_replay_rolling_window_and_zero_elapsed_handling():
    """Verify 30s rolling-window boundaries and safe zero-elapsed handling in replay loader."""
    from datetime import datetime, timedelta
    from app.models.database import Event

    async def _run():
        service = ReplayLoaderService()
        await service.stop()

        # Verify initial state
        assert len(service._rolling_events) == 0
        assert len(service.metrics_history) == 0

        async with async_session() as session:
            # 1. Ingest batch and verify rolling events are populated
            start_res = await service.start_replay(db=session, batch_size=10, speed=2.0)
            assert start_res["status"] == "started"
            assert len(service._rolling_events) == 10
            assert len(service.metrics_history) > 0

            # 2. Verify rolling window eviction: insert simulated old events > 30s ago
            old_time = datetime.utcnow() - timedelta(seconds=60)
            service._rolling_events.insert(0, {
                "id": "simulated-old-event",
                "timestamp": old_time,
                "is_threat": False,
            })

            # Ingest next batch; should evict the old event
            await service._ingest_one_batch(session, batch_size=5)
            ids_in_window = [e["id"] for e in service._rolling_events]
            assert "simulated-old-event" not in ids_in_window

            # 3. Verify stop cleanly resets both metrics and rolling events
            await service.stop()
            assert len(service._rolling_events) == 0
            assert len(service.metrics_history) == 0

    asyncio.run(_run())


