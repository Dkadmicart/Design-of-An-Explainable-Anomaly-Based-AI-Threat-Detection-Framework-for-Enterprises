import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Play, Pause, Square, Gauge, Database, Radio, Activity, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../services/api';
import type { NetworkEvent, DatasetFile } from '../types';
import { hasValidFlowFeatures } from '../services/flowFeatures';
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
  type StreamMetric,
} from '../services/replayMetrics';
import { PageContainer, PageHeader } from '../components/common/PageContainer';
import { Card } from '../components/common/Card';
import { EmptyState } from '../components/common/EmptyState';
import { DataTable } from '../components/common/DataTable';
import { Badge } from '../components/common/Badge';

const SPEED_OPTIONS = [1, 2, 5, 10];

// Extended event interface for live stream tracking
interface MonitoredEvent extends NetworkEvent {
  inference_source?: 'xgboost_live' | 'bypassed_headers_only';
}

// Sample flow probes for testing XGBoost inference directly
const SAMPLE_VERIFIED_FLOWS: Record<string, { label: string; attackType: string; isPartial: boolean; features: Record<string, unknown> }> = {
  dos: {
    label: 'DoS (SYN-Flood) Reference Flow',
    attackType: 'DoS',
    isPartial: true,
    features: {
      'Protocol': 6,
      'Flow Duration': 182390,
      'Total Fwd Packets': 12,
      'Total Backward Packets': 1,
      'Fwd Packet Length Max': 1460,
      'Fwd Packet Length Min': 0,
      'Fwd Packet Length Mean': 820.5,
      'Bwd Packet Length Max': 0,
      'Flow Bytes/s': 54200.1,
      'Flow Packets/s': 71.2,
      'Flow IAT Mean': 15200.0,
      'Fwd IAT Mean': 16100.0,
      'FIN Flag Count': 1,
      'SYN Flag Count': 1,
      'ACK Flag Count': 1,
      'Avg Packet Size': 780.0,
      'Init Fwd Win Bytes': 29200,
    },
  },
  portscan: {
    label: 'PortScan Partial Probe (Unverified Ground Truth)',
    attackType: 'PortScan',
    isPartial: true,
    features: {
      'Protocol': 6,
      'Flow Duration': 52,
      'Total Fwd Packets': 2,
      'Total Backward Packets': 1,
      'Fwd Packet Length Max': 0,
      'Fwd Packet Length Min': 0,
      'Bwd Packet Length Max': 0,
      'Flow Packets/s': 57692.3,
      'SYN Flag Count': 1,
      'RST Flag Count': 1,
      'Init Fwd Win Bytes': 1024,
    },
  },
  benign: {
    label: 'Normal HTTP/TLS Reference Flow',
    attackType: 'BENIGN',
    isPartial: true,
    features: {
      'Protocol': 6,
      'Flow Duration': 32400,
      'Total Fwd Packets': 8,
      'Total Backward Packets': 9,
      'Fwd Packet Length Max': 250,
      'Bwd Packet Length Max': 1460,
      'Flow Bytes/s': 42000.0,
      'Flow IAT Mean': 2100.0,
      'ACK Flag Count': 1,
      'Avg Packet Size': 410.0,
      'Init Fwd Win Bytes': 65535,
    },
  },
};

