"""Dashboard API routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database.session import get_db
from app.models.database import Event, Alert, SeverityLevel

router = APIRouter()


@router.get("/summary")
async def get_dashboard_summary(db: AsyncSession = Depends(get_db)):
    """Get dashboard KPI summary from database."""
    total_events_res = await db.execute(select(func.count(Event.id)))
    total_events = total_events_res.scalar() or 0

    normal_events_res = await db.execute(select(func.count(Event.id)).where(Event.attack_type == 'BENIGN'))
    normal_events = normal_events_res.scalar() or 0

    suspicious_events_res = await db.execute(select(func.count(Event.id)).where(Event.attack_type != 'BENIGN'))
    suspicious_events = suspicious_events_res.scalar() or 0

    critical_alerts_res = await db.execute(select(func.count(Alert.id)).where(Alert.severity == SeverityLevel.CRITICAL))
    critical_alerts = critical_alerts_res.scalar() or 0

    detection_rate = round((suspicious_events / total_events * 100), 2) if total_events > 0 else 0.0

    return {
        "total_events": total_events,
        "normal_events": normal_events,
        "suspicious_events": suspicious_events,
        "critical_alerts": critical_alerts,
        "detection_rate": detection_rate,
        "false_positive_rate": 0.0,
        "total_events_trend": 0.0,
        "normal_events_trend": 0.0,
        "suspicious_events_trend": 0.0,
        "critical_alerts_trend": 0.0,
        "detection_rate_trend": 0.0,
        "false_positive_rate_trend": 0.0,
    }
