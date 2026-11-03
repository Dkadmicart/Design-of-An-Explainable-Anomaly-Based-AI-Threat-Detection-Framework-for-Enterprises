"""Settings API routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any

from app.database.session import get_db
from app.schemas.settings import SettingsUpdate, SettingsResponse
from app.services.settings_service import get_or_create_settings, update_settings

router = APIRouter()


@router.get("", response_model=Dict[str, Any])
async def get_settings(db: AsyncSession = Depends(get_db)):
    """Get current platform settings."""
    record = await get_or_create_settings(db)
    return {
        "detection_mode": record.detection_mode,
        "alert_threshold": float(record.alert_threshold),
        "replay_speed": float(record.replay_speed),
        "notifications_enabled": bool(record.notifications_enabled),
        "selected_model": record.selected_model,
        "selected_dataset": record.selected_dataset,
        "updated_at": record.updated_at.isoformat() if record.updated_at else None,
    }


@router.put("", response_model=Dict[str, Any])
async def update_settings_endpoint(
    payload: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update and persist platform settings."""
    record = await update_settings(db, payload)
    return {
        "status": "updated",
        "settings": {
            "detection_mode": record.detection_mode,
            "alert_threshold": float(record.alert_threshold),
            "replay_speed": float(record.replay_speed),
            "notifications_enabled": bool(record.notifications_enabled),
            "selected_model": record.selected_model,
            "selected_dataset": record.selected_dataset,
            "updated_at": record.updated_at.isoformat() if record.updated_at else None,
        },
    }
