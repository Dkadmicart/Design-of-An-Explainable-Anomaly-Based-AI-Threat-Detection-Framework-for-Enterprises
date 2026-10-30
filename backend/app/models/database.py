"""
SentinelAI - SQLAlchemy ORM Models
Database schema for the threat detection platform.
"""
from sqlalchemy import (
    Column, String, Integer, BigInteger, Float, Boolean, DateTime, Text, JSON,
    ForeignKey, Index, Enum as SAEnum
)
from sqlalchemy.orm import DeclarativeBase, relationship, Mapped, mapped_column
from datetime import datetime
from typing import Optional
import enum
import uuid


class Base(DeclarativeBase):
    """SQLAlchemy declarative base."""
    pass


# ─── Enums ───────────────────────────────────────────────────────────────────

class SeverityLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class AlertStatus(str, enum.Enum):
    NEW = "NEW"
    INVESTIGATING = "INVESTIGATING"
    CONFIRMED = "CONFIRMED"
    BENIGN = "BENIGN"
    ESCALATED = "ESCALATED"
    RESOLVED = "RESOLVED"


class ModelStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    TRAINING = "TRAINING"
    EVALUATING = "EVALUATING"
    FAILED = "FAILED"


class DatasetRunStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class DatasetStatus(str, enum.Enum):
    DISCOVERED = "DISCOVERED"
    VALIDATING = "VALIDATING"
    READY = "READY"
    PROCESSING = "PROCESSING"
    PROCESSED = "PROCESSED"
    ERROR = "ERROR"
    NOT_AVAILABLE = "NOT_AVAILABLE"


class DatasetFileStatus(str, enum.Enum):
    VALID = "VALID"
    INVALID = "INVALID"
    NOT_FOUND = "NOT_FOUND"
    PROCESSING = "PROCESSING"


class AttackType(str, enum.Enum):
    BENIGN = "BENIGN"
    DDOS = "DDoS"
    DOS = "DoS"
    PORTSCAN = "PortScan"
    BOTNET = "Botnet"
    BRUTE_FORCE = "Brute Force"
    WEB_ATTACK = "Web Attack"
    INFILTRATION = "Infiltration"
    UNKNOWN = "UNKNOWN"


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    SECURITY_ANALYST = "SECURITY_ANALYST"
    VIEWER = "VIEWER"


class AuthProviderType(str, enum.Enum):
    PASSWORD = "PASSWORD"
    GOOGLE = "GOOGLE"
    OIDC = "OIDC"
    SAML = "SAML"


# ─── Models ──────────────────────────────────────────────────────────────────

class Event(Base):
    """Network security event record."""
    __tablename__ = "events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    timestamp = Column(DateTime, nullable=False, index=True, default=datetime.utcnow)
    
    # Network fields
    source_ip = Column(String(45), nullable=False, index=True)
    destination_ip = Column(String(45), nullable=False, index=True)
    source_port = Column(Integer, nullable=True)
    destination_port = Column(Integer, nullable=True)
    protocol = Column(String(20), nullable=True)
    
    # Flow features
    flow_duration = Column(Float, nullable=True)
    total_fwd_packets = Column(Integer, nullable=True)
    total_bwd_packets = Column(Integer, nullable=True)
    total_length_fwd_packets = Column(Float, nullable=True)
    total_length_bwd_packets = Column(Float, nullable=True)
    flow_bytes_per_sec = Column(Float, nullable=True)
    flow_packets_per_sec = Column(Float, nullable=True)
    
    # Extended features stored as JSON
    features = Column(JSON, nullable=True)
    
    # ML predictions
    prediction = Column(String(50), nullable=True)
    confidence = Column(Float, nullable=True)
    anomaly_score = Column(Float, nullable=True)
    risk_score = Column(Float, nullable=True)
    attack_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    
    # Model info
    model_version = Column(String(50), nullable=True)
    model_name = Column(String(100), nullable=True)
    
    # Metadata
    dataset_source = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    alerts = relationship("Alert", back_populates="event", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_events_timestamp_attack", "timestamp", "attack_type"),
        Index("idx_events_risk", "risk_score"),
    )


