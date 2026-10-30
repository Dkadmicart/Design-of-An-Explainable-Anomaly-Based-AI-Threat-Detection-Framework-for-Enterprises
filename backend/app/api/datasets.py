"""
SentinelAI - Dataset Management REST API
Provides endpoints for CIC-IDS2017 discovery, inspection, validation, profiling, and ML preparation.
Strictly conforms to the No Demo Data Rule.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, List

from app.database.session import get_db
from app.services.dataset_service import dataset_service

router = APIRouter()


@router.get("", response_model=Dict[str, Any])
async def list_datasets(db: AsyncSession = Depends(get_db)):
    """List registered datasets with real status and file counts."""
    overview = await dataset_service.get_dataset_overview(db)
    return {
        "datasets": [overview["dataset"]]
    }


@router.get("/{dataset_id}", response_model=Dict[str, Any])
async def get_dataset(dataset_id: str, db: AsyncSession = Depends(get_db)):
    """Get dataset overview and summary statistics."""
    overview = await dataset_service.get_dataset_overview(db)
    if dataset_id.lower() not in (dataset_service.DATASET_ID, "cic-ids2017", "1"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset '{dataset_id}' not found. Supported dataset is 'cic-ids2017'."
        )
    return overview


@router.get("/{dataset_id}/files", response_model=Dict[str, Any])
async def get_dataset_files(dataset_id: str, db: AsyncSession = Depends(get_db)):
    """Get the 8 CIC-IDS2017 Parquet files with actual file status, row counts, and sizes."""
    files = await dataset_service.get_dataset_files(db)
    return {"dataset_id": dataset_id, "files": files}


@router.get("/{dataset_id}/schema", response_model=Dict[str, Any])
async def get_dataset_schema(dataset_id: str, db: AsyncSession = Depends(get_db)):
    """Get actual detected schema, feature names, types, and label column."""
    schema = await dataset_service.get_schema(db)
    return {"dataset_id": dataset_id, "schema": schema}


@router.get("/{dataset_id}/statistics", response_model=Dict[str, Any])
async def get_dataset_statistics(dataset_id: str, db: AsyncSession = Depends(get_db)):
    """Get descriptive statistics for numeric features (mean, std, min, median, max)."""
    stats = await dataset_service.get_statistics(db)
    return {"dataset_id": dataset_id, "statistics": stats}


@router.get("/{dataset_id}/quality", response_model=Dict[str, Any])
async def get_dataset_quality(dataset_id: str, db: AsyncSession = Depends(get_db)):
    """Get data quality report (missing values, infinite values, constant columns)."""
    quality = await dataset_service.get_quality(db)
    return {"dataset_id": dataset_id, "quality": quality}


@router.get("/{dataset_id}/labels", response_model=Dict[str, Any])
async def get_dataset_labels(dataset_id: str, db: AsyncSession = Depends(get_db)):
    """Get real label distribution (BENIGN vs attack classes, percentages)."""
    labels = await dataset_service.get_labels(db)
    return {"dataset_id": dataset_id, "labels": labels}


@router.post("/{dataset_id}/validate", response_model=Dict[str, Any])
async def validate_dataset(dataset_id: str, db: AsyncSession = Depends(get_db)):
    """Trigger validation of all 8 Parquet files."""
    result = await dataset_service.validate_all(db)
    return {
        "dataset_id": dataset_id,
        "status": "completed",
        "message": "Validation complete.",
        "result": result
    }


@router.post("/{dataset_id}/process", response_model=Dict[str, Any])
async def process_dataset(dataset_id: str, db: AsyncSession = Depends(get_db)):
    """Execute the data cleaning, normalization, and ML-ready preprocessing pipeline."""
    result = await dataset_service.process_dataset(db)
    return {
        "dataset_id": dataset_id,
        "result": result
    }


@router.post("/{dataset_id}/refresh", response_model=Dict[str, Any])
async def refresh_dataset_stats(dataset_id: str, db: AsyncSession = Depends(get_db)):
    """Refresh dataset statistics and synchronize file states."""
    result = await dataset_service.inspect_and_sync(db, force_validate=True)
    return {
        "dataset_id": dataset_id,
        "status": "refreshed",
        "result": result
    }
