"""Events API routes."""
from fastapi import APIRouter, Query, Depends, HTTPException
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database.session import get_db
from app.models.database import Event

router = APIRouter()


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
        "events": events,
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
    return {"event": event}
