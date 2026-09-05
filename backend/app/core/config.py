"""
SentinelAI - Core Configuration Module
"""
from pydantic_settings import BaseSettings
from typing import List
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Application
    APP_NAME: str = "SentinelAI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./sentinelai.db"
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]
    
    # Security
    SECRET_KEY: str = "change-me-in-production-use-a-strong-random-key"
    API_KEY_HEADER: str = "X-API-Key"
    
    # ML
    ML_MODEL_PATH: str = "./ml/artifacts"
    
    # Dataset
    DATASET_PATH: str = "./data/raw"
    PROCESSED_DATA_PATH: str = "./data/processed"
    
    # Replay Engine
    DEFAULT_REPLAY_SPEED: float = 1.0
    MAX_REPLAY_SPEED: float = 10.0
    REPLAY_BATCH_SIZE: int = 100
    
    # Alert Thresholds
    ALERT_RISK_THRESHOLD: float = 50.0
    CRITICAL_RISK_THRESHOLD: float = 75.0
    
    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True
    }


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
