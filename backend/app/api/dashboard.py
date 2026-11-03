"""Dashboard API routes."""
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database.session import get_db
from app.models.database import Event, Alert, SeverityLevel
from app.services.settings_service import get_active_alert_threshold
from app.core.config import get_settings
from app.services.replay_loader import get_replay_loader_service

router = APIRouter()


def select_bucket_seconds(span_sec: float) -> int:
    """Select appropriate bucket duration (seconds) targeting ~15-30 chart points."""
    if span_sec <= 300:
        return 30
    elif span_sec <= 900:
        return 60
    elif span_sec <= 3600:
        return 120
    elif span_sec <= 14400:
        return 300
    elif span_sec <= 43200:
        return 900
    elif span_sec <= 86400:
        return 1800
    else:
        return 3600


@router.get("/summary")
async def get_dashboard_summary(db: AsyncSession = Depends(get_db)):
    """Get dashboard KPI summary from database."""
    total_events_res = await db.execute(select(func.count(Event.id)))
    total_events = total_events_res.scalar() or 0

    normal_events_res = await db.execute(select(func.count(Event.id)).where(func.upper(Event.attack_type) == 'BENIGN'))
    normal_events = normal_events_res.scalar() or 0

    suspicious_events_res = await db.execute(select(func.count(Event.id)).where(func.upper(Event.attack_type) != 'BENIGN'))
    suspicious_events = suspicious_events_res.scalar() or 0

    critical_alerts_res = await db.execute(select(func.count(Alert.id)).where(Alert.severity == SeverityLevel.CRITICAL))
    critical_alerts = critical_alerts_res.scalar() or 0

    attack_event_share = round((suspicious_events / total_events * 100), 2) if total_events > 0 else 0.0

    return {
        "total_events": total_events,
        "normal_events": normal_events,
        "suspicious_events": suspicious_events,
        "critical_alerts": critical_alerts,
        "detection_rate": attack_event_share,
        "attack_event_share": attack_event_share,
        "false_positive_rate": 0.0,
        "total_events_trend": 0.0,
        "normal_events_trend": 0.0,
        "suspicious_events_trend": 0.0,
        "critical_alerts_trend": 0.0,
        "detection_rate_trend": 0.0,
        "false_positive_rate_trend": 0.0,
    }


