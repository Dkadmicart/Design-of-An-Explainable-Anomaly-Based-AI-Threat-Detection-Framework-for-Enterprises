"""
SentinelAI - CIC-IDS2017 Dataset Profiler
Extracts actual schema, label distributions, data quality metrics, and numeric feature statistics.
"""
import os
import logging
from typing import Dict, Any, List, Optional
import pyarrow.parquet as pq
import pyarrow.compute as pc
from app.services.dataset_validator import find_label_column

logger = logging.getLogger("sentinelai.dataset_profiler")


def profile_schema(parquet_file_path: str) -> Dict[str, Any]:
    """Inspect schema of a Parquet file without loading all rows."""
    if not os.path.exists(parquet_file_path):
        return {"columns": [], "feature_count": 0, "label_column": None, "features": []}

    try:
        pf = pq.ParquetFile(parquet_file_path)
        arrow_schema = pf.schema_arrow
        col_names = [f.name for f in arrow_schema]
        label_col = find_label_column(col_names)

        features = []
        for field in arrow_schema:
            is_label = (field.name == label_col)
            type_str = str(field.type)
            is_numeric = any(t in type_str.lower() for t in ("int", "float", "double"))
            
            features.append({
                "name": field.name,
                "data_type": type_str,
                "nullable": field.nullable,
                "is_label": is_label,
                "is_numeric": is_numeric,
                "category": "Label" if is_label else ("Numeric Feature" if is_numeric else "Categorical Feature")
            })

        return {
            "columns": col_names,
            "feature_count": len(features) - (1 if label_col else 0),
            "label_column": label_col,
            "features": features
        }
    except Exception as e:
        logger.error(f"Error profiling schema for {parquet_file_path}: {e}")
        return {"columns": [], "feature_count": 0, "label_column": None, "features": [], "error": str(e)}


def profile_labels(file_paths: List[str]) -> Dict[str, Any]:
    """Calculate actual label counts and percentage distribution from real Parquet files."""
    label_counts: Dict[str, int] = {}
    total_samples = 0

    for fpath in file_paths:
        if not os.path.exists(fpath):
            continue
        try:
            pf = pq.ParquetFile(fpath)
            col_names = [field.name for field in pf.schema_arrow]
            label_col = find_label_column(col_names)
            if not label_col:
                continue

            # Read only the label column batch by batch
            for batch in pf.iter_batches(columns=[label_col], batch_size=100_000):
                col_data = batch[label_col]
                value_counts = pc.value_counts(col_data)
                for entry in value_counts.to_pylist():
                    raw_val = entry["values"]
                    count = entry["counts"]
                    if raw_val is not None:
                        clean_label = str(raw_val).strip()
                        label_counts[clean_label] = label_counts.get(clean_label, 0) + count
                        total_samples += count

        except Exception as e:
            logger.error(f"Error reading labels from {fpath}: {e}")

    if total_samples == 0:
        return {
            "total_samples": 0,
            "benign_count": 0,
            "attack_count": 0,
            "benign_percentage": 0.0,
            "attack_percentage": 0.0,
            "distribution": []
        }

    benign_count = sum(count for lbl, count in label_counts.items() if lbl.upper() == "BENIGN")
    attack_count = total_samples - benign_count

    distribution = []
    for lbl, count in sorted(label_counts.items(), key=lambda x: x[1], reverse=True):
        pct = round((count / total_samples) * 100, 2)
        distribution.append({
            "label": lbl,
            "count": count,
            "percentage": pct,
            "is_attack": (lbl.upper() != "BENIGN")
        })

    return {
        "total_samples": total_samples,
        "benign_count": benign_count,
        "attack_count": attack_count,
        "benign_percentage": round((benign_count / total_samples) * 100, 2),
        "attack_percentage": round((attack_count / total_samples) * 100, 2),
        "distribution": distribution
    }


def profile_feature_statistics(parquet_file_path: str, max_features: int = 50) -> List[Dict[str, Any]]:
    """Compute descriptive statistics for numeric features (count, mean, std, min, median, max)."""
    if not os.path.exists(parquet_file_path):
        return []

    try:
        pf = pq.ParquetFile(parquet_file_path)
        arrow_schema = pf.schema_arrow
        label_col = find_label_column([f.name for f in arrow_schema])

        numeric_cols = [
            f.name for f in arrow_schema
            if f.name != label_col and any(t in str(f.type).lower() for t in ("int", "float", "double"))
        ][:max_features]

        if not numeric_cols:
            return []

        # Read sample row groups (or whole if manageable) to compute descriptive stats
        # For huge files, compute stats over first 2 row groups to stay ultra-fast
        groups_to_read = min(pf.num_row_groups, 2)
        tables = [pf.read_row_group(i, columns=numeric_cols) for i in range(groups_to_read)]
        combined_sample = pa_concat(tables) if len(tables) > 1 else tables[0]

        stats_list = []
        for col_name in numeric_cols:
            col_data = combined_sample[col_name]
            # Filter nulls & infs for safe math
            try:
                valid_mask = pc.is_valid(col_data)
                clean_data = pc.filter(col_data, valid_mask)
                count = len(clean_data)
                
                if count > 0:
                    mean_val = pc.mean(clean_data).as_py()
                    std_val = pc.stddev(clean_data).as_py()
                    min_val = pc.min(clean_data).as_py()
                    max_val = pc.max(clean_data).as_py()
                    # approximate median via quantile
                    median_val = pc.approximate_median(clean_data).as_py() if hasattr(pc, 'approximate_median') else pc.quantile(clean_data, q=0.5)[0].as_py()

                    stats_list.append({
                        "feature_name": col_name,
                        "data_type": str(col_data.type),
                        "count": count,
                        "mean": round(float(mean_val), 4) if mean_val is not None else 0.0,
                        "std": round(float(std_val), 4) if std_val is not None else 0.0,
                        "min": round(float(min_val), 4) if min_val is not None else 0.0,
                        "median": round(float(median_val), 4) if median_val is not None else 0.0,
                        "max": round(float(max_val), 4) if max_val is not None else 0.0,
                    })
            except Exception as col_err:
                logger.debug(f"Could not compute stats for column {col_name}: {col_err}")

        return stats_list

    except Exception as e:
        logger.error(f"Error computing feature statistics: {e}")
        return []


def pa_concat(tables):
    import pyarrow as pa
    return pa.concat_tables(tables)
