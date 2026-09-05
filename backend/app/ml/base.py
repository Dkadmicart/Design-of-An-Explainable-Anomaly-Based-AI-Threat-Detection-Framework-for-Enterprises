"""
SentinelAI - ML Service Interfaces
Abstract base class for detection models and risk scoring.
"""
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import numpy as np


@dataclass
class PredictionResult:
    """Result from a model prediction."""
    prediction: str  # "BENIGN" or attack type
    confidence: float  # 0.0 - 1.0
    probabilities: Dict[str, float]  # class -> probability
    model_name: str
    model_version: str


@dataclass
class ExplanationResult:
    """Feature contribution explanation for a prediction."""
    feature_contributions: List[Dict[str, Any]]  # [{feature, value, display_name}]
    method: str  # "shap", "permutation", "demo"
    model_name: str


class DetectionModel(ABC):
    """Abstract base class for all detection models.
    
    All models must implement this interface so they can be
    swapped without rewriting the application.
    """

    @abstractmethod
    def predict(self, features: Dict[str, float]) -> PredictionResult:
        """Make a single prediction."""
        ...

    @abstractmethod
    def predict_batch(self, feature_batch: List[Dict[str, float]]) -> List[PredictionResult]:
        """Make predictions on a batch of features."""
        ...

    @abstractmethod
    def predict_proba(self, features: Dict[str, float]) -> Dict[str, float]:
        """Return class probabilities."""
        ...

    @abstractmethod
    def explain(self, features: Dict[str, float]) -> ExplanationResult:
        """Explain why a prediction was made."""
        ...

    @abstractmethod
    def get_info(self) -> Dict[str, Any]:
        """Return model metadata."""
        ...


class RiskScorer:
    """Transparent risk scoring service.
    
    Combines model confidence, anomaly score, and attack severity
    into a 0-100 risk score.
    
    Categories:
        0-24:  LOW
        25-49: MEDIUM
        50-74: HIGH
        75-100: CRITICAL
    
    NOTE: This is NOT a standardized cybersecurity risk formula.
    It is a configurable scoring system for this research platform.
    """

    # Severity weights for different attack types (configurable)
    ATTACK_SEVERITY: Dict[str, float] = {
        "BENIGN": 0.0,
        "DDoS": 0.85,
        "DoS": 0.75,
        "PortScan": 0.50,
        "Botnet": 0.90,
        "Brute Force": 0.70,
        "Web Attack": 0.80,
        "Infiltration": 0.95,
        "UNKNOWN": 0.60,
    }

    # Weight configuration (must sum to 1.0)
    WEIGHT_CONFIDENCE: float = 0.35
    WEIGHT_ANOMALY: float = 0.25
    WEIGHT_SEVERITY: float = 0.30
    WEIGHT_HISTORICAL: float = 0.10

    @classmethod
    def calculate(
        cls,
        prediction: str,
        confidence: float,
        anomaly_score: Optional[float] = None,
        attack_type: Optional[str] = None,
        historical_risk: Optional[float] = None,
    ) -> float:
        """Calculate risk score from model outputs.
        
        Args:
            prediction: Model prediction (BENIGN/ATTACK)
            confidence: Model confidence (0-1)
            anomaly_score: Optional anomaly detector score (0-1)
            attack_type: Predicted attack classification
            historical_risk: Historical risk for this source (0-100)
        
        Returns:
            Risk score 0-100
        """
        if prediction == "BENIGN":
            # Low confidence in BENIGN prediction still warrants some risk
            return max(0, (1 - confidence) * 30)

        severity = cls.ATTACK_SEVERITY.get(attack_type or "UNKNOWN", 0.60)
        anomaly = anomaly_score if anomaly_score is not None else 0.5
        historical = (historical_risk or 0) / 100.0

        raw_score = (
            cls.WEIGHT_CONFIDENCE * confidence
            + cls.WEIGHT_ANOMALY * anomaly
            + cls.WEIGHT_SEVERITY * severity
            + cls.WEIGHT_HISTORICAL * historical
        )

        # Scale to 0-100
        risk = min(100, max(0, raw_score * 100))
        return round(risk, 1)

    @staticmethod
    def categorize(risk_score: float) -> str:
        """Categorize a risk score."""
        if risk_score >= 75:
            return "CRITICAL"
        elif risk_score >= 50:
            return "HIGH"
        elif risk_score >= 25:
            return "MEDIUM"
        return "LOW"