class Alert(Base):
    """Security alert generated from event detections."""
    __tablename__ = "alerts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_id = Column(String(36), ForeignKey("events.id"), nullable=False, index=True)
    
    # Alert details
    severity: Mapped[SeverityLevel] = mapped_column(SAEnum(SeverityLevel), nullable=False, index=True)
    attack_type = Column(String(50), nullable=False)
    status: Mapped[AlertStatus] = mapped_column(SAEnum(AlertStatus), default=AlertStatus.NEW, index=True)
    
    # Scores
    risk_score = Column(Float, nullable=False)
    confidence = Column(Float, nullable=True)
    
    # Detection info
    detection_model = Column(String(100), nullable=True)
    detection_reason = Column(Text, nullable=True)
    
    # MITRE ATT&CK
    mitre_tactic = Column(String(100), nullable=True)
    mitre_technique_id = Column(String(20), nullable=True)
    mitre_technique_name = Column(String(200), nullable=True)
    
    # Network context
    source_ip = Column(String(45), nullable=False)
    destination_ip = Column(String(45), nullable=False)
    source_port = Column(Integer, nullable=True)
    destination_port = Column(Integer, nullable=True)
    protocol = Column(String(20), nullable=True)
    
    # Timestamps
    first_seen = Column(DateTime, nullable=False, default=datetime.utcnow)
    last_seen = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    
    # Relationships
    event = relationship("Event", back_populates="alerts")
    investigation = relationship("Investigation", back_populates="alert", uselist=False)
    notes = relationship("AnalystNote", back_populates="alert", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_alerts_severity_status", "severity", "status"),
    )


class Investigation(Base):
    """Investigation record for an alert."""
    __tablename__ = "investigations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    alert_id = Column(String(36), ForeignKey("alerts.id"), nullable=False, unique=True)
    
    analyst_id = Column(String(100), nullable=True)
    status = Column(String(50), default="OPEN")
    summary = Column(Text, nullable=True)
    findings = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    closed_at = Column(DateTime, nullable=True)
    
    # Relationships
    alert = relationship("Alert", back_populates="investigation")


class AnalystNote(Base):
    """Notes written by analysts during investigation."""
    __tablename__ = "analyst_notes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    alert_id = Column(String(36), ForeignKey("alerts.id"), nullable=False, index=True)
    
    content = Column(Text, nullable=False)
    author = Column(String(100), nullable=True, default="analyst")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    alert = relationship("Alert", back_populates="notes")


class MLModel(Base):
    """Registered ML model metadata."""
    __tablename__ = "models"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False, unique=True)
    version = Column(String(50), nullable=False)
    model_type = Column(String(50), nullable=False)  # RandomForest, XGBoost, etc.
    
    status = Column(SAEnum(ModelStatus), default=ModelStatus.INACTIVE)
    description = Column(Text, nullable=True)
    
    # Training info
    trained_at = Column(DateTime, nullable=True)
    training_dataset = Column(String(200), nullable=True)
    training_duration_sec = Column(Float, nullable=True)
    
    # Model file
    artifact_path = Column(String(500), nullable=True)
    
    # Configuration
    hyperparameters = Column(JSON, nullable=True)
    feature_names = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    metrics = relationship("ModelMetric", back_populates="model", cascade="all, delete-orphan")


class ModelMetric(Base):
    """Model evaluation metrics with proper dataset/split tracking."""
    __tablename__ = "model_metrics"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    model_id = Column(String(36), ForeignKey("models.id"), nullable=False, index=True)
    
    # What was evaluated
    dataset = Column(String(200), nullable=False)
    split = Column(String(20), nullable=False)  # train, validation, test
    
    # Metric
    metric_name = Column(String(50), nullable=False)  # precision, recall, f1, etc.
    metric_value = Column(Float, nullable=False)
    
    # Per-class metrics
    class_name = Column(String(50), nullable=True)  # e.g., "DDoS", "Benign"
    
    # Metadata
    timestamp = Column(DateTime, default=datetime.utcnow)
    model_version = Column(String(50), nullable=True)
    
    # Relationships
    model = relationship("MLModel", back_populates="metrics")

    __table_args__ = (
        Index("idx_metrics_model_dataset", "model_id", "dataset", "split"),
    )


class MitreTechnique(Base):
    """MITRE ATT&CK technique mapping."""
    __tablename__ = "mitre_techniques"

    id = Column(String(20), primary_key=True)  # e.g., T1046
    tactic = Column(String(100), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    url = Column(String(500), nullable=True)
    
    # Detection mapping
    attack_types = Column(JSON, nullable=True)  # Which attack types map to this technique
    detection_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)


class DatasetRun(Base):
    """Dataset import/processing run tracking."""
    __tablename__ = "dataset_runs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_name = Column(String(200), nullable=False)
    file_name = Column(String(200), nullable=True)
    
    status = Column(SAEnum(DatasetRunStatus), default=DatasetRunStatus.PENDING)
    
    # Processing stats
    total_rows = Column(Integer, nullable=True)
    rows_processed = Column(Integer, default=0)
    rows_failed = Column(Integer, default=0)
    
    # Timing
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Results
    error_message = Column(Text, nullable=True)
    processing_notes = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)


