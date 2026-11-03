/**
 * Regression and Unit Tests for Replay Stream Metrics
 *
 * Verifies:
 * 1. Honest empty/unavailable state when data is absent or insufficient (no fabrication)
 * 2. Accurate Throughput (Events/sec) and Threat Detections (Threats/min) from actual event timestamps
 * 3. Irregular batch timing across realistic intervals without single-batch clamping artifacts
 * 4. Zero elapsed time (identical timestamps) safely handled without division-by-zero or false rates
 * 5. Deduplication of duplicate event IDs (each unique event counted at most once)
 * 6. Rolling-window boundary eviction (events older than 30s excluded)
 * 7. Navigation rehydration via module cache for both events and metrics
 * 8. Both chart histories (Throughput & Threats) retained, chronologically ordered, and deduplicated
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRollingWindowRate,
  calculateMetricsFromEvents,
  mergeStreamMetrics,
  getCachedMetrics,
  setCachedMetrics,
  clearCachedMetrics,
  getCachedEvents,
  setCachedEvents,
  clearCachedEvents,
  formatMetricTime,
  formatFlowDuration,
  formatRiskScore,
  parseUtcTimestamp,
  formatProcessingTime,
  formatTimelineLocalTime,
  categorizeTimelineEvent,
  aggregateTimelineEvents,
  type StreamMetric,
} from './replayMetrics.ts';
import type { NetworkEvent } from '../types.ts';

describe('Replay Stream Metrics & Chart Telemetry', () => {
  it('returns honest unavailable state when events are absent or fewer than 2', () => {
    const emptyRate = calculateRollingWindowRate([]);
    assert.equal(emptyRate.isAvailable, false);
    assert.equal(emptyRate.eventsPerSec, null);
    assert.equal(emptyRate.threatsPerMin, null);
    assert.equal(emptyRate.uniqueEventsCount, 0);

    const singleEventRate = calculateRollingWindowRate([
      { id: 'evt-1', timestamp: '2026-10-30T00:00:00.000Z', prediction: 'ATTACK' },
    ]);
    assert.equal(singleEventRate.isAvailable, false);
    assert.equal(singleEventRate.eventsPerSec, null);
    assert.equal(singleEventRate.threatsPerMin, null);
    assert.equal(singleEventRate.uniqueEventsCount, 1);

    const emptyMetrics = calculateMetricsFromEvents([]);
    assert.deepEqual(emptyMetrics, []);
  });

  it('calculates accurate Throughput (Events/sec) and Threats/min over a 30-second rolling window', () => {
    const baseEpoch = 1730000000000;
    // 20 events over 10 seconds: 15 BENIGN, 5 ATTACK
    const mockEvents = Array.from({ length: 20 }, (_, i) => ({
      id: `evt-${i}`,
      timestamp: new Date(baseEpoch + i * 500).toISOString(), // 0s to 9.5s
      prediction: i % 4 === 0 ? 'ATTACK' : 'BENIGN', // 5 threats: i = 0, 4, 8, 12, 16
    }));

    const rate = calculateRollingWindowRate(mockEvents, 30000, 1.0);
    assert.equal(rate.isAvailable, true);
    assert.equal(rate.uniqueEventsCount, 20);
    assert.equal(rate.uniqueThreatsCount, 5);
    // Span = 9.5s; Throughput = 20 / 9.5 = 2.1 ev/s; Threats/min = (5 / 9.5) * 60 = 31.6 threats/min
    assert.equal(rate.eventsPerSec, 2.1);
    assert.equal(rate.threatsPerMin, 31.6);
  });

  it('handles irregular batch timing accurately without single-batch clamping artifacts', () => {
    const baseEpoch = 1730000000000;
    // Batch 1 (3 events at t = 0s)
    // Batch 2 (2 events at t = 2s)
    // Batch 3 (5 events at t = 6s, including 2 threats)
    const irregularEvents = [
      { id: 'b1-1', timestamp: new Date(baseEpoch).toISOString(), prediction: 'BENIGN' },
      { id: 'b1-2', timestamp: new Date(baseEpoch + 100).toISOString(), prediction: 'BENIGN' },
      { id: 'b1-3', timestamp: new Date(baseEpoch + 200).toISOString(), prediction: 'BENIGN' },
      { id: 'b2-1', timestamp: new Date(baseEpoch + 2000).toISOString(), prediction: 'BENIGN' },
      { id: 'b2-2', timestamp: new Date(baseEpoch + 2100).toISOString(), prediction: 'BENIGN' },
      { id: 'b3-1', timestamp: new Date(baseEpoch + 6000).toISOString(), prediction: 'DoS' },
      { id: 'b3-2', timestamp: new Date(baseEpoch + 6050).toISOString(), prediction: 'BENIGN' },
      { id: 'b3-3', timestamp: new Date(baseEpoch + 6100).toISOString(), prediction: 'PortScan' },
      { id: 'b3-4', timestamp: new Date(baseEpoch + 6150).toISOString(), prediction: 'BENIGN' },
      { id: 'b3-5', timestamp: new Date(baseEpoch + 6200).toISOString(), prediction: 'BENIGN' },
    ];

    const rate = calculateRollingWindowRate(irregularEvents, 30000, 1.0);
    assert.equal(rate.isAvailable, true);
    assert.equal(rate.uniqueEventsCount, 10);
    assert.equal(rate.uniqueThreatsCount, 2);
    // Span = 6.2s; Throughput = 10 / 6.2 = 1.6 ev/s; Threats/min = (2 / 6.2) * 60 = 19.4 threats/min
    assert.equal(rate.eventsPerSec, 1.6);
    assert.equal(rate.threatsPerMin, 19.4);
  });

  it('safely handles zero elapsed time (identical timestamps) without division by zero or fabrication', () => {
    const baseEpoch = 1730000000000;
    // 5 events all arriving at the EXACT same millisecond
    const simultaneousEvents = Array.from({ length: 5 }, (_, i) => ({
      id: `simul-${i}`,
      timestamp: new Date(baseEpoch).toISOString(),
      prediction: i === 0 ? 'ATTACK' : 'BENIGN',
    }));

    // Elapsed seconds = 0.0, which is < minSpanSec (1.0).
    // Must return honest unavailable state rather than Infinity, NaN, or clamped 360/20 values.
    const rate = calculateRollingWindowRate(simultaneousEvents, 30000, 1.0);
    assert.equal(rate.isAvailable, false);
    assert.equal(rate.eventsPerSec, null);
    assert.equal(rate.threatsPerMin, null);
    assert.equal(rate.windowSpanSec, 0);
    assert.equal(rate.uniqueEventsCount, 5);
  });

  it('counts each unique event ID at most once during repeated polling and overlap', () => {
    const baseEpoch = 1730000000000;
    const initialEvents = [
      { id: 'dup-1', timestamp: new Date(baseEpoch).toISOString(), prediction: 'ATTACK' },
      { id: 'dup-2', timestamp: new Date(baseEpoch + 2000).toISOString(), prediction: 'BENIGN' },
      { id: 'dup-3', timestamp: new Date(baseEpoch + 4000).toISOString(), prediction: 'DoS' },
    ];

    // Repeated poll delivers overlapping events with same IDs
    const duplicateEvents = [
      ...initialEvents,
      { id: 'dup-1', timestamp: new Date(baseEpoch).toISOString(), prediction: 'ATTACK' },
      { id: 'dup-2', timestamp: new Date(baseEpoch + 2000).toISOString(), prediction: 'BENIGN' },
      { id: 'dup-3', timestamp: new Date(baseEpoch + 4000).toISOString(), prediction: 'DoS' },
      { id: 'dup-4', timestamp: new Date(baseEpoch + 5000).toISOString(), prediction: 'BENIGN' },
    ];

    const rate = calculateRollingWindowRate(duplicateEvents, 30000, 1.0);
    assert.equal(rate.isAvailable, true);
    assert.equal(rate.uniqueEventsCount, 4); // Only 4 unique events, not 7
    assert.equal(rate.uniqueThreatsCount, 2); // Only 2 unique threats (dup-1, dup-3), not 4
    // Span = 5.0s; Throughput = 4 / 5 = 0.8 ev/s; Threats = (2 / 5) * 60 = 24.0 threats/min
    assert.equal(rate.eventsPerSec, 0.8);
    assert.equal(rate.threatsPerMin, 24.0);
  });

  it('evicts events outside the 30-second rolling window boundary', () => {
    const baseEpoch = 1730000000000;
    // Events spanning 45 seconds:
    // 3 events at t = 0s (outside 30s window of t = 40s)
    // 4 events at t = 20s to 40s (inside 30s window [10s, 40s])
    const boundaryEvents = [
      { id: 'old-1', timestamp: new Date(baseEpoch).toISOString(), prediction: 'ATTACK' },
      { id: 'old-2', timestamp: new Date(baseEpoch + 1000).toISOString(), prediction: 'ATTACK' },
      { id: 'old-3', timestamp: new Date(baseEpoch + 2000).toISOString(), prediction: 'ATTACK' },
      // Window cutoff for latest event (t + 40s) is t + 10s:
      { id: 'win-1', timestamp: new Date(baseEpoch + 20000).toISOString(), prediction: 'BENIGN' },
      { id: 'win-2', timestamp: new Date(baseEpoch + 25000).toISOString(), prediction: 'BENIGN' },
      { id: 'win-3', timestamp: new Date(baseEpoch + 30000).toISOString(), prediction: 'ATTACK' },
      { id: 'win-4', timestamp: new Date(baseEpoch + 40000).toISOString(), prediction: 'BENIGN' },
    ];

    const rate = calculateRollingWindowRate(boundaryEvents, 30000, 1.0);
    assert.equal(rate.isAvailable, true);
    // Only 4 events in the [10s, 40s] window; the 3 old events are evicted
    assert.equal(rate.uniqueEventsCount, 4);
    assert.equal(rate.uniqueThreatsCount, 1); // Only win-3
    // Span = (40s - 20s) = 20.0s; Throughput = 4 / 20 = 0.2 ev/s; Threats = (1 / 20) * 60 = 3.0 threats/min
    assert.equal(rate.eventsPerSec, 0.2);
    assert.equal(rate.threatsPerMin, 3.0);
  });

  it('retains historical data in module cache across component unmount/remount (navigation rehydration)', () => {
    clearCachedMetrics();
    clearCachedEvents();
    assert.deepEqual(getCachedMetrics(), []);
    assert.deepEqual(getCachedEvents(), []);

    const simulatedMetrics: StreamMetric[] = [
      { time: '12:00:00', events: 5.0, threats: 30.0, epochSec: 2000 },
      { time: '12:00:02', events: 5.5, threats: 32.0, epochSec: 2002 },
    ];
    const simulatedEvents: NetworkEvent[] = [
      {
        id: 'evt-cached-1',
        source_ip: '10.0.0.1',
        destination_ip: '10.0.0.2',
        source_port: 1234,
        destination_port: 80,
        protocol: 'TCP',
        flow_duration: 1000,
        total_fwd_packets: 10,
        total_bwd_packets: 10,
        total_length_fwd_packets: 500,
        total_length_bwd_packets: 500,
        flow_bytes_per_sec: 1000,
        flow_packets_per_sec: 20,
        timestamp: '2026-10-30T12:00:00.000Z',
        prediction: 'BENIGN',
        confidence: 0.99,
        risk_score: 5.0,
      },
    ];

    setCachedMetrics(simulatedMetrics);
    setCachedEvents(simulatedEvents);

    // Simulate navigation away to Models/Alerts and returning to LiveMonitor
    const restoredMetrics = getCachedMetrics();
    const restoredEvents = getCachedEvents();

    assert.equal(restoredMetrics.length, 2);
    assert.deepEqual(restoredMetrics, simulatedMetrics);
    assert.equal(restoredEvents.length, 1);
    assert.equal(restoredEvents[0].id, 'evt-cached-1');

    clearCachedMetrics();
    clearCachedEvents();
  });

  it('preserves chronological ordering and avoids duplicate points in both chart histories', () => {
    const existingChartPoints: StreamMetric[] = [
      { time: '10:00:00', events: 4.0, threats: 20.0, epochSec: 1000 },
      { time: '10:00:02', events: 4.5, threats: 22.0, epochSec: 1002 },
      { time: '10:00:04', events: 5.0, threats: 25.0, epochSec: 1004 },
    ];

    // Incoming points with an overlap (epochSec: 1004) and new chronological points (1006, 1008)
    const incomingPoints: StreamMetric[] = [
      { time: '10:00:04', events: 5.1, threats: 25.5, epochSec: 1004 }, // Overwrite/dedup
      { time: '10:00:08', events: 6.0, threats: 30.0, epochSec: 1008 },
      { time: '10:00:06', events: 5.8, threats: 28.0, epochSec: 1006 }, // Shuffled order
    ];

    const merged = mergeStreamMetrics(existingChartPoints, incomingPoints);

    // Verify length = 5 (1000, 1002, 1004, 1006, 1008)
    assert.equal(merged.length, 5);
    assert.deepEqual(
      merged.map((p) => p.epochSec),
      [1000, 1002, 1004, 1006, 1008]
    );

    // Verify strictly ascending ordering
    for (let i = 0; i < merged.length - 1; i++) {
      assert.ok(merged[i].epochSec < merged[i + 1].epochSec);
    }

    // Verify both Throughput (events) and Threat Detections (threats) data retained
    assert.equal(merged[4].events, 6.0);
    assert.equal(merged[4].threats, 30.0);
  });

  it('reconstructs rolling chart points from historical events via calculateMetricsFromEvents', () => {
    const baseEpoch = 1730000000000;
    // 30 events spread across 15 seconds
    const mockEvents = Array.from({ length: 30 }, (_, i) => ({
      id: `hist-${i}`,
      timestamp: new Date(baseEpoch + i * 500).toISOString(),
      prediction: i % 5 === 0 ? 'ATTACK' : 'BENIGN',
    }));

    const chartPoints = calculateMetricsFromEvents(mockEvents, 30000, 20);
    assert.ok(chartPoints.length > 0);
    // All points must have formatted time, positive throughput, and valid epoch
    for (const pt of chartPoints) {
      assert.ok(pt.time.length > 0);
      assert.ok(pt.events > 0);
      assert.ok(pt.threats >= 0);
      assert.ok(pt.epochSec > 0);
    }

    // Format metric time helper verification
    const formatted = formatMetricTime(baseEpoch);
    assert.match(formatted, /^\d{2}:\d{2}:\d{2}$/);
  });

  it('correctly formats CIC-IDS2017 Flow Duration from microseconds according to threshold rules', () => {
    // >= 1,000,000 µs: display seconds
    assert.equal(formatFlowDuration(105066879), '105.1s');
    assert.equal(formatFlowDuration(5980324), '6.0s');
    assert.equal(formatFlowDuration(1000000), '1.0s');

    // >= 1,000 µs: display milliseconds
    assert.equal(formatFlowDuration(182390), '182.4ms');
    assert.equal(formatFlowDuration(66331), '66.3ms');
    assert.equal(formatFlowDuration(32400), '32.4ms');
    assert.equal(formatFlowDuration(1000), '1.0ms');

    // < 1,000 µs: display microseconds
    assert.equal(formatFlowDuration(239), '239µs');
    assert.equal(formatFlowDuration(52), '52µs');
    assert.equal(formatFlowDuration(0), '0µs');

    // Edge cases: null, undefined, NaN
    assert.equal(formatFlowDuration(null), '0µs');
    assert.equal(formatFlowDuration(undefined), '0µs');
    assert.equal(formatFlowDuration(NaN), '0µs');
  });

  it('formats risk scores on a composite 0-100 scale without percent suffix', () => {
    // Near zero floats from benign rounding
    assert.equal(formatRiskScore(0.0), '0.0');
    assert.equal(formatRiskScore(0.0029999), '0.0');
    assert.equal(formatRiskScore(0.6), '0.6');
    assert.equal(formatRiskScore(9.0), '9.0');

    // Typical attack risk scores
    assert.equal(formatRiskScore(78.0), '78.0');
    assert.equal(formatRiskScore(78), '78.0');
    assert.equal(formatRiskScore(63.3), '63.3');

    // Verify absence of '%' suffix
    assert.doesNotMatch(formatRiskScore(78.0), /%/);
    assert.doesNotMatch(formatRiskScore(0.0), /%/);

    // Boundary and fallback handling
    assert.equal(formatRiskScore(null), '0.0');
    assert.equal(formatRiskScore(undefined), '0.0');
    assert.equal(formatRiskScore(105.5), '100.0');
    assert.equal(formatRiskScore(-5), '0.0');
  });

  it('safely parses UTC timestamps whether ISO string is explicit Z, offset, or naive', () => {
    // 1. Explicit 'Z'
    const d1 = parseUtcTimestamp('2026-10-31T19:03:04.210Z');
    assert.equal(d1.getUTCFullYear(), 2026);
    assert.equal(d1.getUTCHours(), 19);
    assert.equal(d1.getUTCMinutes(), 3);
    assert.equal(d1.getUTCSeconds(), 4);
    assert.equal(d1.getUTCMilliseconds(), 210);

    // 2. Explicit '+00:00' offset
    const d2 = parseUtcTimestamp('2026-10-31T19:03:04.210+00:00');
    assert.equal(d2.getTime(), d1.getTime());

    // 3. Naive ISO string (no Z or offset) - must be forced to UTC
    const d3 = parseUtcTimestamp('2026-10-31T19:03:04.210');
    assert.equal(d3.getTime(), d1.getTime());

    // 4. Fallback handling for null, undefined, Date, epoch
    const now = new Date();
    assert.ok(parseUtcTimestamp(null) instanceof Date);
    assert.ok(parseUtcTimestamp(undefined) instanceof Date);
    assert.equal(parseUtcTimestamp(now).getTime(), now.getTime());
    assert.equal(parseUtcTimestamp(1730000000000).getTime(), 1730000000000);
  });

  it('formats replay processing time in local time with 3-digit millisecond string', () => {
    const formatted = formatProcessingTime('2026-10-31T19:03:04.210Z');
    assert.ok(formatted.timeStr);
    assert.match(formatted.timeStr, /^\d{2}:\d{2}:\d{2}$/);
    assert.equal(formatted.msStr, '210');

    // Single digit ms padded with leading zeros
    const formattedPad = formatProcessingTime('2026-10-31T19:03:04.005Z');
    assert.equal(formattedPad.msStr, '005');
  });

  it('correctly categorizes timeline events following project thresholds', () => {
    // Normal traffic: BENIGN flows below ALERT_RISK_THRESHOLD (50.0)
    assert.equal(categorizeTimelineEvent({ risk_score: 0.0, prediction: 'BENIGN', attack_type: 'BENIGN' }), 'normal');
    assert.equal(categorizeTimelineEvent({ risk_score: 5.5, prediction: 'BENIGN', attack_type: 'BENIGN' }), 'normal');
    assert.equal(categorizeTimelineEvent({ risk_score: 49.9, prediction: 'BENIGN', attack_type: 'BENIGN' }), 'normal');

    // Suspicious activity: 50.0 <= risk < 75.0 or flagged attacks below CRITICAL_RISK_THRESHOLD
    assert.equal(categorizeTimelineEvent({ risk_score: 50.0, prediction: 'BENIGN', attack_type: 'BENIGN' }), 'suspicious');
    assert.equal(categorizeTimelineEvent({ risk_score: 60.0, prediction: 'ATTACK', attack_type: 'DoS' }), 'suspicious');
    assert.equal(categorizeTimelineEvent({ risk_score: 74.9, prediction: 'ATTACK', attack_type: 'PortScan' }), 'suspicious');
    assert.equal(categorizeTimelineEvent({ risk_score: 10.0, prediction: 'ATTACK', attack_type: 'DoS' }), 'suspicious');

    // Critical events: risk >= 75.0 (CRITICAL_RISK_THRESHOLD)
    assert.equal(categorizeTimelineEvent({ risk_score: 75.0, prediction: 'ATTACK', attack_type: 'DDoS' }), 'critical');
    assert.equal(categorizeTimelineEvent({ risk_score: 85.0, prediction: 'ATTACK', attack_type: 'DDoS' }), 'critical');
    assert.equal(categorizeTimelineEvent({ risk_score: 100.0, prediction: 'ATTACK', attack_type: 'DDoS' }), 'critical');
  });

  it('formats timeline local time appropriately for both sub-minute and minute/hour buckets', () => {
    // Minute/hourly bucket: HH:MM
    const hourlyStr = formatTimelineLocalTime('2026-10-31T19:30:00.000Z', 3600);
    assert.match(hourlyStr, /^\d{2}:\d{2}$/);

    const fiveMinStr = formatTimelineLocalTime('2026-10-31T19:30:00.000Z', 300);
    assert.match(fiveMinStr, /^\d{2}:\d{2}$/);

    // Sub-minute bucket (< 60s): HH:MM:SS
    const subMinStr = formatTimelineLocalTime('2026-10-31T19:30:15.000Z', 30);
    assert.match(subMinStr, /^\d{2}:\d{2}:\d{2}$/);
  });

  it('aggregates events into chronological timeline buckets with honest empty state on empty input', () => {
    // 1. Empty events array -> honest empty array (no fabrication)
    assert.deepEqual(aggregateTimelineEvents([]), []);

    // 2. Sample events spanning 2 distinct buckets with an empty bucket in between
    const baseEpoch = 1730000000000; // t = 0
    const mockEvents = [
      // Bucket 0 (t = 0 to 60s): 2 Normal, 1 Critical
      { timestamp: new Date(baseEpoch + 5000).toISOString(), risk_score: 6.0, prediction: 'BENIGN' },
      { timestamp: new Date(baseEpoch + 15000).toISOString(), risk_score: 12.0, prediction: 'BENIGN' },
      { timestamp: new Date(baseEpoch + 25000).toISOString(), risk_score: 80.0, prediction: 'ATTACK', attack_type: 'DDoS' },
      // Bucket 2 (t = 120s to 180s): 1 Suspicious
      { timestamp: new Date(baseEpoch + 130000).toISOString(), risk_score: 65.0, prediction: 'ATTACK', attack_type: 'DoS' },
    ];

    const buckets = aggregateTimelineEvents(mockEvents, 60);
    assert.equal(buckets.length, 3); // Bucket 0, Bucket 1 (empty), Bucket 2

    // Bucket 0
    assert.equal(buckets[0].normal, 2);
    assert.equal(buckets[0].suspicious, 0);
    assert.equal(buckets[0].critical, 1);
    assert.equal(buckets[0].total, 3);

    // Bucket 1 (intermediate empty bucket without fabricated data)
    assert.equal(buckets[1].normal, 0);
    assert.equal(buckets[1].suspicious, 0);
    assert.equal(buckets[1].critical, 0);
    assert.equal(buckets[1].total, 0);

    // Bucket 2
    assert.equal(buckets[2].normal, 0);
    assert.equal(buckets[2].suspicious, 1);
    assert.equal(buckets[2].critical, 0);
    assert.equal(buckets[2].total, 1);
  });
});
