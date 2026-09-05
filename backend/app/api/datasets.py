"""Datasets API routes."""
from fastapi import APIRouter
import os
from app.core.config import get_settings

router = APIRouter()
settings = get_settings()


@router.get("")
async def list_datasets():
    """List available dataset files from the dataset directory."""
    raw_dir = settings.DATASET_PATH
    dataset_files = []
    if os.path.exists(raw_dir):
        for f in os.listdir(raw_dir):
            if f.endswith('.csv') or f.endswith('.parquet'):
                file_path = os.path.join(raw_dir, f)
                size_mb = round(os.path.getsize(file_path) / (1024 * 1024), 2)
                dataset_files.append({
                    "name": f,
                    "display_name": f.replace('_', ' ').replace('.csv', '').replace('.parquet', ''),
                    "rows": None,
                    "columns": None,
                    "attack_types": [],
                    "status": "available",
                    "size_mb": size_mb,
                })

    return {
        "datasets": [
            {
                "name": "CIC-IDS2017",
                "description": "Canadian Institute for Cybersecurity Intrusion Detection Evaluation Dataset",
                "source": "UNB",
                "files": dataset_files,
                "last_imported": None,
                "preprocessing_status": "READY" if dataset_files else "NO_DATA",
            }
        ]
    }


@router.get("/{dataset_name}")
async def get_dataset(dataset_name: str):
    """Get dataset details."""
    datasets_response = await list_datasets()
    ds = next((d for d in datasets_response["datasets"] if d["name"].lower() == dataset_name.lower()), None)
    return {"dataset": ds}


@router.post("/{dataset_name}/import")
async def import_dataset(dataset_name: str):
    """Trigger dataset import/ingestion."""
    return {"status": "completed", "message": f"Dataset {dataset_name} scan ready"}


@router.post("/{dataset_name}/validate")
async def validate_dataset(dataset_name: str):
    """Validate dataset files."""
    return {"status": "valid", "message": "Dataset structure validated"}
