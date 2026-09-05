"""Analytics API routes."""
from fastapi import APIRouter, Query, Depends
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database.session import get_db
from app.models.database import Event

router = APIRouter()


@router.get("/attack-distribution")
async def attack_distribution(db: AsyncSession = Depends(get_db)):
    """Get attack type distribution from database."""
    res = await db.execute(
        select(Event.attack_type, func.count(Event.id))
        .group_by(Event.attack_type)
    )
    rows = res.all()
    total = sum(c for _, c in rows) or 1
    distribution = [
        {"type": attack_type or "BENIGN", "count": count, "percentage": round((count / total) * 100, 2)}
        for attack_type, count in rows
    ]
    return {"distribution": distribution}


@router.get("/model-performance")
async def model_performance(model_id: Optional[str] = None):
    """Get model performance metrics."""
    return {"metrics": [], "message": "No model performance evaluation records"}


@router.get("/risk-trends")
async def risk_trends():
    """Get risk score trends over time."""
    return {"trends": []}
