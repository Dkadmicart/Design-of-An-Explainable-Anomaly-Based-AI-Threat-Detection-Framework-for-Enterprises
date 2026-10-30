"""
Unit and integration tests for SentinelAI Dataset Ingestion, Validation, and Preprocessing.
"""
import os
import tempfile
import pytest
import pyarrow as pa
import pyarrow.parquet as pq

from app.services.dataset_validator import validate_parquet_file, find_label_column
from app.services.dataset_profiler import profile_schema, profile_labels, profile_feature_statistics
from app.services.preprocessing.pipeline import PreprocessingPipeline


def test_find_label_column():
    cols = ["Destination Port", "Flow Duration", "Label"]
    assert find_label_column(cols) == "Label"
    
    cols2 = ["destination_port", "flow_duration", "label"]
    assert find_label_column(cols2) == "label"

    cols_none = ["fwd_packets", "bwd_packets"]
    assert find_label_column(cols_none) is None


def test_validate_nonexistent_file():
    res = validate_parquet_file("/nonexistent/path/test.parquet", "test.parquet")
    assert res["exists"] is False
    assert res["status"] == "NOT_FOUND"
    assert res["validation_passed"] is False
    assert res["rows"] == 0


def test_validate_and_profile_real_parquet():
    """Create a temporary real Parquet file and run validation, schema, labels, and stats on it."""
    with tempfile.TemporaryDirectory() as tmpdir:
        test_file = os.path.join(tmpdir, "DDoS-Friday-no-metadata.parquet")

        # Create realistic Arrow table
        schema = pa.schema([
            ("Destination Port", pa.int32()),
            ("Flow Duration", pa.float64()),
            ("Total Fwd Packets", pa.int32()),
            ("Label", pa.string()),
        ])
        data = [
            pa.array([80, 443, 80, 8080, 80]),
            pa.array([1200.5, 340.0, 50.2, 900.0, 110.0]),
            pa.array([10, 2, 100, 5, 20]),
            pa.array(["BENIGN", "BENIGN", "DDoS", "BENIGN", "DDoS"]),
        ]
        table = pa.Table.from_arrays(data, schema=schema)
        pq.write_table(table, test_file)

        # 1. Test validation
        val_res = validate_parquet_file(test_file, "DDoS-Friday-no-metadata.parquet")
        assert val_res["exists"] is True
        assert val_res["status"] == "VALID"
        assert val_res["rows"] == 5
        assert val_res["columns"] == 4
        assert val_res["label_column"] == "Label"
        assert "DDoS" in val_res["attack_classes"]
        assert "BENIGN" in val_res["attack_classes"]
        assert val_res["validation_passed"] is True

        # 2. Test schema profiling
        schema_res = profile_schema(test_file)
        assert schema_res["feature_count"] == 3
        assert schema_res["label_column"] == "Label"
        assert len(schema_res["features"]) == 4

        # 3. Test label profiling
        label_res = profile_labels([test_file])
        assert label_res["total_samples"] == 5
        assert label_res["benign_count"] == 3
        assert label_res["attack_count"] == 2
        assert label_res["benign_percentage"] == 60.0
        assert label_res["attack_percentage"] == 40.0

        # 4. Test feature statistics
        stats = profile_feature_statistics(test_file)
        assert len(stats) >= 2
        port_stat = next(s for s in stats if s["feature_name"] == "Destination Port")
        assert port_stat["min"] == 80.0
        assert port_stat["max"] == 8080.0

        # 5. Test Preprocessing Pipeline
        proc_dir = os.path.join(tmpdir, "processed")
        meta_dir = os.path.join(tmpdir, "metadata")
        pipe = PreprocessingPipeline(tmpdir, proc_dir, meta_dir)
        pipe_res = pipe.run_preprocessing([test_file])
        assert pipe_res["status"] == "PROCESSED"
        assert pipe_res["rows_remaining"] == 5
        assert os.path.exists(pipe_res["output_filepath"])
