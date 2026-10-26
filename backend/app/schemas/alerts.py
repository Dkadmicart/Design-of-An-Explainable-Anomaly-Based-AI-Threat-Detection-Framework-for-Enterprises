"""Pydantic schemas for Alerts."""
from typing import Optional
from pydantic import BaseModel


class AlertAction(BaseModel):
    """Request body for alert triage actions."""
    notes: Optional[str] = None
