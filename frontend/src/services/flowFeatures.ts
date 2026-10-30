/**
 * SentinelAI - Flow Features Utilities
 * Validates whether network telemetry records contain required 69-feature CIC-IDS2017 flow attributes.
 */

export const CIC_IDS2017_FEATURE_MARKERS = [
  'Flow Duration',
  'Total Fwd Packets',
  'Total Backward Packets',
  'Fwd Packet Length Mean',
  'Flow IAT Mean',
  'Bwd Packet Length Mean',
  'Flow Bytes/s',
  'Flow Packets/s',
  'Average Packet Size',
  'Protocol',
] as const;

/**
 * Returns true only if the telemetry features object contains genuine CIC-IDS2017 flow statistical markers.
 * Strictly prevents treating raw IP/transport header fields or empty records as valid ML flow inputs.
 */
export function hasValidFlowFeatures(features?: Record<string, unknown> | null): boolean {
  if (!features || typeof features !== 'object') return false;
  const keys = Object.keys(features);
  if (keys.length === 0) return false;

  const matched = CIC_IDS2017_FEATURE_MARKERS.filter((marker) => marker in features);
  return matched.length >= 3;
}
