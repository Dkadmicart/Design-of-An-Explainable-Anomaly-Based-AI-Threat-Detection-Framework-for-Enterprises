/**
 * SentinelAI - Replay Stream Metrics Service
 *
 * Provides mathematically sound rate calculations, timestamp bucketing,
 * chronological ordering, strict deduplication, and module-level caching
 * for Live Threat Monitor real-time telemetry and charts:
 * 1. Throughput: Events / second (30-second rolling window)
 * 2. Threat Detections: Threats / minute (30-second rolling window)
 */

import type { NetworkEvent } from '../types';

export interface StreamMetric {
  time: string;       // Formatted HH:MM:SS
  events: number;     // Rate: Events / sec (rounded to 1 decimal place)
  threats: number;    // Rate: Threats / min (rounded to 1 decimal place)
  epochSec: number;   // Epoch timestamp in seconds for ordering and deduplication
}

export interface RollingRateResult {
  eventsPerSec: number | null; // null if insufficient data or zero elapsed
  threatsPerMin: number | null; // null if insufficient data or zero elapsed
  windowSpanSec: number;
  uniqueEventsCount: number;
  uniqueThreatsCount: number;
  isAvailable: boolean;
}

// Module-level cache: survives React component unmount/remount across navigation
let moduleCachedMetrics: StreamMetric[] = [];
let moduleCachedEvents: NetworkEvent[] = [];

export function getCachedMetrics(): StreamMetric[] {
  return [...moduleCachedMetrics];
}

export function setCachedMetrics(metrics: StreamMetric[]): void {
  moduleCachedMetrics = [...metrics];
}

export function clearCachedMetrics(): void {
  moduleCachedMetrics = [];
}

export function getCachedEvents(): NetworkEvent[] {
  return [...moduleCachedEvents];
}

export function setCachedEvents(events: NetworkEvent[]): void {
  moduleCachedEvents = [...events];
}

export function clearCachedEvents(): void {
  moduleCachedEvents = [];
}

/**
 * Format a Date or timestamp string into localized 24-hr HH:MM:SS string.
 */
export function formatMetricTime(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Calculate the rolling-window rates (Events/sec and Threats/min) from a collection of network events.
 *
 * Rules:
 * 1. Each unique event ID is counted at most once.
 * 2. Rates are calculated over the authentic rolling window [t_latest - windowMs, t_latest].
 * 3. Events older than the rolling window boundary are evicted.
 * 4. Zero or invalid elapsed time (t_latest - t_earliest <= 0 or span < minSpanSec) returns an honest unavailable state (null rates).
 * 5. No arbitrary clamp or fabricated timing is used.
 *
 * @param events Collection of raw or monitored network events
 * @param windowMs Rolling window duration in milliseconds (default: 30000 = 30s)
 * @param minSpanSec Minimum required elapsed seconds to compute rate (default: 1.0s)
 */
export function calculateRollingWindowRate(
  events: Array<Pick<NetworkEvent, 'timestamp'> & Partial<Pick<NetworkEvent, 'id' | 'prediction'>>>,
  windowMs = 30000,
  minSpanSec = 1.0
): RollingRateResult {
  const unavailableResult: RollingRateResult = {
    eventsPerSec: null,
    threatsPerMin: null,
    windowSpanSec: 0,
    uniqueEventsCount: 0,
    uniqueThreatsCount: 0,
    isAvailable: false,
  };

  if (!events || events.length === 0) {
    return unavailableResult;
  }

  // Deduplicate by event ID and validate timestamps
  const uniqueMap = new Map<string, { id: string; ts: number; isThreat: boolean }>();

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (!e || !e.timestamp) continue;
    const ts = new Date(e.timestamp).getTime();
    if (Number.isNaN(ts) || ts <= 0) continue;

    const id = e.id && typeof e.id === 'string' && e.id.trim().length > 0
      ? e.id
      : `anon-${ts}-${i}`;

    // Count each unique event ID at most once
    if (!uniqueMap.has(id)) {
      const isThreat = Boolean(e.prediction && e.prediction !== 'BENIGN');
      uniqueMap.set(id, { id, ts, isThreat });
    }
  }

  if (uniqueMap.size < 2) {
    return {
      ...unavailableResult,
      uniqueEventsCount: uniqueMap.size,
      uniqueThreatsCount: Array.from(uniqueMap.values()).filter((e) => e.isThreat).length,
    };
  }

  const allEvents = Array.from(uniqueMap.values());
  const maxTs = Math.max(...allEvents.map((e) => e.ts));
  const cutoff = maxTs - Math.max(1000, windowMs);

  // Filter events within rolling window boundary [cutoff, maxTs]
  const windowEvents = allEvents.filter((e) => e.ts >= cutoff);

  if (windowEvents.length < 2) {
    return {
      ...unavailableResult,
      uniqueEventsCount: windowEvents.length,
      uniqueThreatsCount: windowEvents.filter((e) => e.isThreat).length,
    };
  }

  const minTs = Math.min(...windowEvents.map((e) => e.ts));
  const elapsedSec = (maxTs - minTs) / 1000;

  // Safe handling of zero or insufficient elapsed time without fabrication or clamping
  if (elapsedSec <= 0 || !Number.isFinite(elapsedSec) || elapsedSec < minSpanSec) {
    return {
      eventsPerSec: null,
      threatsPerMin: null,
      windowSpanSec: Math.max(0, elapsedSec),
      uniqueEventsCount: windowEvents.length,
      uniqueThreatsCount: windowEvents.filter((e) => e.isThreat).length,
      isAvailable: false,
    };
  }

  const uniqueEventsCount = windowEvents.length;
  const uniqueThreatsCount = windowEvents.filter((e) => e.isThreat).length;

  const eventsPerSec = Number((uniqueEventsCount / elapsedSec).toFixed(1));
  const threatsPerMin = Number(((uniqueThreatsCount / elapsedSec) * 60).toFixed(1));

  return {
    eventsPerSec,
    threatsPerMin,
    windowSpanSec: Number(elapsedSec.toFixed(2)),
    uniqueEventsCount,
    uniqueThreatsCount,
    isAvailable: true,
  };
}

