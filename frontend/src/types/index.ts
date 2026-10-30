// ─── Enums ──────────────────────────────────────────────────────────────────

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertStatus = 'NEW' | 'INVESTIGATING' | 'CONFIRMED' | 'BENIGN' | 'ESCALATED' | 'RESOLVED';
export type ModelStatus = 'ACTIVE' | 'INACTIVE' | 'TRAINING' | 'EVALUATING' | 'FAILED';
export type AttackType = 'BENIGN' | 'DDoS' | 'DoS' | 'PortScan' | 'Botnet' | 'Brute Force' | 'Web Attack' | 'Infiltration' | 'UNKNOWN';
export type EnvironmentMode = 'replay' | 'live';
export type RiskCategory = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// ─── Event ──────────────────────────────────────────────────────────────────

export interface NetworkEvent {
  id: string;
  timestamp: string;
  source_ip: string;
  destination_ip: string;
  source_port: number;
  destination_port: number;
  protocol: string;
  flow_duration: number;
  total_fwd_packets: number;
  total_bwd_packets: number;
  total_length_fwd_packets: number;
  total_length_bwd_packets: number;
  flow_bytes_per_sec: number;
  flow_packets_per_sec: number;
  features: Record<string, number>;
  prediction: string;
  confidence: number;
  anomaly_score: number | null;
  risk_score: number;
  attack_type: AttackType;
  model_version: string;
  model_name: string;
  dataset_source: string | null;
}

// ─── Alert ──────────────────────────────────────────────────────────────────

export interface Alert {
  id: string;
  event_id: string;
  severity: SeverityLevel;
  attack_type: string;
  status: AlertStatus;
  risk_score: number;
  confidence: number;
  detection_model: string;
  detection_reason: string;
  mitre_tactic: string | null;
  mitre_technique_id: string | null;
  mitre_technique_name: string | null;
  source_ip: string;
  destination_ip: string;
  source_port: number;
  destination_port: number;
  protocol: string;
  first_seen: string;
  last_seen: string;
  created_at: string;
}

// ─── Investigation ──────────────────────────────────────────────────────────

export interface Investigation {
  id: string;
  alert_id: string;
  analyst_id: string | null;
  status: string;
  summary: string | null;
  findings: Record<string, unknown> | null;
  created_at: string;
}

export interface AnalystNote {
  id: string;
  alert_id: string;
  content: string;
  author: string;
  created_at: string;
}

// ─── ML Model ───────────────────────────────────────────────────────────────

export interface MLModel {
  id: string;
  name: string;
  version: string;
  model_type: string;
  status: ModelStatus;
  description: string | null;
  trained_at: string | null;
  training_dataset: string | null;
  hyperparameters: Record<string, unknown> | null;
  n_features?: number;
  feature_columns?: string[];
}

export interface ModelMetric {
  id: string;
  model_id: string;
  dataset: string;
  split: string;
  metric_name: string;
  metric_value: number;
  class_name: string | null;
  timestamp: string;
  model_version: string;
}

export interface BenchmarkMetric {
  metric: string;
  value: number;
  split: string;
}

export interface ModelMetricsResponse {
  model_id: string;
  benchmark: string;
  task: string;
  metrics: BenchmarkMetric[];
}

export interface ModelFeaturesResponse {
  model_id: string;
  n_features: number;
  features: string[];
}

export interface ModelPredictRequest {
  features: Record<string, unknown>;
  attack_type?: string | null;
  historical_risk?: number;
}

export interface ModelPredictResponse {
  prediction: string;
  confidence: number;
  probabilities: Record<string, number>;
  anomaly_score: number;
  risk_score: number;
  severity: SeverityLevel;
  attack_type?: string | null;
  model_name: string;
  model_version: string;
}

export interface ModelFeatureContribution {
  feature: string;
  display_name: string;
  raw_value: string;
  imputed_value: number;
  shap_value: number;
  impact: 'malicious' | 'benign';
  percentage: number;
}

export interface ModelExplainRequest {
  features: Record<string, unknown>;
  top_k?: number;
}

export interface ModelExplainResponse {
  prediction: string;
  confidence: number;
  anomaly_score: number;
  base_value: number;
  margin: number;
  method: string;
  feature_contributions: ModelFeatureContribution[];
  explanation_notes: string;
}

// ─── MITRE ATT&CK ──────────────────────────────────────────────────────────

