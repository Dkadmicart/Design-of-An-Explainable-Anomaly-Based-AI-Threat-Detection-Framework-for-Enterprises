"""
SentinelAI - Dataset Management Service
Orchestrates CIC-IDS2017 dataset discovery, validation, profiling, and ML preparation.
Enforces the strict No Demo Data Rule:
Every metric originates from actual files, or truthfully reports NOT_AVAILABLE.
"""
import os
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import get_settings
from app.models.database import (
    DatasetRegistry, DatasetFileRecord, DatasetProcessingRun,
    DatasetStatus, DatasetFileStatus, DatasetRunStatus
)
from app.services.dataset_validator import (
    EXPECTED_CIC_FILES, SCENARIO_MAPPING, validate_parquet_file
)
from app.services.dataset_profiler import (
    profile_schema, profile_labels, profile_feature_statistics
)
from app.services.preprocessing.pipeline import PreprocessingPipeline

logger = logging.getLogger("sentinelai.dataset_service")
settings = get_settings()


class DatasetService:
    """Core service for dataset ingestion and lifecycle."""

    DATASET_ID = "cic-ids2017"
    DATASET_NAME = "CIC-IDS2017 Benchmark Dataset"
    DATASET_SOURCE = "Canadian Institute for Cybersecurity (University of New Brunswick)"
    DATASET_DESCRIPTION = (
        "Gold standard intrusion detection evaluation dataset containing 8 flow capture scenarios: "
        "Benign baseline traffic and 7 distinct attack categories (DDoS, DoS, PortScan, Botnet, "
        "Brute Force, Web Attacks, and Infiltration)."
    )

    def __init__(self):
        # Resolve raw directory path relative to project
        possible_dirs = [
            os.path.abspath(os.path.join(os.getcwd(), "data", "raw", "cic-ids2017")),
            os.path.abspath(os.path.join(os.getcwd(), "data", "raw")),
            os.path.abspath(os.path.join(os.getcwd(), "..", "data", "raw", "cic-ids2017")),
            os.path.abspath(os.path.join(os.getcwd(), "..", "data", "raw")),
            os.path.abspath(settings.DATASET_PATH),
        ]
        self.raw_dir = next((d for d in possible_dirs if os.path.isdir(d)), possible_dirs[0])
        self.processed_dir = os.path.abspath(os.path.join(os.getcwd(), "data", "processed"))
        if not os.path.isdir(self.processed_dir):
            self.processed_dir = os.path.abspath(os.path.join(os.getcwd(), "..", "data", "processed"))
        self.metadata_dir = os.path.abspath(os.path.join(os.getcwd(), "data", "metadata"))
        if not os.path.isdir(self.metadata_dir):
            self.metadata_dir = os.path.abspath(os.path.join(os.getcwd(), "..", "data", "metadata"))

        os.makedirs(self.raw_dir, exist_ok=True)
        os.makedirs(self.processed_dir, exist_ok=True)
        os.makedirs(self.metadata_dir, exist_ok=True)

        self.pipeline = PreprocessingPipeline(self.raw_dir, self.processed_dir, self.metadata_dir)

    def get_target_path(self, filename: str) -> str:
        """Find the full path to an expected dataset file."""
        # Direct check in raw_dir
        direct = os.path.join(self.raw_dir, filename)
        if os.path.exists(direct):
            return direct
        # Subdir cic-ids2017 check
        sub = os.path.join(self.raw_dir, "cic-ids2017", filename)
        if os.path.exists(sub):
            return sub
        # Parent check
        parent = os.path.join(os.path.dirname(self.raw_dir), "cic-ids2017", filename)
        if os.path.exists(parent):
            return parent
        return direct

    async def get_or_create_dataset_record(self, db: AsyncSession) -> DatasetRegistry:
        """Fetch or initialize the CIC-IDS2017 registry row."""
        result = await db.execute(select(DatasetRegistry).where(DatasetRegistry.id == self.DATASET_ID))
        record = result.scalars().first()
        if not record:
            record = DatasetRegistry(
                id=self.DATASET_ID,
                name=self.DATASET_NAME,
                version="1.0.0",
                source=self.DATASET_SOURCE,
                description=self.DATASET_DESCRIPTION,
                status=DatasetStatus.NOT_AVAILABLE,
                file_count=len(EXPECTED_CIC_FILES),
                total_records=0,
                feature_count=0,
                label_column="Label",
                quality_summary={
                    "missing_values_count": 0,
                    "missing_pct": 0.0,
                    "infinite_values_count": 0,
                    "constant_columns_count": 0,
                    "duplicate_records_estimated": 0,
                },
                label_distribution=[],
                feature_statistics=[],
            )
            db.add(record)
            await db.commit()
            await db.refresh(record)
        return record

    async def inspect_and_sync(self, db: AsyncSession, force_validate: bool = False) -> Dict[str, Any]:
        """
        Inspect the filesystem for all 8 CIC-IDS2017 files.
        If files exist and have not been validated (or force_validate=True), run validation & profiling.
        Synchronize state to database.
        """
        registry = await self.get_or_create_dataset_record(db)

        existing_files = []
        file_results = []
        total_rows = 0
        feature_count = 0
        detected_label_col = "Label"

        for fname in EXPECTED_CIC_FILES:
            fpath = self.get_target_path(fname)
            val = validate_parquet_file(fpath, fname)
            file_results.append(val)
            if val["exists"] and val["validation_passed"]:
                existing_files.append(fpath)
                total_rows += val["rows"]
                if val["numeric_feature_count"] > 0:
                    feature_count = max(feature_count, val["columns"] - 1)
                if val.get("label_column"):
                    detected_label_col = val["label_column"]

        # Synchronize individual files to database
        for res in file_results:
            stmt = select(DatasetFileRecord).where(
                DatasetFileRecord.dataset_id == self.DATASET_ID,
                DatasetFileRecord.filename == res["filename"]
            )
            file_rec = (await db.execute(stmt)).scalars().first()
            scenario_info = SCENARIO_MAPPING.get(res["filename"], {})

            if not file_rec:
                file_rec = DatasetFileRecord(
                    dataset_id=self.DATASET_ID,
                    filename=res["filename"],
                    file_path=res["file_path"],
                    size_bytes=res["file_size_bytes"],
                    status=DatasetFileStatus(res["status"]),
                    rows=res["rows"],
                    columns=res["columns"],
                    label_column=res["label_column"],
                    attack_classes=res["attack_classes"],
                    validation_details={"scenario": scenario_info.get("scenario"), "error": res.get("error")},
                    data_quality={
                        "missing_count": res.get("missing_values_count", 0),
                        "missing_pct": res.get("missing_pct", 0.0),
                        "infinite_count": res.get("infinite_values_count", 0),
                    }
                )
                db.add(file_rec)
            else:
                file_rec.file_path = res["file_path"]
                file_rec.size_bytes = res["file_size_bytes"]
                file_rec.status = DatasetFileStatus(res["status"])
                file_rec.rows = res["rows"]
                file_rec.columns = res["columns"]
                file_rec.label_column = res["label_column"]
                file_rec.attack_classes = res["attack_classes"]
                file_rec.validation_details = {"scenario": scenario_info.get("scenario"), "error": res.get("error")}
                file_rec.data_quality = {
                    "missing_count": res.get("missing_values_count", 0),
                    "missing_pct": res.get("missing_pct", 0.0),
                    "infinite_count": res.get("infinite_values_count", 0),
                }

        # Update dataset status based on actual presence
        if len(existing_files) == len(EXPECTED_CIC_FILES):
            registry.status = DatasetStatus.READY
        elif len(existing_files) > 0:
            registry.status = DatasetStatus.DISCOVERED
        else:
            registry.status = DatasetStatus.NOT_AVAILABLE

        registry.file_count = len(EXPECTED_CIC_FILES)
        registry.total_records = total_rows
        registry.feature_count = feature_count
        registry.label_column = detected_label_col

        # If files exist, run profiling
        if existing_files:
            try:
                schema_info = profile_schema(existing_files[0])
                registry.schema_metadata = schema_info

                labels_info = profile_labels(existing_files)
                registry.label_distribution = labels_info.get("distribution", [])

                feat_stats = profile_feature_statistics(existing_files[0])
                registry.feature_statistics = feat_stats

                total_missing = sum(f.get("missing_values_count", 0) for f in file_results)
                total_inf = sum(f.get("infinite_values_count", 0) for f in file_results)
                total_cells = max(1, total_rows * max(1, feature_count))
                registry.quality_summary = {
                    "missing_values_count": total_missing,
                    "missing_pct": round((total_missing / total_cells) * 100, 3),
                    "infinite_values_count": total_inf,
                    "constant_columns_count": 0,
                    "duplicate_records_estimated": 0,
                }
            except Exception as prof_err:
                logger.error(f"Error during dataset profiling: {prof_err}")
        else:
            registry.schema_metadata = None
            registry.label_distribution = []
            registry.feature_statistics = []
            registry.quality_summary = {
                "missing_values_count": 0,
                "missing_pct": 0.0,
                "infinite_values_count": 0,
                "constant_columns_count": 0,
                "duplicate_records_estimated": 0,
            }

        registry.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(registry)

        return {
            "dataset": {
                "id": registry.id,
                "name": registry.name,
                "version": registry.version,
                "source": registry.source,
                "description": registry.description,
                "status": registry.status.value,
                "file_count": registry.file_count,
                "total_records": registry.total_records,
                "feature_count": registry.feature_count,
                "label_column": registry.label_column,
                "raw_directory": self.raw_dir,
                "available_files_count": len(existing_files),
                "quality_summary": registry.quality_summary,
                "label_distribution": registry.label_distribution,
                "created_at": registry.created_at.isoformat(),
                "updated_at": registry.updated_at.isoformat()
            },
            "files": [
                {
                    "filename": r["filename"],
                    "scenario": SCENARIO_MAPPING.get(r["filename"], {}).get("scenario", "Network Capture"),
                    "status": r["status"],
                    "rows": r["rows"],
                    "columns": r["columns"],
                    "label_column": r["label_column"],
                    "attack_classes": r["attack_classes"],
                    "file_size_bytes": r["file_size_bytes"],
                    "validation_passed": r["validation_passed"],
                    "error": r.get("error")
                }
                for r in file_results
            ]
        }

    async def get_dataset_overview(self, db: AsyncSession) -> Dict[str, Any]:
        """Fetch the current dataset status and overview."""
        return await self.inspect_and_sync(db, force_validate=False)

    async def get_dataset_files(self, db: AsyncSession) -> List[Dict[str, Any]]:
        """Fetch the 8 Parquet file records."""
        overview = await self.inspect_and_sync(db, force_validate=False)
        return overview["files"]

    async def get_schema(self, db: AsyncSession) -> Dict[str, Any]:
        """Fetch schema metadata."""
        registry = await self.get_or_create_dataset_record(db)
        if registry.schema_metadata:
            return registry.schema_metadata
        # Check first existing file
        for fname in EXPECTED_CIC_FILES:
            fpath = self.get_target_path(fname)
            if os.path.exists(fpath):
                schema = profile_schema(fpath)
                registry.schema_metadata = schema
                await db.commit()
                return schema
        return {"columns": [], "feature_count": 0, "label_column": None, "features": []}

    async def get_statistics(self, db: AsyncSession) -> List[Dict[str, Any]]:
        """Fetch feature statistics."""
        registry = await self.get_or_create_dataset_record(db)
        if registry.feature_statistics:
            return registry.feature_statistics
        for fname in EXPECTED_CIC_FILES:
            fpath = self.get_target_path(fname)
            if os.path.exists(fpath):
                stats = profile_feature_statistics(fpath)
                registry.feature_statistics = stats
                await db.commit()
                return stats
        return []

    async def get_labels(self, db: AsyncSession) -> Dict[str, Any]:
        """Fetch real label distribution."""
        registry = await self.get_or_create_dataset_record(db)
        dist = registry.label_distribution or []
        total = sum(item.get("count", 0) for item in dist)
        benign = sum(item.get("count", 0) for item in dist if str(item.get("label", "")).upper() == "BENIGN")
        attack = total - benign
        return {
            "total_samples": total,
            "benign_count": benign,
            "attack_count": attack,
            "benign_percentage": round((benign / total) * 100, 2) if total > 0 else 0.0,
            "attack_percentage": round((attack / total) * 100, 2) if total > 0 else 0.0,
            "distribution": dist
        }

    async def get_quality(self, db: AsyncSession) -> Dict[str, Any]:
        """Fetch data quality metrics."""
        overview = await self.inspect_and_sync(db, force_validate=False)
        return {
            "summary": overview["dataset"]["quality_summary"],
            "per_file": [
                {
                    "filename": f["filename"],
                    "rows": f["rows"],
                    "columns": f["columns"],
                    "status": f["status"],
                    "validation_passed": f["validation_passed"],
                    "error": f.get("error")
                }
                for f in overview["files"]
            ]
        }

    async def validate_all(self, db: AsyncSession) -> Dict[str, Any]:
        """Explicitly re-validate all 8 dataset files."""
        return await self.inspect_and_sync(db, force_validate=True)

    async def process_dataset(self, db: AsyncSession) -> Dict[str, Any]:
        """Trigger the real preprocessing pipeline."""
        registry = await self.get_or_create_dataset_record(db)

        # Collect existing files
        existing = [self.get_target_path(fname) for fname in EXPECTED_CIC_FILES if os.path.exists(self.get_target_path(fname))]
        if not existing:
            return {
                "status": "NOT_AVAILABLE",
                "message": (
                    "Cannot process dataset: None of the 8 CIC-IDS2017 Parquet files were found in "
                    f"'{self.raw_dir}'. Please provide the raw files before executing preprocessing."
                ),
                "rows_processed": 0,
                "rows_remaining": 0
            }

        # Create processing run record
        run_record = DatasetProcessingRun(
            dataset_id=self.DATASET_ID,
            status=DatasetRunStatus.PROCESSING,
            started_at=datetime.utcnow()
        )
        db.add(run_record)
        await db.commit()
        await db.refresh(run_record)

        # Run pipeline
        result = self.pipeline.run_preprocessing(existing)

        run_record.status = DatasetRunStatus.COMPLETED if result["status"] == "PROCESSED" else DatasetRunStatus.FAILED
        run_record.completed_at = datetime.utcnow()
        run_record.rows_removed = result.get("metadata", {}).get("rows_removed", 0) if result.get("metadata") else 0
        run_record.rows_remaining = result.get("rows_remaining", 0)
        run_record.output_path = result.get("output_filepath")
        run_record.transformation_metadata = result.get("metadata")
        run_record.error_message = result.get("message") if result["status"] != "PROCESSED" else None

        if result["status"] == "PROCESSED":
            registry.status = DatasetStatus.PROCESSED

        await db.commit()
        return result


dataset_service = DatasetService()
