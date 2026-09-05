"""Investigation API routes."""
from fastapi import APIRouter, Query, Depends
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.database.session import get_db
from app.models.database import Event, Alert

router = APIRouter()


@router.get("/search")
async def search(
    q: str = Query(..., description="Search query: IP, domain, port, alert ID, event ID"),
    db: AsyncSession = Depends(get_db),
):
    """Search for entities across events, alerts, and investigations."""
    events_res = await db.execute(
        select(Event).where(
            or_(
                Event.source_ip.contains(q),
                Event.destination_ip.contains(q),
                Event.attack_type.contains(q),
                Event.id == q,
            )
        ).limit(20)
    )
    events = events_res.scalars().all()
    return {
        "query": q,
        "results": events,
        "total": len(events),
    }


@router.get("/ip/{ip_address}")
async def investigate_ip(ip_address: str, db: AsyncSession = Depends(get_db)):
    """Get investigation summary for an IP address."""
    events_res = await db.execute(
        select(Event).where(
            or_(Event.source_ip == ip_address, Event.destination_ip == ip_address)
        ).order_by(Event.timestamp.desc()).limit(100)
    )
    events = events_res.scalars().all()

    first_seen = events[-1].timestamp.isoformat() if events else None
    last_seen = events[0].timestamp.isoformat() if events else None
    attack_types = list({e.attack_type for e in events if e.attack_type})

    return {
        "ip": ip_address,
        "first_seen": first_seen,
        "last_seen": last_seen,
        "total_events": len(events),
        "attack_types": attack_types,
        "risk_history": [{"time": e.timestamp.isoformat(), "risk": e.risk_score or 0} for e in events[:10]],
        "events": events,
    }