/**
 * Reconstruct authentic rolling-window rate telemetry points from raw network events.
 *
 * Algorithm:
 * 1. Filter valid timestamps, deduplicate events by ID.
 * 2. Group events chronologically into 1-second buckets.
 * 3. For each bucket epoch, compute the rolling 30-second rate using all events within [bucket - 30s, bucket].
 * 4. Yield strictly ordered, deduplicated StreamMetric points.
 *
 * @param events Raw network events containing authentic timestamps and predictions
 * @param windowMs Rolling window size in ms (default: 30000 = 30s)
 * @param maxPoints Maximum historical points to return (default: 30)
 */
export function calculateMetricsFromEvents(
  events: Array<Pick<NetworkEvent, 'timestamp'> & Partial<Pick<NetworkEvent, 'id' | 'prediction'>>>,
  windowMs = 30000,
  maxPoints = 30
): StreamMetric[] {
  if (!events || events.length === 0) {
    return [];
  }

  // Deduplicate by event ID and sort chronologically
  const uniqueMap = new Map<string, { id: string; ts: number; isThreat: boolean }>();
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (!e || !e.timestamp) continue;
    const ts = new Date(e.timestamp).getTime();
    if (Number.isNaN(ts) || ts <= 0) continue;
    const id = e.id && typeof e.id === 'string' && e.id.trim().length > 0
      ? e.id
      : `anon-${ts}-${i}`;
    if (!uniqueMap.has(id)) {
      uniqueMap.set(id, { id, ts, isThreat: Boolean(e.prediction && e.prediction !== 'BENIGN') });
    }
  }

  const validEvents = Array.from(uniqueMap.values()).sort((a, b) => a.ts - b.ts);
  if (validEvents.length < 2) {
    return [];
  }

  // Identify distinct 1-second epochs
  const epochSecs = Array.from(new Set(validEvents.map((e) => Math.floor(e.ts / 1000)))).sort((a, b) => a - b);
  const metrics: StreamMetric[] = [];

  for (const epochSec of epochSecs) {
    const targetMs = (epochSec + 1) * 1000 - 1; // End of this second
    const cutoff = targetMs - windowMs;

    // Events up to this epoch within the 30-second window
    const inWindow = validEvents.filter((e) => e.ts <= targetMs && e.ts >= cutoff);
    if (inWindow.length < 2) continue;

    const minTs = Math.min(...inWindow.map((e) => e.ts));
    const maxTs = Math.max(...inWindow.map((e) => e.ts));
    const elapsedSec = (maxTs - minTs) / 1000;

    if (elapsedSec < 1.0) continue; // Require at least 1s span to calculate rate

    const eventsPerSec = Number((inWindow.length / elapsedSec).toFixed(1));
    const threatCount = inWindow.filter((e) => e.isThreat).length;
    const threatsPerMin = Number(((threatCount / elapsedSec) * 60).toFixed(1));

    metrics.push({
      time: formatMetricTime(epochSec * 1000),
      events: eventsPerSec,
      threats: threatsPerMin,
      epochSec,
    });
  }

  return metrics.slice(-maxPoints);
}

/**
 * Merge new metric points with existing points:
 * - Strict deduplication by `epochSec`
 * - Chronological ascending sort
 * - Bounded slice to retain the most recent window
 */
export function mergeStreamMetrics(
  existing: StreamMetric[],
  incoming: StreamMetric[],
  maxPoints = 30
): StreamMetric[] {
  const map = new Map<number, StreamMetric>();

  // Add existing points
  for (const p of existing) {
    if (typeof p.epochSec === 'number' && !Number.isNaN(p.epochSec)) {
      map.set(p.epochSec, p);
    }
  }

  // Merge or overwrite with incoming points
  for (const p of incoming) {
    if (typeof p.epochSec === 'number' && !Number.isNaN(p.epochSec)) {
      map.set(p.epochSec, p);
    }
  }

  // Sort strictly ascending by epoch timestamp
  const sorted = Array.from(map.values()).sort((a, b) => a.epochSec - b.epochSec);

  return sorted.slice(-maxPoints);
}
