"""
SentinelAI - FastAPI Application Entry Point
Enterprise Cybersecurity Threat Detection & Investigation Platform
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.database.session import create_tables, async_session
from app.auth.service import seed_default_users
from app.auth.routes import router as auth_router
from app.api import (
    dashboard, events, alerts, models, mitre,
    datasets, replay, investigate, analytics, system, settings as settings_router
)

settings = get_settings()

# Structured logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("sentinelai")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    logger.info("SentinelAI starting up...")
    await create_tables()
    logger.info("Database tables created/verified.")
    async with async_session() as session:
        await seed_default_users(session)
    logger.info("Enterprise default users seeded/verified.")
    yield
    logger.info("SentinelAI shutting down...")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Enterprise Cybersecurity Threat Detection & Investigation Platform",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(events.router, prefix="/api/events", tags=["Events"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(models.router, prefix="/api/models", tags=["Models"])
app.include_router(mitre.router, prefix="/api/mitre", tags=["MITRE ATT&CK"])
app.include_router(datasets.router, prefix="/api/datasets", tags=["Datasets"])
app.include_router(replay.router, prefix="/api/replay", tags=["Replay"])
app.include_router(investigate.router, prefix="/api/investigate", tags=["Investigate"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(system.router, prefix="/api/system", tags=["System"])
app.include_router(settings_router.router, prefix="/api/settings", tags=["Settings"])


@app.get("/api/health")
async def health_check():
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }
