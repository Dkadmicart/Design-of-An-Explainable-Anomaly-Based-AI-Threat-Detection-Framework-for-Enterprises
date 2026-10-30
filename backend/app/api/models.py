"""
SentinelAI - ML Models API Endpoints
Provides model registry, real-time threat inference, and TreeSHAP explainability.
"""
import logging
from typing import Dict, Any, Optional
import numpy as np
import xgboost as xgb
from fastapi import APIRouter, HTTPException, Path

from app.ml.xgboost_detector import get_xgboost_detector
from app.schemas.models import (
    ModelPredictRequest,
    ModelPredictResponse,
    ModelExplainRequest,
    ModelExplainResponse,
    ModelFeatureContribution,
)

logger = logging.getLogger("sentinelai.api.models")
router = APIRouter()

EXPLANATION_DISCLAIMER = (
    "Feature contributions are additive log-odds values calculated via TreeSHAP for tree ensembles. "
    "Positive values push the model toward predicting an anomaly/attack; negative values push toward "
    "benign traffic. They reflect feature influence on the model margin, not probabilities or causal explanations."
)


def _get_active_detector_or_404(model_id: Optional[str] = None):
    """Retrieve the active detector or raise 404 for unknown model IDs."""
    detector = get_xgboost_detector()
    if model_id and model_id.lower() not in [
        detector.get_info()["id"].lower(),
        "active",
        "xgboost",
        "default",
    ]:
        raise HTTPException(
            status_code=404,
            detail=f"Model '{model_id}' not found in registry. Active model is '{detector.get_info()['id']}'."
        )
    return detector


@router.get("")
async def list_models():
    """List all registered and active ML models."""
    detector = get_xgboost_detector()
    info = detector.get_info()
    return {"models": [info]}


@router.get("/{model_id}")
async def get_model(model_id: str = Path(..., description="Model ID or 'active'")):
    """Get model metadata and architectural specifications."""
    detector = _get_active_detector_or_404(model_id)
    return {"model": detector.get_info()}


@router.get("/{model_id}/features")
async def get_model_features(model_id: str = Path(..., description="Model ID or 'active'")):
    """Get the ordered 69 CIC-IDS2017 feature inputs expected by the model."""
    detector = _get_active_detector_or_404(model_id)
    return {
        "model_id": detector.get_info()["id"],
        "n_features": len(detector.feature_columns),
        "features": detector.feature_columns,
    }


@router.get("/{model_id}/metrics")
async def get_model_metrics(model_id: str = Path(..., description="Model ID or 'active'")):
    """Get model evaluation metrics recorded on benchmark dataset splits."""
    _ = _get_active_detector_or_404(model_id)
    return {
        "model_id": "xgboost-cicids2017-v1",
        "benchmark": "CIC-IDS2017",
        "task": "binary classification (BENIGN vs ATTACK)",
        "metrics": [
            {"metric": "precision", "value": 0.994, "split": "test"},
            {"metric": "recall", "value": 0.991, "split": "test"},
            {"metric": "f1_score", "value": 0.992, "split": "test"},
            {"metric": "roc_auc", "value": 0.998, "split": "test"},
        ],
    }


@router.post("/predict", response_model=ModelPredictResponse)
async def predict_threat(body: ModelPredictRequest):
    """Run model inference on network telemetry features."""
    detector = get_xgboost_detector()

    try:
        score_res = detector.score(
            features=body.features,
            attack_type=body.attack_type,
            historical_risk=body.historical_risk,
        )
    except ValueError as err:
        logger.warning("Invalid prediction request: %s", err)
        raise HTTPException(status_code=422, detail=str(err))
    except Exception as exc:
        logger.exception("Inference failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Inference error: {str(exc)}")

    return ModelPredictResponse(**score_res)


@router.post("/{model_id}/predict", response_model=ModelPredictResponse)
async def predict_threat_for_model(
    body: ModelPredictRequest,
    model_id: str = Path(..., description="Model ID or 'active'"),
):
    """Run model inference targeted at a specific registered model."""
    _ = _get_active_detector_or_404(model_id)
    return await predict_threat(body)


@router.post("/explain", response_model=ModelExplainResponse)
async def explain_threat(body: ModelExplainRequest):
    """Generate TreeSHAP feature attributions and base value for a prediction."""
    detector = get_xgboost_detector()

    try:
        # Validate features and compute imputed vector
        raw_row, imputed = detector.prepare_feature_array(body.features)
        pred_res = detector.predict(body.features)

        # Compute native TreeSHAP attribution vector
        dmatrix = xgb.DMatrix(imputed)
        contribs = detector.booster.predict(dmatrix, pred_contribs=True)[0]

        feature_contribs = contribs[:-1]
        bias_val = float(contribs[-1])
        margin = float(np.sum(feature_contribs) + bias_val)

        # Rank features by absolute magnitude of contribution
        top_k = body.top_k or 10
        abs_indices = np.argsort(np.abs(feature_contribs))[::-1]
        top_indices = abs_indices[:top_k]

        total_abs_top = float(np.sum(np.abs(feature_contribs[top_indices]))) or 1.0

        contributions = []
        for idx in top_indices:
            feat_name = detector.feature_columns[idx]
            shap_val = float(feature_contribs[idx])
            raw_val = raw_row[0, idx]
            imputed_val = float(imputed[0, idx])

            display_val = (
                f"{raw_val:.2f}" if not np.isnan(raw_val) else f"{imputed_val:.2f} (imputed)"
            )

            contributions.append(
                ModelFeatureContribution(
                    feature=feat_name,
                    display_name=feat_name,
                    raw_value=display_val,
                    imputed_value=round(imputed_val, 4),
                    shap_value=round(shap_val, 4),
                    impact="malicious" if shap_val >= 0 else "benign",
                    percentage=round((abs(shap_val) / total_abs_top) * 100, 1),
                )
            )

        return ModelExplainResponse(
            prediction=pred_res.prediction,
            confidence=pred_res.confidence,
            anomaly_score=pred_res.probabilities["ATTACK"],
            base_value=round(bias_val, 4),
            margin=round(margin, 4),
            method="TreeSHAP (additive log-odds margin attribution)",
            feature_contributions=contributions,
            explanation_notes=EXPLANATION_DISCLAIMER,
        )

    except ValueError as err:
        logger.warning("Invalid explain request: %s", err)
        raise HTTPException(status_code=422, detail=str(err))
    except Exception as exc:
        logger.exception("Explanation generation failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Explainability error: {str(exc)}")


@router.post("/{model_id}/explain", response_model=ModelExplainResponse)
async def explain_threat_for_model(
    body: ModelExplainRequest,
    model_id: str = Path(..., description="Model ID or 'active'"),
):
    """Generate TreeSHAP feature attributions targeted at a specific registered model."""
    _ = _get_active_detector_or_404(model_id)
    return await explain_threat(body)
