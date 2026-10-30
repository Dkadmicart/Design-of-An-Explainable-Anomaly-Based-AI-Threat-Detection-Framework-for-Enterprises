"""
SentinelAI - XGBoost Threat Detection Engine
Wraps the trained CIC-IDS2017 XGBoost model, imputer, and feature definitions.
Implements the DetectionModel interface and provides native TreeSHAP explainability.
"""
import os
import json
import logging
from typing import Dict, List, Optional, Any, Tuple
import joblib
import numpy as np
import pandas as pd
import xgboost as xgb

from app.ml.base import (
    DetectionModel,
    PredictionResult,
    ExplanationResult,
    RiskScorer,
)

logger = logging.getLogger("sentinelai.ml.xgboost")

# Default artifacts directory relative to this file
ARTIFACTS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "artifacts")
)


class XGBoostDetector(DetectionModel):
    """Production detection model wrapping saved CIC-IDS2017 XGBoost classifier.

    Attributes:
        model: Trained XGBClassifier or Booster
        imputer: Fitted SimpleImputer (median strategy)
        feature_columns: Ordered list of exactly 69 feature names
        metadata: Model training metadata (versions, hyperparameters, etc.)
    """

    def __init__(self, artifacts_dir: str = ARTIFACTS_DIR):
        self.artifacts_dir = artifacts_dir
        self.model_name = "XGBoost Grouped Classifier"
        self.model_version = "v1.0.0"
        self.model_type = "Gradient Boosted Trees"

        # Load artifacts
        self.feature_columns: List[str] = self._load_feature_columns()
        self.imputer = self._load_imputer()
        self.model: xgb.XGBClassifier = self._load_model()
        self.booster: xgb.Booster = self.model.get_booster()
        self.metadata: Dict[str, Any] = self._load_metadata()

        logger.info(
            "XGBoostDetector initialized successfully with %d features.",
            len(self.feature_columns),
        )

    # ─── Artifact Loaders ───────────────────────────────────────────────────

    def _load_feature_columns(self) -> List[str]:
        """Load ordered 69 feature column names from joblib or json."""
        joblib_path = os.path.join(self.artifacts_dir, "feature_columns.joblib")
        json_path = os.path.join(self.artifacts_dir, "feature_columns.json")

        if os.path.exists(joblib_path):
            cols = joblib.load(joblib_path)
            return list(cols)
        elif os.path.exists(json_path):
            with open(json_path, "r", encoding="utf-8") as f:
                return list(json.load(f))
        else:
            raise FileNotFoundError(
                f"Feature columns artifact not found in {self.artifacts_dir}"
            )

    def _load_imputer(self):
        """Load SimpleImputer with runtime compatibility safeguards.

        Artifact Compatibility Note:
        The imputer was fitted using scikit-learn 1.6.1, which serialized `_fit_dtype`.
        In newer scikit-learn releases (1.9+), `transform` references `_fill_dtype`.
        We safely ensure `_fill_dtype` is present, while also keeping `statistics_`
        available as an infallible NumPy fallback if scikit-learn internals change.
        """
        imputer_path = os.path.join(self.artifacts_dir, "imputer.joblib")
        if not os.path.exists(imputer_path):
            raise FileNotFoundError(
                f"Imputer artifact not found in {self.artifacts_dir}"
            )

        imputer = joblib.load(imputer_path)

        # Scikit-learn 1.6 -> 1.9 compatibility patch
        if not hasattr(imputer, "_fill_dtype") and hasattr(imputer, "_fit_dtype"):
            try:
                setattr(imputer, "_fill_dtype", getattr(imputer, "_fit_dtype"))
            except Exception as exc:
                logger.warning("Could not set _fill_dtype on imputer: %s", exc)

        return imputer

    def _load_model(self) -> xgb.XGBClassifier:
        """Load trained XGBoost grouped classifier model."""
        model_path = os.path.join(self.artifacts_dir, "xgboost_grouped_model.joblib")
        if not os.path.exists(model_path):
            raise FileNotFoundError(
                f"Model artifact not found in {self.artifacts_dir}"
            )

        model = joblib.load(model_path)
        return model

    def _load_metadata(self) -> Dict[str, Any]:
        """Load training metadata if available."""
        meta_path = os.path.join(self.artifacts_dir, "metadata.json")
        if os.path.exists(meta_path):
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.warning("Failed to parse metadata.json: %s", e)
        return {
            "project": "SentinelAI",
            "dataset": "CIC-IDS2017",
            "task": "binary classification",
            "n_features": len(self.feature_columns),
        }

    # ─── Input Validation & Vector Alignment ────────────────────────────────

    def validate_features(self, features: Dict[str, Any]) -> Dict[str, float]:
        """Validate input features dictionary.

        Raises ValueError if:
        - Payload is empty or not a dict.
        - No recognized features from the 69-feature list are present.
        - Any provided feature value cannot be cast to a float.
        - All feature values are null or NaN.

        Returns cleaned dictionary of valid float values.
        """
        if not features or not isinstance(features, dict):
            raise ValueError("Input features payload must be a non-empty dictionary.")

        cleaned: Dict[str, float] = {}
        recognized_count = 0
        non_null_count = 0

        # Known feature lookup set for fast O(1) membership checks
        known_set = set(self.feature_columns)

        for key, val in features.items():
            if key in known_set:
                recognized_count += 1
                if val is not None:
                    try:
                        f_val = float(val)
                        if not np.isnan(f_val):
                            non_null_count += 1
                        cleaned[key] = f_val
                    except (ValueError, TypeError):
                        raise ValueError(
                            f"Invalid non-numeric value for feature '{key}': received '{val}'"
                        )
                else:
                    cleaned[key] = np.nan

        if recognized_count == 0:
            raise ValueError(
                f"No recognized CIC-IDS2017 features provided in request. "
                f"Must include at least one valid feature from the 69 model inputs."
            )

        if non_null_count == 0:
            raise ValueError(
                "All provided feature values are null or NaN. Essential input data is absent."
            )

        return cleaned

    def prepare_feature_array(self, features: Dict[str, Any]) -> Tuple[np.ndarray, np.ndarray]:
        """Transform validated features dictionary into a 69-feature imputed array.

        Returns:
            Tuple of (raw_array_with_nans, imputed_array), both shape (1, 69).
        """
        cleaned = self.validate_features(features)

        # Build raw array preserving exact 69 feature ordering
        raw_row = np.array(
            [cleaned.get(col, np.nan) for col in self.feature_columns],
            dtype=np.float64,
        ).reshape(1, -1)

        raw_df = pd.DataFrame(raw_row, columns=self.feature_columns)

        # Impute missing features
        try:
            imputed_df = self.imputer.transform(raw_df)
            imputed = np.asarray(imputed_df, dtype=np.float64)
        except Exception as exc:
            # Fallback using verified imputer statistics_ (median) if transform fails
            logger.warning("Imputer transform fallback triggered: %s", exc)
            if hasattr(self.imputer, "statistics_"):
                imputed = np.where(np.isnan(raw_row), self.imputer.statistics_, raw_row)
            else:
                raise RuntimeError(f"Imputation failed and no statistics_ available: {exc}")

        return raw_row, imputed

    # ─── DetectionModel Implementation ──────────────────────────────────────

    def predict(self, features: Dict[str, float]) -> PredictionResult:
        """Make a single prediction."""
        _, imputed = self.prepare_feature_array(features)
        raw_pred = int(self.model.predict(imputed)[0])
        probas = self.model.predict_proba(imputed)[0]

        p_benign = float(probas[0])
        p_attack = float(probas[1])

        label = "ATTACK" if raw_pred == 1 else "BENIGN"
        confidence = p_attack if label == "ATTACK" else p_benign

        return PredictionResult(
            prediction=label,
            confidence=round(confidence, 4),
            probabilities={
                "BENIGN": round(p_benign, 4),
                "ATTACK": round(p_attack, 4),
            },
            model_name=self.model_name,
            model_version=self.model_version,
        )

    def predict_batch(self, feature_batch: List[Dict[str, float]]) -> List[PredictionResult]:
        """Make predictions on a batch of features."""
        if not feature_batch:
            return []
        return [self.predict(f) for f in feature_batch]

    def predict_proba(self, features: Dict[str, float]) -> Dict[str, float]:
        """Return class probabilities."""
        pred = self.predict(features)
        return pred.probabilities

    def explain(self, features: Dict[str, float], top_k: int = 10) -> ExplanationResult:
        """Explain prediction using native XGBoost TreeSHAP contributions.

        Returns feature contributions (in log-odds margin space), raw values,
        and the bias (base value), adhering strictly to TreeSHAP semantics.
        """
        raw_row, imputed = self.prepare_feature_array(features)

        # Calculate native TreeSHAP contributions via XGBoost booster
        dmatrix = xgb.DMatrix(imputed)
        contribs = self.booster.predict(dmatrix, pred_contribs=True)[0]

        feature_contribs = contribs[:-1]
        bias_val = float(contribs[-1])

        # Rank features by absolute magnitude of contribution
        abs_indices = np.argsort(np.abs(feature_contribs))[::-1]
        top_indices = abs_indices[:top_k]

        total_abs_top = float(np.sum(np.abs(feature_contribs[top_indices]))) or 1.0

        contributions: List[Dict[str, Any]] = []
        for idx in top_indices:
            feat_name = self.feature_columns[idx]
            shap_val = float(feature_contribs[idx])
            raw_val = raw_row[0, idx]
            imputed_val = float(imputed[0, idx])

            display_val = (
                f"{raw_val:.2f}" if not np.isnan(raw_val) else f"{imputed_val:.2f} (imputed)"
            )

            contributions.append({
                "feature": feat_name,
                "display_name": feat_name,
                "raw_value": display_val,
                "imputed_value": round(imputed_val, 4),
                "shap_value": round(shap_val, 4),
                "impact": "malicious" if shap_val >= 0 else "benign",
                "percentage": round((abs(shap_val) / total_abs_top) * 100, 1),
            })

        return ExplanationResult(
            feature_contributions=contributions,
            method="TreeSHAP (additive log-odds margin attribution)",
            model_name=self.model_name,
        )

    def get_info(self) -> Dict[str, Any]:
        """Return model metadata."""
        return {
            "id": "xgboost-cicids2017-v1",
            "name": self.model_name,
            "version": self.model_version,
            "model_type": self.model_type,
            "status": "ACTIVE",
            "description": (
                "Supervised gradient-boosted binary classifier trained on CIC-IDS2017 "
                "telemetry flows with 69 features, evaluated for network intrusion detection."
            ),
            "trained_at": "2026-10-27T00:00:00Z",
            "training_dataset": "CIC-IDS2017 Benchmark",
            "n_features": len(self.feature_columns),
            "feature_columns": self.feature_columns,
            "hyperparameters": {
                "objective": "binary:logistic",
                "eval_metric": "logloss",
                "n_features": len(self.feature_columns),
            },
        }

    # ─── High-Level Scoring Service ─────────────────────────────────────────

    def score(
        self,
        features: Dict[str, Any],
        attack_type: Optional[str] = None,
        historical_risk: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Calculate complete threat assessment using RiskScorer.

        Carefully separates:
        - model confidence (probability of predicted class)
        - anomaly score (probability of attack class 0.0 - 1.0)
        - risk score (composite score 0.0 - 100.0 via RiskScorer)
        - severity level (LOW, MEDIUM, HIGH, CRITICAL)
        """
        pred_result = self.predict(features)
        anomaly_score = pred_result.probabilities["ATTACK"]

        # If attack_type not explicitly given, label as ATTACK or None
        effective_attack_type = attack_type or (
            "ATTACK" if pred_result.prediction == "ATTACK" else "BENIGN"
        )

        risk_score = RiskScorer.calculate(
            prediction=pred_result.prediction,
            confidence=pred_result.confidence,
            anomaly_score=anomaly_score,
            attack_type=effective_attack_type,
            historical_risk=historical_risk,
        )

        severity = RiskScorer.categorize(risk_score)

        return {
            "prediction": pred_result.prediction,
            "confidence": pred_result.confidence,
            "probabilities": pred_result.probabilities,
            "anomaly_score": round(anomaly_score, 4),
            "risk_score": risk_score,
            "severity": severity,
            "attack_type": effective_attack_type if pred_result.prediction == "ATTACK" else None,
            "model_name": self.model_name,
            "model_version": self.model_version,
        }


# ─── Singleton Accessor ─────────────────────────────────────────────────────

_detector_instance: Optional[XGBoostDetector] = None


def get_xgboost_detector() -> XGBoostDetector:
    """Return cached singleton instance of XGBoostDetector."""
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = XGBoostDetector()
    return _detector_instance
