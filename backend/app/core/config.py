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
    
    # Security & Authentication
    SECRET_KEY: str = "sentinelai-enterprise-secret-key-production-change-me"
    API_KEY_HEADER: str = "X-API-Key"
    JWT_SECRET_KEY: str = "sentinelai-jwt-secret-key-secure-enterprise-token-2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    COOKIE_SECURE: bool = False  # Set to True in HTTPS production
    COOKIE_SAMESITE: str = "lax"
    GOOGLE_CLIENT_ID: str = ""
    RATE_LIMIT_MAX_ATTEMPTS: int = 5
    RATE_LIMIT_WINDOW_MINUTES: int = 15
    
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
