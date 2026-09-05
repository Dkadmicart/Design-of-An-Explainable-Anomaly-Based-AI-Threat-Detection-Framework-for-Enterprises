"""Settings API routes."""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class SettingsUpdate(BaseModel):
    """Settings update request."""
    detection_mode: Optional[str] = None
    alert_threshold: Optional[float] = None
    replay_speed: Optional[float] = None
    notifications_enabled: Optional[bool] = None
    selected_model: Optional[str] = None
    selected_dataset: Optional[str] = None


@router.get("")
async def get_settings():
    """Get current platform settings."""
    return {
        "detection_mode": "binary",
        "alert_threshold": 50.0,
        "replay_speed": 1.0,
        "notifications_enabled": True,
        "selected_model": "Random Forest",
        "selected_dataset": "CIC-IDS2017",
    }


@router.put("")
async def update_settings(settings: SettingsUpdate):
    """Update platform settings."""
    return {"status": "updated", "settings": settings.model_dump(exclude_none=True)}