export interface MitreTechnique {
  id: string;
  tactic: string;
  name: string;
  description: string;
  url: string | null;
  attack_types: string[];
  detection_count: number;
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export interface DashboardSummary {
  total_events: number;
  normal_events: number;
  suspicious_events: number;
  critical_alerts: number;
  detection_rate: number;
  false_positive_rate: number;
  total_events_trend: number;
  normal_events_trend: number;
  suspicious_events_trend: number;
  critical_alerts_trend: number;
  detection_rate_trend: number;
  false_positive_rate_trend: number;
}

export interface TimelinePoint {
  time: string;
  normal: number;
  suspicious: number;
  critical: number;
}

export interface AttackDistribution {
  type: AttackType;
  count: number;
  percentage: number;
}

export interface RiskDistribution {
  category: RiskCategory;
  count: number;
}

export interface TopSource {
  ip: string;
  events: number;
  risk_score: number;
  last_seen: string;
}

export interface ModelStatusInfo {
  current_model: string;
  version: string;
  last_trained: string;
  detection_mode: string;
  health: 'healthy' | 'degraded' | 'unhealthy';
}

// ─── System Health ──────────────────────────────────────────────────────────

export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  latency_ms: number | null;
  message: string;
}

export interface SystemMetrics {
  cpu_percent: number;
  memory_percent: number;
  events_per_sec: number;
  avg_inference_ms: number;
  queue_size: number;
}

// ─── Dataset ────────────────────────────────────────────────────────────────

export type DatasetStatusType = 'DISCOVERED' | 'VALIDATING' | 'READY' | 'PROCESSING' | 'PROCESSED' | 'ERROR' | 'NOT_AVAILABLE';
export type DatasetFileStatusType = 'VALID' | 'INVALID' | 'NOT_FOUND' | 'PROCESSING';

export interface DatasetFileRecord {
  filename: string;
  scenario: string;
  attack_types: string[];
  status: DatasetFileStatusType;
  file_path: string;
  size_bytes: number;
  size_mb: number;
  rows: number;
  columns: number;
  label_column: string | null;
  error_message: string | null;
  validation_details: Record<string, unknown> | null;
  data_quality: Record<string, unknown> | null;
}

export interface DatasetRegistry {
  id: string;
  name: string;
  version: string;
  source: string;
  description: string;
  status: DatasetStatusType;
  file_count: number;
  total_records: number;
  feature_count: number;
  label_column: string;
  quality_summary: {
    missing_values_count: number;
    missing_pct: number;
    duplicate_rows_est: number;
    duplicate_pct: number;
    infinite_values_count: number;
    constant_features_count: number;
  };
  label_distribution: Record<string, { count: number; pct: number }>;
  raw_directory: string;
  target_raw_path: string;
  expected_files: string[];
}

export interface FeatureSummary {
  name: string;
  data_type: string;
  nullable: boolean;
  is_label: boolean;
  is_numeric: boolean;
  mean?: number;
  std?: number;
  min?: number;
  median?: number;
  max?: number;
  null_count?: number;
}

export interface DatasetSchema {
  columns: string[];
  feature_count: number;
  label_column: string | null;
  features: FeatureSummary[];
}

export interface DataQualityReport {
  missing_values_count: number;
  missing_pct: number;
  duplicate_rows_est: number;
  duplicate_pct: number;
  infinite_values_count: number;
  constant_features: string[];
  constant_features_count: number;
}

export interface LabelDistributionItem {
  name: string;
  count: number;
  percentage: number;
}

export interface LabelDistribution {
  total_records: number;
  distinct_labels: number;
  distribution: Record<string, { count: number; pct: number }>;
  items: LabelDistributionItem[];
}

export interface DatasetFile {
  name: string;
  display_name: string;
  rows: number | null;
  columns: number | null;
  attack_types: string[];
  status: 'available' | 'imported' | 'processing' | 'not_found';
  size_mb: number | null;
}

export interface Dataset {
  name: string;
  description: string;
  source: string;
  files: DatasetFile[];
  last_imported: string | null;
  preprocessing_status: string;
}

// ─── Replay ─────────────────────────────────────────────────────────────────

export interface ReplayStatus {
  is_running: boolean;
  is_paused: boolean;
  speed: number;
  events_sent: number;
  total_events: number;
  current_file: string | null;
  elapsed_seconds: number;
  worker_active?: boolean;
  metrics?: Array<{
    time: string;
    events: number;
    threats: number;
    epoch_sec: number;
  }>;
}

// ─── Feature Contribution (Explainability) ──────────────────────────────────

export interface FeatureContribution {
  feature: string;
  value: number;
  display_name: string;
}

// ─── Investigation Search ───────────────────────────────────────────────────

export interface InvestigationResult {
  ip: string;
  first_seen: string;
  last_seen: string;
  total_events: number;
  attack_types: string[];
  risk_history: { time: string; risk: number }[];
  events: NetworkEvent[];
}

// ─── Settings ───────────────────────────────────────────────────────────────

export interface AppSettings {
  detection_mode: 'binary' | 'multiclass';
  alert_threshold: number;
  replay_speed: number;
  notifications_enabled: boolean;
  selected_model: string;
  selected_dataset: string;
}
