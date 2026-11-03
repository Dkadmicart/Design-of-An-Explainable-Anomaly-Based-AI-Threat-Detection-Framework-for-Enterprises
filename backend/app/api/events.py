"""Events API routes."""
from fastapi import APIRouter, Query, Depends, HTTPException
from typing import Optional, Dict, Any
from datetime import timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database.session import get_db
from app.models.database import Event

router = APIRouter()


def format_event_response(e: Event) -> Dict[str, Any]:
    """Serialize Event model to dictionary with explicit UTC ISO timestamps."""
    ts = e.timestamp
    if ts is not None and ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    ts_str = ts.isoformat() if ts else None

    cat = e.created_at
    if cat is not None and cat.tzinfo is None:
        cat = cat.replace(tzinfo=timezone.utc)
    cat_str = cat.isoformat() if cat else None

    return {
        "id": e.id,
        "timestamp": ts_str,
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
        "flow_bytes_per_sec": e.flow_bytes_per_sec,
        "flow_packets_per_sec": e.flow_packets_per_sec,
        "features": e.features,
        "prediction": e.prediction,
        "confidence": e.confidence,
        "anomaly_score": e.anomaly_score,
        "risk_score": e.risk_score,
        "attack_type": e.attack_type,
        "model_version": e.model_version,
        "model_name": e.model_name,
        "dataset_source": e.dataset_source,
        "created_at": cat_str,
    }


@router.get("")
async def list_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    protocol: Optional[str] = None,
    attack_type: Optional[str] = None,
    source_ip: Optional[str] = None,
    destination_ip: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """List network events with filtering and pagination from database."""
    query = select(Event)
    count_query = select(func.count(Event.id))

    if protocol:
        query = query.where(Event.protocol == protocol)
        count_query = count_query.where(Event.protocol == protocol)
    if attack_type:
        query = query.where(Event.attack_type == attack_type)
        count_query = count_query.where(Event.attack_type == attack_type)
    if source_ip:
        query = query.where(Event.source_ip == source_ip)
        count_query = count_query.where(Event.source_ip == source_ip)
    if destination_ip:
        query = query.where(Event.destination_ip == destination_ip)
        count_query = count_query.where(Event.destination_ip == destination_ip)

    total_res = await db.execute(count_query)
    total = total_res.scalar() or 0

    query = query.order_by(Event.timestamp.desc()).offset((page - 1) * page_size).limit(page_size)
    events_res = await db.execute(query)
    events = events_res.scalars().all()

    return {
        "events": [format_event_response(e) for e in events],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{event_id}")
async def get_event(event_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single event by ID."""
    res = await db.execute(select(Event).where(Event.id == event_id))
    event = res.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"event": format_event_response(event)}