export default function LiveMonitorPage() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [datasetFiles, setDatasetFiles] = useState<DatasetFile[]>([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [events, setEvents] = useState<MonitoredEvent[]>(() => getCachedEvents() as MonitoredEvent[]);
  const [metrics, setMetrics] = useState<StreamMetric[]>(() => getCachedMetrics());
  const [totalEvents, setTotalEvents] = useState(0);
  const [totalThreats, setTotalThreats] = useState(0);
  const [isTestingFlow, setIsTestingFlow] = useState(false);
  const [testSuccessNotice, setTestSuccessNotice] = useState<string | null>(null);

  const processingRef = useRef(false);

  useEffect(() => {
    api.getDatasets().then(res => {
      if (res.datasets.length > 0 && res.datasets[0].files.length > 0) {
        setDatasetFiles(res.datasets[0].files);
        setSelectedFile(res.datasets[0].files[0].name);
      }
    }).catch(console.error);
  }, []);

  // Re-hydrate running replay status and chart telemetry on mount (supports page navigation)
  useEffect(() => {
    let isMounted = true;
    api.getReplayStatus().then((status) => {
      if (!isMounted) return;
      if (status && status.is_running) {
        setIsStreaming(true);
        setIsPaused(status.is_paused);
        setTotalEvents(status.events_sent);
        if (status.speed) setSpeed(status.speed);
        if (status.current_file) setSelectedFile(status.current_file);

        // If backend recorded metric points while user was away on other pages, merge them into state & cache
        if (status.metrics && status.metrics.length > 0) {
          const backendMetrics: StreamMetric[] = status.metrics.map((m) => ({
            time: m.time,
            events: m.events,
            threats: m.threats,
            epochSec: m.epoch_sec,
          }));
          setMetrics((prev) => {
            const merged = mergeStreamMetrics(prev, backendMetrics);
            setCachedMetrics(merged);
            return merged;
          });
        }
      }
    }).catch(() => {
      // Backend may be starting up
    });

    // Load recent events on mount to restore workspace view immediately and reconstruct metrics if needed
    api.getEvents({ page_size: 50 }).then((res) => {
      if (!isMounted || !res.events || res.events.length === 0) return;
      const initialEvents: MonitoredEvent[] = res.events.map((e) => ({
        ...e,
        inference_source: hasValidFlowFeatures(e.features)
          ? ('xgboost_live' as const)
          : ('bypassed_headers_only' as const),
      }));
      setEvents((prev) => {
        const existingIds = new Set(prev.map((e) => e.id));
        const merged = [...prev, ...initialEvents.filter((e) => !existingIds.has(e.id))].slice(0, 100);
        setCachedEvents(merged);
        return merged;
      });
      const threats = initialEvents.filter((e) => e.prediction && e.prediction !== 'BENIGN').length;
      setTotalThreats((prev) => Math.max(prev, threats));

      // Reconstruct historical rate data if no active metrics are cached
      setMetrics((prev) => {
        if (prev.length > 0) return prev;
        const reconstructed = calculateMetricsFromEvents(initialEvents, 30000);
        if (reconstructed.length > 0) {
          setCachedMetrics(reconstructed);
          return reconstructed;
        }
        return prev;
      });
    }).catch(() => {
      // Ignore initial event fetch error
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Main streaming loop: polls latest events and syncs backend worker progress (read-only polling)
  useEffect(() => {
    let timer: number | null = null;
    if (isStreaming && !isPaused) {
      timer = window.setInterval(async () => {
        if (processingRef.current) return;
        processingRef.current = true;

        try {
          // Check if backend worker finished the dataset or changed state
          const statusRes = await api.getReplayStatus();
          if (statusRes && !statusRes.is_running && !statusRes.is_paused) {
            setIsStreaming(false);
            setTestSuccessNotice('Dataset replay completed.');
            return;
          }
          if (statusRes) {
            setTotalEvents(statusRes.events_sent);
            setIsPaused(statusRes.is_paused);
            if (statusRes.metrics && statusRes.metrics.length > 0) {
              const backendMetrics: StreamMetric[] = statusRes.metrics.map((m) => ({
                time: m.time,
                events: m.events,
                threats: m.threats,
                epochSec: m.epoch_sec,
              }));
              setMetrics((m) => {
                const merged = mergeStreamMetrics(m, backendMetrics);
                setCachedMetrics(merged);
                return merged;
              });
            }
          }

          // Fetch the latest flow events persisted by the backend worker
          const res = await api.getEvents({ page_size: 15 });
          if (res.events && res.events.length > 0) {
            setEvents((prev) => {
              // Deduplicate strictly by event.id so repeated polling never duplicates records
              const existingIds = new Set(prev.map((e) => e.id));
              const trulyNew = res.events
                .filter((e) => !existingIds.has(e.id))
                .map((e) => ({
                  ...e,
                  inference_source: hasValidFlowFeatures(e.features)
                    ? ('xgboost_live' as const)
                    : ('bypassed_headers_only' as const),
                }));

              if (trulyNew.length === 0) return prev;

              // Calculate genuine threats and throughput from authentic arrivals (no Math.random)
              const newThreats = trulyNew.filter((e) => e.prediction && e.prediction !== 'BENIGN').length;
              setTotalThreats((t) => t + newThreats);

              const updatedEvents = [...trulyNew, ...prev].slice(0, 100);
              setCachedEvents(updatedEvents);

              // Calculate rate point using authentic 30s rolling window across unique events
              const rollingRate = calculateRollingWindowRate(updatedEvents, 30000, 1.0);
              if (rollingRate.isAvailable && rollingRate.eventsPerSec !== null) {
                const timestamps = updatedEvents.map((e) => new Date(e.timestamp).getTime()).filter((t) => !Number.isNaN(t));
                const maxTs = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();
                const epochSec = Math.floor(maxTs / 1000);
                const timeStr = formatMetricTime(maxTs);

                const newPoint: StreamMetric = {
                  time: timeStr,
                  events: rollingRate.eventsPerSec,
                  threats: rollingRate.threatsPerMin ?? 0,
                  epochSec,
                };

                setMetrics((m) => {
                  const merged = mergeStreamMetrics(m, [newPoint]);
                  setCachedMetrics(merged);
                  return merged;
                });
              }

              return updatedEvents;
            });
          }
        } catch (err) {
          console.error('Error in replay stream polling:', err);
        } finally {
          processingRef.current = false;
        }
      }, Math.max(1000, 2000 / speed));
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isStreaming, isPaused, speed]);

  const handleStart = async () => {
    setIsStreaming(true);
    setIsPaused(false);
    setEvents([]);
    clearCachedEvents();
    clearCachedMetrics();
    setMetrics([]);
    setTotalEvents(0);
    setTotalThreats(0);
    try {
      await api.startReplay({ speed, dataset_file: selectedFile, batch_size: 10, loop: false });
      const statusRes = await api.getReplayStatus();
      if (statusRes) {
        setTotalEvents(statusRes.events_sent);
      }
    } catch (err) {
      console.error('Failed to trigger backend replay ingestion:', err);
    }
  };

  const handlePause = async () => {
    const nextPaused = !isPaused;
    setIsPaused(nextPaused);
    try {
      if (nextPaused) {
        await api.pauseReplay();
      } else {
        await api.resumeReplay();
      }
    } catch (err) {
      console.error('Failed to update replay pause state:', err);
    }
  };

  const handleStop = async () => {
    setIsStreaming(false);
    setIsPaused(false);
    try {
      await api.stopReplay();
    } catch (err) {
      console.error('Failed to stop backend replay:', err);
    }
  };

  // Test flow probe injection
  const handleInjectSampleFlow = async (key: 'dos' | 'portscan' | 'benign') => {
    setIsTestingFlow(true);
    setTestSuccessNotice(null);
    try {
      const sample = SAMPLE_VERIFIED_FLOWS[key];
      const predRes = await api.predictThreat({
        features: sample.features,
        attack_type: sample.attackType,
        historical_risk: sample.attackType === 'BENIGN' ? 0 : 25,
      });

      const newEvt: MonitoredEvent = {
        id: `probe-sim-${Date.now()}`,
        timestamp: new Date().toISOString(),
        source_ip: key === 'benign' ? '192.168.10.15' : '172.16.0.1',
        destination_ip: '192.168.10.50',
        source_port: Math.floor(10000 + Math.random() * 40000),
        destination_port: key === 'portscan' ? 445 : (key === 'benign' ? 443 : 80),
        protocol: 'TCP',
        flow_duration: (sample.features['Flow Duration'] as number) || 50,
        total_fwd_packets: (sample.features['Total Fwd Packets'] as number) || 2,
        total_bwd_packets: (sample.features['Total Backward Packets'] as number) || 1,
        total_length_fwd_packets: 4096,
        total_length_bwd_packets: 2048,
        flow_bytes_per_sec: 12500,
        flow_packets_per_sec: 25,
        features: sample.features as Record<string, number>,
        prediction: predRes.prediction,
        confidence: predRes.confidence,
        anomaly_score: predRes.anomaly_score,
        risk_score: predRes.risk_score,
        attack_type: (predRes.prediction === 'ATTACK' ? (sample.attackType as any) : 'BENIGN'),
        model_version: predRes.model_version,
        model_name: predRes.model_name,
        dataset_source: `Synthetic Probe (${sample.label})`,
        inference_source: 'xgboost_live',
      };

      const now = Date.now();
      setEvents((prev) => {
        const updated = [newEvt, ...prev].slice(0, 100);
        setCachedEvents(updated);
        const rate = calculateRollingWindowRate(updated, 30000, 1.0);
        if (rate.isAvailable && rate.eventsPerSec !== null) {
          const probePoint: StreamMetric = {
            time: formatMetricTime(now),
            events: rate.eventsPerSec,
            threats: rate.threatsPerMin ?? 0,
            epochSec: Math.floor(now / 1000),
          };
          setMetrics((m) => {
            const merged = mergeStreamMetrics(m, [probePoint]);
            setCachedMetrics(merged);
            return merged;
          });
        }
        return updated;
      });
      setTotalEvents((p) => p + 1);
      if (predRes.prediction === 'ATTACK') setTotalThreats((p) => p + 1);

      setTestSuccessNotice(
        `Probe output (${sample.label}): Prediction = ${predRes.prediction} (Confidence: ${(predRes.confidence * 100).toFixed(2)}%, Risk: ${predRes.risk_score.toFixed(1)}/100). Note: Synthetic partial probe with 10 features; missing 59 features are imputed with benign dataset medians.`
      );
    } catch (err: unknown) {
      console.error('Flow test error:', err);
    } finally {
      setIsTestingFlow(false);
    }
  };

  // Derive authentic live rolling-window rate telemetry over the current 30-second window
  const liveRate = calculateRollingWindowRate(events, 30000, 1.0);

  return (
    <PageContainer>
      {/* Page Header */}
      <PageHeader
        title="Live Threat Monitor"
        subtitle="Detection stream workspace — Replay telemetry & real-time XGBoost inference"
        statusBadge={
          <Badge variant="low" className="px-3 py-1 text-xs font-bold uppercase tracking-wide">
            Stream Replay Workspace
          </Badge>
        }
        actions={
          <span className="text-xs font-semibold text-slate-500 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            Dataset Source: <strong className="text-slate-800">{selectedFile || 'CIC-IDS2017 Benchmark'}</strong>
          </span>
        }
      />

      {/* Top Replay Control Bar */}
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        {/* Playback Controls */}
        <div className="flex items-center gap-3">
          {!isStreaming ? (
            <button className="btn btn-primary px-5" onClick={handleStart}>
              <Play size={16} /> Start Replay
            </button>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={handlePause}>
                {isPaused ? <Play size={16} /> : <Pause size={16} />}
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button className="btn btn-danger" onClick={handleStop}>
                <Square size={16} /> Stop Replay
              </button>
            </>
          )}
        </div>

        <div className="h-8 w-px bg-slate-200 hidden md:block" />

        {/* Dataset File Selector */}
        <div className="flex items-center gap-2.5">
          <Database size={16} className="text-slate-500" />
          <span className="text-xs font-bold text-slate-700">Dataset Source:</span>
          <select
            value={selectedFile}
            onChange={(e) => setSelectedFile(e.target.value)}
            disabled={isStreaming}
            className="input select text-xs py-1.5 px-3 max-w-[240px] bg-slate-50 focus:bg-white"
          >
            {datasetFiles.length > 0 ? (
              datasetFiles.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.display_name}
                </option>
              ))
            ) : (
              <option value="CIC-IDS2017">CIC-IDS2017 Benchmark</option>
            )}
          </select>
        </div>

        <div className="h-8 w-px bg-slate-200 hidden md:block" />

        {/* Replay Speed Toggle */}
        <div className="flex items-center gap-2.5">
          <Gauge size={16} className="text-slate-500" />
          <span className="text-xs font-bold text-slate-700">Replay Speed:</span>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={clsx(
                  'px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer select-none',
                  speed === s
                    ? 'bg-[#F5B700] text-slate-950 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Honest Limitation & Scientific Integrity Panel */}
      <Card p-4 className="bg-amber-50/70 border-amber-200 space-y-3">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <span className="font-bold text-amber-900 block text-sm">
              Dataset Replay Stream Telemetry & ML Inference Policy
            </span>
            <p className="text-amber-800 leading-relaxed">
              Active replay streams authentic CIC-IDS2017 statistical flow records (<code className="font-mono bg-amber-100 px-1 py-0.5 rounded">D:\shap_sample_features.csv</code>) with full 69-feature vectors, evaluated directly by the loaded XGBoost model. Replay streams statistical flow records rather than raw PCAP packet payloads or original hardware capture timestamps.
            </p>
          </div>
        </div>

        {/* Interactive Verified Flow Injection Section */}
        <div className="pt-2 border-t border-amber-200/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
            <ShieldCheck size={16} className="text-amber-700" />
            <span>Test Partial Synthetic Flow Probes Against XGBoost API:</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleInjectSampleFlow('dos')}
              disabled={isTestingFlow}
              className="btn btn-secondary btn-sm text-xs bg-white hover:bg-amber-100 flex items-center gap-1.5"
            >
              <Zap size={13} className="text-red-600" /> Probe: DoS
            </button>
            <button
              onClick={() => handleInjectSampleFlow('portscan')}
              disabled={isTestingFlow}
              className="btn btn-secondary btn-sm text-xs bg-white hover:bg-amber-100 flex items-center gap-1.5"
            >
              <Zap size={13} className="text-amber-600" /> Probe: PortScan (Partial)
            </button>
            <button
              onClick={() => handleInjectSampleFlow('benign')}
              disabled={isTestingFlow}
              className="btn btn-secondary btn-sm text-xs bg-white hover:bg-amber-100 flex items-center gap-1.5"
            >
              <ShieldCheck size={13} className="text-emerald-600" /> Probe: Normal
            </button>
          </div>
        </div>

        {testSuccessNotice && (
          <div className="p-2.5 bg-white/90 border border-amber-300 rounded-lg text-xs font-mono text-emerald-800 flex items-center justify-between">
            <span>{testSuccessNotice}</span>
            <button onClick={() => setTestSuccessNotice(null)} className="text-slate-400 hover:text-slate-600 ml-2">×</button>
          </div>
        )}
      </Card>

      {/* Stream Metrics Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <Card padding="compact" className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
              Events / Second (30s Rolling)
            </span>
            <p className="text-2xl lg:text-3xl font-extrabold text-slate-900 mt-1">
              {liveRate.isAvailable && liveRate.eventsPerSec !== null ? (
                <>
                  {liveRate.eventsPerSec} <span className="text-xs font-normal text-slate-400">ev/s</span>
                </>
              ) : (
                <span className="text-xl font-bold text-slate-400" title="Rolling window establishing (requires ≥ 1s span)">—</span>
              )}
            </p>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {liveRate.isAvailable ? `Span: ${liveRate.windowSpanSec}s (${liveRate.uniqueEventsCount} unique events)` : 'Awaiting stream window'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 flex-shrink-0">
            <Activity size={18} strokeWidth={2.2} />
          </div>
        </Card>

        <Card padding="compact" className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
              Threats / Minute (30s Rolling)
            </span>
            <p className="text-2xl lg:text-3xl font-extrabold text-red-600 mt-1">
              {liveRate.isAvailable && liveRate.threatsPerMin !== null ? (
                <>
                  {liveRate.threatsPerMin} <span className="text-xs font-normal text-slate-400">threats/m</span>
                </>
              ) : (
                <span className="text-xl font-bold text-slate-400" title="Rolling window establishing (requires ≥ 1s span)">—</span>
              )}
            </p>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {liveRate.isAvailable ? `${liveRate.uniqueThreatsCount} threat detections in window` : 'Awaiting stream window'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 flex-shrink-0">
            <AlertTriangle size={18} strokeWidth={2.2} />
          </div>
        </Card>

        <Card padding="compact" className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Events Processed</span>
            <p className="text-2xl lg:text-3xl font-extrabold text-slate-900 mt-1">{totalEvents.toLocaleString()}</p>
            <span className="text-[10px] text-slate-400 block mt-0.5">Cumulative Replay Events</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 flex-shrink-0">
            <Radio size={18} strokeWidth={2.2} />
          </div>
        </Card>

        <Card padding="compact" className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Alerts Generated</span>
            <p className="text-2xl lg:text-3xl font-extrabold text-amber-600 mt-1">{totalThreats.toLocaleString()}</p>
            <span className="text-[10px] text-slate-400 block mt-0.5">Cumulative Replay Alerts</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 flex-shrink-0">
            <Activity size={18} strokeWidth={2.2} />
          </div>
        </Card>
      </div>

      {/* Real-time Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
        <Card p-6 className="min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="card-title">Throughput: Events / sec</h3>
              <p className="text-[11px] text-slate-400">30-second rolling window rate</p>
            </div>
            {liveRate.isAvailable && liveRate.eventsPerSec !== null ? (
              <span className="text-[11px] font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                Live: {liveRate.eventsPerSec} ev/s
              </span>
            ) : metrics.length > 0 ? (
              <span className="text-[11px] font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                Live: {metrics[metrics.length - 1].events} ev/s
              </span>
            ) : (
              <span className="text-[11px] font-mono text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                Window Establishing
              </span>
            )}
          </div>
          {metrics.length > 0 ? (
            <div className="h-[150px] w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#94A3B8" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#94A3B8" />
                  <Line type="monotone" dataKey="events" stroke="#F5B700" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[150px] w-full flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50 text-center p-4">
              <Activity className="w-6 h-6 text-slate-300 mb-1" />
              <span className="text-xs font-semibold text-slate-600">No Throughput Telemetry Available</span>
              <span className="text-[11px] text-slate-400 mt-0.5">Start a dataset replay or inject a test flow to monitor live throughput</span>
            </div>
          )}
        </Card>

        <Card p-6 className="min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="card-title">Threat Detections: Threats / min</h3>
              <p className="text-[11px] text-slate-400">30-second rolling window threat rate</p>
            </div>
            {liveRate.isAvailable && liveRate.threatsPerMin !== null ? (
              <span className="text-[11px] font-mono font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                Live: {liveRate.threatsPerMin} threats/m
              </span>
            ) : metrics.length > 0 ? (
              <span className="text-[11px] font-mono font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                Live: {metrics[metrics.length - 1].threats} threats/m
              </span>
            ) : (
              <span className="text-[11px] font-mono text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                Window Establishing
              </span>
            )}
          </div>
          {metrics.length > 0 ? (
            <div className="h-[150px] w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#94A3B8" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#94A3B8" />
                  <Line type="monotone" dataKey="threats" stroke="#EF4444" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[150px] w-full flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50 text-center p-4">
              <AlertTriangle className="w-6 h-6 text-slate-300 mb-1" />
              <span className="text-xs font-semibold text-slate-600">No Threat Detection Rate Available</span>
              <span className="text-[11px] text-slate-400 mt-0.5">Start a dataset replay or inject a test flow to monitor threat frequency</span>
            </div>
          )}
        </Card>
      </div>

      {/* Live Event Stream Table */}
      <Card p-6>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="card-title">Real-Time Event Stream Log</h3>
            <p className="text-xs text-slate-500 mt-0.5">Live network flow classification updates</p>
          </div>
          {isStreaming && !isPaused && (
            <span className="text-xs font-extrabold text-emerald-700 flex items-center gap-1.5 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              <Radio size={14} className="pulse-dot text-emerald-600" /> STREAMING LIVE
            </span>
          )}
        </div>

        {events.length === 0 ? (
          <EmptyState
            icon={Radio}
            title="Replay Stream Inactive"
            description={isStreaming ? 'Waiting for telemetry batches...' : 'Start a dataset replay or inject a verified flow to begin event streaming.'}
            action={!isStreaming ? { label: 'Start Replay', onClick: handleStart, icon: Play } : undefined}
            variant="amber"
            minHeight="min-h-[240px]"
          />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Source IP</th>
                <th>Destination IP</th>
                <th>Port</th>
                <th>Protocol</th>
                <th>Duration</th>
                <th>Packets / Bytes</th>
                <th>Prediction</th>
                <th>Risk Score</th>
                <th>Inference Status</th>
              </tr>
            </thead>
            <tbody>
              {events.map((evt) => (
                <tr
                  key={evt.id}
                  className={clsx(
                    'animate-slide-in',
                    evt.prediction !== 'BENIGN' && 'row-suspicious'
                  )}
                >
                  <td className="text-xs text-slate-500 whitespace-nowrap font-mono">
                    {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    <span className="text-[10px] text-slate-400">.{String(new Date(evt.timestamp).getMilliseconds()).padStart(3, '0')}</span>
                  </td>
                  <td className="text-xs font-mono font-bold text-slate-900">{evt.source_ip}</td>
                  <td className="text-xs font-mono">{evt.destination_ip}</td>
                  <td className="text-xs font-mono text-slate-700">
                    {evt.source_port} → {evt.destination_port}
                  </td>
                  <td className="text-xs font-bold">{evt.protocol}</td>
                  <td className="text-xs font-mono">{(evt.flow_duration / 1000).toFixed(1)}s</td>
                  <td className="text-xs text-slate-600">
                    {evt.total_fwd_packets + evt.total_bwd_packets} pkts ({((evt.total_length_fwd_packets + evt.total_length_bwd_packets) / 1024).toFixed(1)} KB)
                  </td>
                  <td>
                    <Badge variant={evt.prediction === 'BENIGN' ? 'low' : 'critical'}>
                      {evt.prediction === 'BENIGN' ? 'Normal' : evt.attack_type}
                    </Badge>
                  </td>
                  <td>
                    <span className={clsx(
                      'text-xs font-extrabold px-2 py-0.5 rounded font-mono',
                      evt.risk_score >= 75 ? 'bg-red-50 text-red-700' :
                      evt.risk_score >= 50 ? 'bg-amber-50 text-amber-700' :
                      evt.risk_score >= 25 ? 'bg-yellow-50 text-amber-800' :
                      'text-slate-600'
                    )}>
                      {evt.risk_score}%
                    </span>
                  </td>
                  <td>
                    {evt.inference_source === 'xgboost_live' ? (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" /> XGBoost Live
                      </span>
                    ) : (
                      <span className="text-[10.5px] text-slate-400 italic" title="Raw replay stream lacks 69 statistical flow features">
                        Bypassed (Header Only)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>
    </PageContainer>
  );
}
