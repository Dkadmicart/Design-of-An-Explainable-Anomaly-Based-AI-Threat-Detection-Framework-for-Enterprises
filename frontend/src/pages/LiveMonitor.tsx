import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Play, Pause, Square, Gauge, Database, Radio, Activity, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../services/api';
import type { NetworkEvent, DatasetFile } from '../types';
import { PageContainer, PageHeader } from '../components/common/PageContainer';
import { Card } from '../components/common/Card';
import { EmptyState } from '../components/common/EmptyState';
import { DataTable } from '../components/common/DataTable';
import { Badge } from '../components/common/Badge';

const SPEED_OPTIONS = [1, 2, 5, 10];

interface StreamMetric {
  time: string;
  events: number;
  threats: number;
}

export default function LiveMonitorPage() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [datasetFiles, setDatasetFiles] = useState<DatasetFile[]>([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [events, setEvents] = useState<NetworkEvent[]>([]);
  const [metrics, setMetrics] = useState<StreamMetric[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [totalThreats, setTotalThreats] = useState(0);

  useEffect(() => {
    api.getDatasets().then(res => {
      if (res.datasets.length > 0 && res.datasets[0].files.length > 0) {
        setDatasetFiles(res.datasets[0].files);
        setSelectedFile(res.datasets[0].files[0].name);
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    let timer: number | null = null;
    if (isStreaming && !isPaused) {
      timer = window.setInterval(() => {
        api.getEvents({ page_size: 5 }).then(res => {
          if (res.events.length > 0) {
            setEvents(prev => [...res.events, ...prev].slice(0, 100));
            setTotalEvents(p => p + res.events.length);
            const threats = res.events.filter(e => e.prediction && e.prediction !== 'BENIGN').length;
            setTotalThreats(p => p + threats);
          }
        }).catch(console.error);
      }, Math.max(200, 2000 / speed));
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isStreaming, isPaused, speed]);

  // Metrics update every 2 seconds
  useEffect(() => {
    if (!isStreaming || isPaused) return;
    const id = setInterval(() => {
      setMetrics((prev) => {
        const now = new Date().toLocaleTimeString();
        const evts = Math.floor(speed * (4 + Math.random() * 6));
        const threats = Math.floor(evts * (0.04 + Math.random() * 0.12));
        return [...prev, { time: now, events: evts, threats }].slice(-30);
      });
    }, 2000);
    return () => clearInterval(id);
  }, [isStreaming, isPaused, speed]);

  const handleStart = () => {
    setIsStreaming(true);
    setIsPaused(false);
    setEvents([]);
    setMetrics([]);
    setTotalEvents(0);
    setTotalThreats(0);
  };

  const handlePause = () => setIsPaused(!isPaused);
  const handleStop = () => {
    setIsStreaming(false);
    setIsPaused(false);
  };

  return (
    <PageContainer>
      {/* Page Header */}
      <PageHeader
        title="Live Threat Monitor"
        subtitle="Simulated detection stream — Replay historical network telemetry"
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

      {/* Stream Metrics Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <Card padding="compact" className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Events / Second</span>
            <p className="text-2xl lg:text-3xl font-extrabold text-slate-900 mt-1">
              {metrics.length > 0 ? metrics[metrics.length - 1].events : 0} <span className="text-xs font-normal text-slate-400">ev/s</span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 flex-shrink-0">
            <Activity size={18} strokeWidth={2.2} />
          </div>
        </Card>

        <Card padding="compact" className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Threats / Minute</span>
            <p className="text-2xl lg:text-3xl font-extrabold text-red-600 mt-1">
              {metrics.length > 0 ? metrics[metrics.length - 1].threats : 0} <span className="text-xs font-normal text-slate-400">threats/m</span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 flex-shrink-0">
            <AlertTriangle size={18} strokeWidth={2.2} />
          </div>
        </Card>

        <Card padding="compact" className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Events Processed</span>
            <p className="text-2xl lg:text-3xl font-extrabold text-slate-900 mt-1">{totalEvents.toLocaleString()}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 flex-shrink-0">
            <Radio size={18} strokeWidth={2.2} />
          </div>
        </Card>

        <Card padding="compact" className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Alerts Generated</span>
            <p className="text-2xl lg:text-3xl font-extrabold text-amber-600 mt-1">{totalThreats.toLocaleString()}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 flex-shrink-0">
            <Activity size={18} strokeWidth={2.2} />
          </div>
        </Card>
      </div>

      {/* Real-time Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card p-6>
          <div className="flex items-center justify-between mb-4">
            <h3 className="card-title">Throughput: Events / sec</h3>
          </div>
          <div className="h-[150px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#94A3B8" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94A3B8" />
                <Line type="monotone" dataKey="events" stroke="#F5B700" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card p-6>
          <div className="flex items-center justify-between mb-4">
            <h3 className="card-title">Threat Detections: Threats / min</h3>
          </div>
          <div className="h-[150px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#94A3B8" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94A3B8" />
                <Line type="monotone" dataKey="threats" stroke="#EF4444" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
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
            description={isStreaming ? 'Waiting for telemetry batches...' : 'Start a dataset replay to begin event streaming.'}
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
                <th>Source Port</th>
                <th>Destination Port</th>
                <th>Protocol</th>
                <th>Duration</th>
                <th>Packets</th>
                <th>Bytes</th>
                <th>Model Prediction</th>
                <th>Risk Score</th>
                <th>Severity Status</th>
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
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="text-xs font-mono font-bold text-slate-900">{evt.source_ip}</td>
                  <td className="text-xs font-mono">{evt.destination_ip}</td>
                  <td className="text-xs font-mono">{evt.source_port}</td>
                  <td className="text-xs font-mono">{evt.destination_port}</td>
                  <td className="text-xs font-bold">{evt.protocol}</td>
                  <td className="text-xs">{(evt.flow_duration / 1000).toFixed(1)}s</td>
                  <td className="text-xs">{evt.total_fwd_packets + evt.total_bwd_packets} pkts</td>
                  <td className="text-xs">{((evt.total_length_fwd_packets + evt.total_length_bwd_packets) / 1024).toFixed(1)} KB</td>
                  <td>
                    <Badge variant={evt.prediction === 'BENIGN' ? 'low' : 'critical'}>
                      {evt.prediction === 'BENIGN' ? 'Normal' : evt.attack_type}
                    </Badge>
                  </td>
                  <td>
                    <span className={clsx(
                      'text-xs font-extrabold px-2 py-0.5 rounded',
                      evt.risk_score >= 75 ? 'bg-red-50 text-red-700' :
                      evt.risk_score >= 50 ? 'bg-amber-50 text-amber-700' :
                      evt.risk_score >= 25 ? 'bg-yellow-50 text-amber-800' :
                      'text-slate-600'
                    )}>
                      {evt.risk_score}%
                    </span>
                  </td>
                  <td>
                    <Badge
                      variant={
                        evt.risk_score >= 75 ? 'critical' :
                        evt.risk_score >= 50 ? 'high' :
                        evt.risk_score >= 25 ? 'medium' : 'low'
                      }
                    >
                      {evt.risk_score >= 75 ? 'CRITICAL' :
                       evt.risk_score >= 50 ? 'HIGH' :
                       evt.risk_score >= 25 ? 'MEDIUM' : 'LOW'}
                    </Badge>
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