@router.get("/timeline")
async def get_dashboard_timeline(
    window_hours: float = Query(24.0, ge=0.0001, le=168.0),
    bucket_seconds: Optional[int] = Query(None, ge=10, le=86400),
    db: AsyncSession = Depends(get_db),
):
    """
    Get threat activity timeline aggregated from authentic persisted replay events over window_hours.
    Returns honest empty array if no events exist.
    Categorizes events according to project thresholds:
    - critical: risk_score >= 75.0 (CRITICAL_RISK_THRESHOLD)
    - suspicious: 50.0 <= risk_score < 75.0 (ALERT_RISK_THRESHOLD) or prediction/attack_type != 'BENIGN'
    - normal: benign events with risk_score < 50.0
    """
    settings = get_settings()
    service = get_replay_loader_service()

    now_utc = datetime.now(timezone.utc)
    cutoff_utc = now_utc - timedelta(hours=window_hours)
    cutoff_naive = cutoff_utc.replace(tzinfo=None)

    query = (
        select(
            Event.id,
            Event.timestamp,
            Event.prediction,
            Event.attack_type,
            Event.risk_score,
        )
        .where(Event.timestamp >= cutoff_naive)
        .order_by(Event.timestamp.asc())
    )
    rows_res = await db.execute(query)
    rows = rows_res.all()

    if not rows:
        return {
            "timeline": [],
            "total_events": 0,
            "normal_events": 0,
            "suspicious_events": 0,
            "critical_events": 0,
            "window_hours": window_hours,
            "bucket_seconds": bucket_seconds or 3600,
            "is_replay_running": service.is_running,
            "is_replay_paused": service.is_paused,
            "source_file": service.current_file,
            "earliest_timestamp": None,
            "latest_timestamp": None,
        }

    timestamps = [
        r.timestamp.replace(tzinfo=timezone.utc) if r.timestamp.tzinfo is None else r.timestamp
        for r in rows
    ]
    min_ts = min(timestamps)
    max_ts = max(timestamps)
    span_sec = max(1.0, (max_ts - min_ts).total_seconds())

    b_sec = bucket_seconds if bucket_seconds and bucket_seconds > 0 else select_bucket_seconds(span_sec)

    buckets: Dict[int, Dict[str, int]] = {}
    normal_total = 0
    suspicious_total = 0
    critical_total = 0

    for r in rows:
        dt = r.timestamp.replace(tzinfo=timezone.utc) if r.timestamp.tzinfo is None else r.timestamp
        epoch = int(dt.timestamp())
        b_epoch = (epoch // b_sec) * b_sec

        if b_epoch not in buckets:
            buckets[b_epoch] = {"normal": 0, "suspicious": 0, "critical": 0, "total": 0}

        risk = float(r.risk_score or 0.0)
        pred = r.prediction or "BENIGN"
        att = r.attack_type or "BENIGN"

        if risk >= settings.CRITICAL_RISK_THRESHOLD:
            buckets[b_epoch]["critical"] += 1
            critical_total += 1
        elif risk >= get_active_alert_threshold() or pred != "BENIGN" or att != "BENIGN":
            buckets[b_epoch]["suspicious"] += 1
            suspicious_total += 1
        else:
            buckets[b_epoch]["normal"] += 1
            normal_total += 1
        buckets[b_epoch]["total"] += 1

    min_b = (int(min_ts.timestamp()) // b_sec) * b_sec
    max_b = (int(max_ts.timestamp()) // b_sec) * b_sec

    timeline_points = []
    curr_b = min_b
    while curr_b <= max_b:
        data = buckets.get(curr_b, {"normal": 0, "suspicious": 0, "critical": 0, "total": 0})
        dt_b = datetime.fromtimestamp(curr_b, tz=timezone.utc)
        timeline_points.append({
            "time": dt_b.strftime("%H:%M"),
            "timestamp": dt_b.isoformat(),
            "epoch": curr_b,
            "normal": data["normal"],
            "suspicious": data["suspicious"],
            "critical": data["critical"],
            "total": data["total"],
        })
        curr_b += b_sec

    # Ensure baseline padding if only 1 bucket exists
    if len(timeline_points) == 1:
        single_epoch = timeline_points[0]["epoch"]
        prev_dt = datetime.fromtimestamp(single_epoch - b_sec, tz=timezone.utc)
        next_dt = datetime.fromtimestamp(single_epoch + b_sec, tz=timezone.utc)
        timeline_points.insert(0, {
            "time": prev_dt.strftime("%H:%M"),
            "timestamp": prev_dt.isoformat(),
            "epoch": single_epoch - b_sec,
            "normal": 0,
            "suspicious": 0,
            "critical": 0,
            "total": 0,
        })
        timeline_points.append({
            "time": next_dt.strftime("%H:%M"),
            "timestamp": next_dt.isoformat(),
            "epoch": single_epoch + b_sec,
            "normal": 0,
            "suspicious": 0,
            "critical": 0,
            "total": 0,
        })

    return {
        "timeline": timeline_points,
        "total_events": len(rows),
        "normal_events": normal_total,
        "suspicious_events": suspicious_total,
        "critical_events": critical_total,
        "window_hours": window_hours,
        "bucket_seconds": b_sec,
        "is_replay_running": service.is_running,
        "is_replay_paused": service.is_paused,
        "source_file": service.current_file,
        "earliest_timestamp": min_ts.isoformat(),
        "latest_timestamp": max_ts.isoformat(),
    }
