"""Pydantic schemas for Dataset Replay."""
from typing import Optional
from pydantic import BaseModel


class ReplayConfig(BaseModel):
    """Replay configuration."""
    speed: float = 1.0
    dataset_file: Optional[str] = None
    batch_size: Optional[int] = 100
    loop: Optional[bool] = False