class DatasetRegistry(Base):
    """Registered benchmark or historical dataset."""
    __tablename__ = "dataset_registry"

    id = Column(String(50), primary_key=True)  # e.g., "cic-ids2017"
    name = Column(String(100), nullable=False)
    version = Column(String(50), default="1.0.0")
    source = Column(String(200), default="Canadian Institute for Cybersecurity (UNB)")
    description = Column(Text, nullable=True)
    status = Column(SAEnum(DatasetStatus), default=DatasetStatus.NOT_AVAILABLE, nullable=False, index=True)
    
    file_count = Column(Integer, default=0)
    total_records = Column(BigInteger, default=0)
    feature_count = Column(Integer, default=0)
    label_column = Column(String(100), nullable=True)
    
    schema_metadata = Column(JSON, nullable=True)
    quality_summary = Column(JSON, nullable=True)
    label_distribution = Column(JSON, nullable=True)
    feature_statistics = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    files = relationship("DatasetFileRecord", back_populates="dataset", cascade="all, delete-orphan")
    runs = relationship("DatasetProcessingRun", back_populates="dataset", cascade="all, delete-orphan")


class DatasetFileRecord(Base):
    """File record within a dataset."""
    __tablename__ = "dataset_files"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String(50), ForeignKey("dataset_registry.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(200), nullable=False, index=True)
    file_path = Column(String(500), nullable=True)
    size_bytes = Column(BigInteger, default=0)
    status = Column(SAEnum(DatasetFileStatus), default=DatasetFileStatus.NOT_FOUND, nullable=False)
    
    rows = Column(BigInteger, nullable=True)
    columns = Column(Integer, nullable=True)
    label_column = Column(String(100), nullable=True)
    attack_classes = Column(JSON, nullable=True)
    validation_details = Column(JSON, nullable=True)
    data_quality = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    dataset = relationship("DatasetRegistry", back_populates="files")


class DatasetProcessingRun(Base):
    """Tracks preprocessing pipeline execution and reproducibility."""
    __tablename__ = "dataset_processing_runs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String(50), ForeignKey("dataset_registry.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(SAEnum(DatasetRunStatus), default=DatasetRunStatus.PENDING, nullable=False)
    
    config = Column(JSON, nullable=True)
    transformation_metadata = Column(JSON, nullable=True)
    rows_removed = Column(BigInteger, default=0)
    rows_remaining = Column(BigInteger, default=0)
    output_path = Column(String(500), nullable=True)
    error_message = Column(Text, nullable=True)
    
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    dataset = relationship("DatasetRegistry", back_populates="runs")


# ─── Authentication & User Management Models ────────────────────────────────

class User(Base):
    """Enterprise SentinelAI User."""
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    display_name = Column(String(100), nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.SECURITY_ANALYST, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    mfa_enabled = Column(Boolean, default=False, nullable=False)
    organization_id = Column(String(36), nullable=True)  # Prepared for enterprise multi-tenancy
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_login_at = Column(DateTime, nullable=True)

    # Relationships
    auth_accounts = relationship("AuthenticationAccount", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    reset_tokens = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")


class AuthenticationAccount(Base):
    """Linked authentication identity provider account (e.g. password, google, oidc, saml)."""
    __tablename__ = "authentication_accounts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(SAEnum(AuthProviderType), nullable=False, index=True)
    provider_user_id = Column(String(255), nullable=False, index=True)  # e.g., email or oauth sub
    password_hash = Column(String(255), nullable=True)  # Argon2id hash for password provider only
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationship
    user = relationship("User", back_populates="auth_accounts")

    __table_args__ = (
        Index("idx_auth_provider_uid", "provider", "provider_user_id", unique=True),
    )


class UserSession(Base):
    """User session for refresh token validation and revocation."""
    __tablename__ = "user_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    refresh_token_hash = Column(String(128), nullable=False, index=True)
    user_agent = Column(String(255), nullable=True)
    ip_address = Column(String(45), nullable=True)
    is_revoked = Column(Boolean, default=False, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationship
    user = relationship("User", back_populates="sessions")


class PasswordResetToken(Base):
    """Secure password reset token."""
    __tablename__ = "password_reset_tokens"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(128), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationship
    user = relationship("User", back_populates="reset_tokens")


class AuditLog(Base):
    """Security audit log for enterprise actions."""
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    user_id = Column(String(36), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)  # LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, etc.
    resource = Column(String(100), nullable=False)
    status = Column(String(20), nullable=False)  # SUCCESS, FAILURE, REJECTED
    ip_address = Column(String(45), nullable=True)
    details = Column(JSON, nullable=True)


class LoginAttempt(Base):
    """Rate limiting and failed login tracking."""
    __tablename__ = "login_attempts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    identifier = Column(String(255), nullable=False, index=True)  # email or ip
    attempt_time = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    successful = Column(Boolean, default=False, nullable=False)

