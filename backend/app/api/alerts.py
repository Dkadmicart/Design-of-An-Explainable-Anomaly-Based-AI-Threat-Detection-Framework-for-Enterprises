"""Alerts API routes."""
from fastapi import APIRouter, Query, Depends, HTTPException
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database.session import get_db
from app.models.database import Alert, AlertStatus, SeverityLevel
from app.schemas import AlertAction

router = APIRouter()


@router.get("")
async def list_alerts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    severity: Optional[str] = None,
    status: Optional[str] = None,
    attack_type: Optional[str] = None,
    source_ip: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """List alerts with filtering and pagination from database."""
    query = select(Alert)
    count_query = select(func.count(Alert.id))

    if severity:
        query = query.where(Alert.severity == severity)
        count_query = count_query.where(Alert.severity == severity)
    if status:
        query = query.where(Alert.status == status)
        count_query = count_query.where(Alert.status == status)
    if attack_type:
        query = query.where(Alert.attack_type == attack_type)
        count_query = count_query.where(Alert.attack_type == attack_type)
    if source_ip:
        query = query.where(Alert.source_ip == source_ip)
        count_query = count_query.where(Alert.source_ip == source_ip)

    total_res = await db.execute(count_query)
    total = total_res.scalar() or 0

    query = query.order_by(Alert.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    alerts_res = await db.execute(query)
    alerts = alerts_res.scalars().all()

    return {"alerts": alerts, "total": total, "page": page, "page_size": page_size}


@router.get("/{alert_id}")
async def get_alert(alert_id: str, db: AsyncSession = Depends(get_db)):
    """Get alert details by ID."""
    res = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = res.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"alert": alert}


@router.post("/{alert_id}/resolve")
async def resolve_alert(alert_id: str, body: AlertAction, db: AsyncSession = Depends(get_db)):
    """Mark an alert as resolved."""
    res = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = res.scalar_one_or_none()
    if alert:
        alert.status = AlertStatus.RESOLVED
        await db.commit()
    return {"status": "resolved", "alert_id": alert_id}


@router.post("/{alert_id}/escalate")
async def escalate_alert(alert_id: str, body: AlertAction, db: AsyncSession = Depends(get_db)):
    """Escalate an alert."""
    res = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = res.scalar_one_or_none()
    if alert:
        alert.status = AlertStatus.ESCALATED
        await db.commit()
    return {"status": "escalated", "alert_id": alert_id}


@router.post("/{alert_id}/confirm")
async def confirm_alert(alert_id: str, body: AlertAction, db: AsyncSession = Depends(get_db)):
    """Confirm an alert as a true positive."""
    res = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = res.scalar_one_or_none()
    if alert:
        alert.status = AlertStatus.CONFIRMED
        await db.commit()
    return {"status": "confirmed", "alert_id": alert_id}


@router.post("/{alert_id}/benign")
async def mark_benign(alert_id: str, body: AlertAction, db: AsyncSession = Depends(get_db)):
    """Mark an alert as benign (false positive)."""
    res = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = res.scalar_one_or_none()
    if alert:
        alert.status = AlertStatus.BENIGN
        await db.commit()
    return {"status": "benign", "alert_id": alert_id}
