"""Pydantic schemas for System Settings."""
from typing import Optional
from pydantic import BaseModel


class SettingsUpdate(BaseModel):
    """Settings update request."""
    detection_mode: Optional[str] = None
    alert_threshold: Optional[float] = None
    replay_speed: Optional[float] = None
    notifications_enabled: Optional[bool] = None
    selected_model: Optional[str] = None
    selected_dataset: Optional[str] = None
