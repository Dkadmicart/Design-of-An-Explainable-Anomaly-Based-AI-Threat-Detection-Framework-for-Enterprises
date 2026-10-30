import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import {
  AlertTriangle, Activity, Zap, Eye, Clock, ShieldCheck, Play, ArrowRight
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../services/api';
import type { DashboardSummary, Alert, AttackDistribution, ModelStatusInfo, TopSource, RiskDistribution } from '../types';
import { useTheme } from '../context/ThemeContext';
import { PageContainer, PageHeader } from '../components/common/PageContainer';
import { Card } from '../components/common/Card';
import { EmptyState } from '../components/common/EmptyState';
import { DataTable } from '../components/common/DataTable';
import { Badge, SeverityBadge } from '../components/common/Badge';

// ─── Primary Security Summary KPI Card Component ─────────────────────────────

interface KPICardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  description: string;
  highlight?: 'critical' | 'warning' | 'normal';
}

function KPICard({ label, value, icon: Icon, description, highlight }: KPICardProps) {
  const isStringValue = typeof value === 'string' && isNaN(Number(value));

  return (
    <Card
      hover
      p-5
      className={clsx(
        'h-full flex flex-col justify-between',
        highlight === 'critical' && 'border-l-4 border-l-red-500 bg-gradient-to-br from-[var(--color-bg-card)] to-red-500/10',
        highlight === 'warning' && 'border-l-4 border-l-amber-500 bg-gradient-to-br from-[var(--color-bg-card)] to-amber-500/10'
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-[11px] font-extrabold text-[var(--color-text-muted)] uppercase tracking-wider">
            {label}
          </span>
          <div className={clsx(
            'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
            highlight === 'critical' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
            highlight === 'warning' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
            'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] border border-[var(--color-border-base)]'
          )}>
            <Icon size={18} strokeWidth={2.2} />
          </div>
        </div>

        <div className="flex items-baseline justify-start gap-2 mt-1 min-h-[44px]">
          {isStringValue ? (
            <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold text-[var(--color-text-muted)] bg-[var(--color-bg-subtle)] border border-[var(--color-border-base)]">
              {value}
            </span>
          ) : (
            <span className={clsx(
              'kpi-value text-3xl lg:text-4xl font-extrabold tracking-tight',
              highlight === 'critical' ? 'text-red-500' : 'text-[var(--color-text-main)]'
            )}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-[var(--color-text-muted)] font-medium mt-4 pt-3 border-t border-[var(--color-border-subtle)]">
        {description}
      </p>
    </Card>
  );
}

// ─── Color Palettes ─────────────────────────────────────────────────────────

const ATTACK_COLORS: Record<string, string> = {
  BENIGN: '#CBD5E1',
  DDoS: '#EF4444',
  DoS: '#F59E0B',
  PortScan: '#3B82F6',
  Botnet: '#8B5CF6',
  'Brute Force': '#EC4899',
  'Web Attack': '#F97316',
  Infiltration: '#06B6D4',
};

const RISK_COLORS: Record<string, string> = {
  LOW: '#16A34A',
  MEDIUM: '#F5B700',
  HIGH: '#F59E0B',
  CRITICAL: '#DC2626',
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { isLight } = useTheme();
  const [summary, setSummary] = useState<DashboardSummary>({
    total_events: 0,
    normal_events: 0,
    suspicious_events: 0,
    critical_alerts: 0,
    detection_rate: 0,
    false_positive_rate: 0,
    total_events_trend: 0,
    normal_events_trend: 0,
    suspicious_events_trend: 0,
    critical_alerts_trend: 0,
    detection_rate_trend: 0,
    false_positive_rate_trend: 0,
  });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [attacks, setAttacks] = useState<AttackDistribution[]>([]);

  useEffect(() => {
    api.getDashboardSummary().then(setSummary).catch(console.error);
    api.getAlerts({ page_size: 6 }).then(res => setAlerts(res.alerts)).catch(console.error);
    api.getAttackDistribution().then(res => setAttacks(res.distribution.filter(a => a.type !== 'BENIGN'))).catch(console.error);
  }, []);

  // Real-time live clock state ticking every second (zero layout shift with tabular-nums)
  const [liveClock, setLiveClock] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setLiveClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dashHH = String(liveClock.getHours()).padStart(2, '0');
  const dashMM = String(liveClock.getMinutes()).padStart(2, '0');
  const dashSS = String(liveClock.getSeconds()).padStart(2, '0');
  const dashFormattedTime = `${dashHH}:${dashMM}:${dashSS}`;
  const dashFormattedDate = liveClock.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const timeline: { time: string; normal: number; suspicious: number; critical: number }[] = [];
  const sources: TopSource[] = [];
  const modelStatus: ModelStatusInfo = {
    current_model: 'Random Forest Baseline',
    version: 'v1.0.0',
    last_trained: 'Not Evaluated',
    detection_mode: 'Binary Classification',
    health: 'healthy',
  };

  const risks: RiskDistribution[] = [
    { category: 'LOW', count: alerts.filter(a => a.severity === 'LOW').length },
    { category: 'MEDIUM', count: alerts.filter(a => a.severity === 'MEDIUM').length },
    { category: 'HIGH', count: alerts.filter(a => a.severity === 'HIGH').length },
    { category: 'CRITICAL', count: alerts.filter(a => a.severity === 'CRITICAL').length },
  ];

  return (
    <PageContainer>
      {/* Page Header */}
      <PageHeader
        title="Security Operations Overview"
        subtitle="Monitor network activity, identify threats, and investigate benchmark security incidents."
        statusBadge={
          <Badge variant="neutral" className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
            Data Source: Historical CIC-IDS2017 Benchmark
          </Badge>
        }
        actions={
          <div className="flex items-center gap-2.5 text-xs font-bold text-[var(--color-text-body)] bg-[var(--color-bg-card)] px-3.5 py-2 rounded-xl border border-[var(--color-border-base)] shadow-2xs select-none">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            <Clock size={14} className="text-[var(--color-text-muted)] flex-shrink-0" />
            <span className="font-mono tabular-nums font-extrabold text-[var(--color-text-main)] min-w-[62px] text-center">
              {dashFormattedTime}
            </span>
            <span className="text-[var(--color-border-strong)] opacity-60">|</span>
            <span className="text-[var(--color-text-muted)] font-semibold text-[11px] whitespace-nowrap">
              {dashFormattedDate}
            </span>
          </div>
        }
      />

      {/* Primary Security Summary (4 Key KPI Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
        <KPICard
          label="Critical Alerts"
          value={summary.critical_alerts}
          icon={Zap}
          description="Incidents requiring immediate triage"
          highlight="critical"
        />
        <KPICard
          label="High Risk Events"
          value={summary.suspicious_events}
          icon={AlertTriangle}
          description="High severity flow anomalies"
          highlight="warning"
        />
        <KPICard
          label="Total Events"
          value={summary.total_events}
          icon={Activity}
          description="Network flows analyzed"
        />
        <KPICard
          label="Detection Rate"
          value={summary.detection_rate > 0 ? `${summary.detection_rate}%` : 'Not Evaluated'}
          icon={Eye}
          description="Awaiting pipeline evaluation"
        />
      </div>

      {/* Threat Activity Timeline & Attack Distribution Donut */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8 items-stretch">
        {/* Threat Activity Timeline */}
        <Card p-6 className="xl:col-span-2 h-full flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="card-title">Threat Activity Timeline</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">24-hour event volume (Normal vs Suspicious vs Critical)</p>
            </div>
          </div>
          
          {timeline.length > 0 ? (
            <div className="h-[240px] w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isLight ? '#F1F5F9' : 'rgba(255, 255, 255, 0.06)'} />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke={isLight ? '#94A3B8' : '#64748B'} />
                  <YAxis tick={{ fontSize: 11 }} stroke={isLight ? '#94A3B8' : '#64748B'} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isLight ? '#FFFFFF' : '#0F172A',
                      border: isLight ? '1px solid #E2E8F0' : '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '12px',
                      color: isLight ? '#0F172A' : '#F8FAFC',
                      fontSize: '13px',
                      boxShadow: isLight ? '0 4px 12px rgba(0,0,0,0.08)' : '0 8px 24px rgba(0,0,0,0.4)',
                    }}
                  />
                  <Area type="monotone" dataKey="normal" stackId="1" stroke="#94A3B8" fill={isLight ? '#F1F5F9' : '#1E293B'} name="Normal Traffic" />
                  <Area type="monotone" dataKey="suspicious" stackId="1" stroke="#F5B700" fill={isLight ? '#FEF3C7' : 'rgba(245, 183, 0, 0.2)'} name="Suspicious Activity" />
                  <Area type="monotone" dataKey="critical" stackId="1" stroke="#EF4444" fill={isLight ? '#FEE2E2' : 'rgba(239, 68, 68, 0.2)'} name="Critical Events" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              icon={Activity}
              title="No Telemetry Available"
              description="No network telemetry is currently being processed in the pipeline."
              action={{ label: 'Start Dataset Replay', onClick: () => navigate('/live-monitor'), icon: Play }}
              variant="amber"
              minHeight="min-h-[240px]"
            />
          )}
        </Card>

        {/* Attack Vector Distribution Donut */}
        <Card p-6 className="h-full flex flex-col justify-between min-w-0">
          <div>
            <h3 className="card-title">Attack Vector Distribution</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Categorized attack classifications</p>
          </div>

          {attacks.length > 0 ? (
            <>
              <div className="h-[180px] w-full my-2 min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={attacks}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="count"
                      nameKey="type"
                    >
                      {attacks.map((entry) => (
                        <Cell key={entry.type} fill={ATTACK_COLORS[entry.type] || '#94A3B8'} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => (value ?? 0).toLocaleString()}
                      contentStyle={{
                        backgroundColor: isLight ? '#FFFFFF' : '#0F172A',
                        border: isLight ? '1px solid #E2E8F0' : '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '10px',
                        color: isLight ? '#0F172A' : '#F8FAFC',
                        fontSize: '13px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-[var(--color-border-subtle)]">
                {attacks.map((a) => (
                  <div key={a.type} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: ATTACK_COLORS[a.type] }} />
                      <span className="text-[var(--color-text-muted)] truncate font-medium">{a.type}</span>
                    </div>
                    <span className="font-bold text-[var(--color-text-main)] ml-1">{a.percentage}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              icon={ShieldCheck}
              title="No Threats Detected"
              description="Threat classification will appear when telemetry is processed."
              action={{ label: 'Open Live Monitor', onClick: () => navigate('/live-monitor'), variant: 'secondary' }}
              variant="emerald"
              minHeight="min-h-[240px]"
            />
          )}
        </Card>
      </div>

      {/* Threat Risk Summary & Recent Security Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Threat Risk Summary Horizontal Bars */}
        <Card p-6 className="lg:col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="card-title mb-1">Threat Risk Summary</h3>
            <p className="text-xs text-[var(--color-text-muted)] mb-5">Event severity scores breakdown</p>
            <div className="space-y-4">
              {risks.map((r) => {
                const total = risks.reduce((s, x) => s + x.count, 0);
                const pct = total > 0 ? ((r.count / total) * 100).toFixed(0) : '0';
                return (
                  <div key={r.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-[var(--color-text-muted)]">{r.category}</span>
                      <span className="text-[var(--color-text-main)] font-bold">{r.count.toLocaleString()} <span className="text-[var(--color-text-muted)] font-normal">({pct}%)</span></span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: RISK_COLORS[r.category],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-[var(--color-border-subtle)] text-xs text-[var(--color-text-muted)] font-medium">
            Calculated dynamically based on anomaly confidence and severity rules.
          </div>
        </Card>

        {/* Recent Security Alerts Table */}
        <Card p-6 className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="card-title">Recent Security Alerts</h3>
              <p className="text-xs text-[var(--color-text-muted)]">Click any alert row to open investigation workspace</p>
            </div>
            <button
              onClick={() => navigate('/alerts')}
              className="text-xs font-bold text-amber-500 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View All Alerts</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {alerts.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No Security Alerts"
              description="No security alerts have been generated yet."
              action={{ label: 'Go to Live Monitor', onClick: () => navigate('/live-monitor'), variant: 'secondary' }}
              variant="emerald"
              minHeight="min-h-[220px]"
            />
          ) : (
            <DataTable>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Severity</th>
                  <th>Detection</th>
                  <th>Source IP</th>
                  <th>Destination IP</th>
                  <th>Risk Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {alerts.slice(0, 6).map((alert) => (
                  <tr
                    key={alert.id}
                    className={clsx(
                      'cursor-pointer group hover:bg-[var(--color-table-hover)]',
                      alert.severity === 'CRITICAL' && 'row-critical',
                      alert.severity === 'HIGH' && 'row-high'
                    )}
                    onClick={() => navigate(`/alerts/${alert.id}`)}
                  >
                    <td className="text-xs font-mono text-[var(--color-text-muted)] whitespace-nowrap">
                      {new Date(alert.created_at).toLocaleTimeString()}
                    </td>
                    <td><SeverityBadge severity={alert.severity} /></td>
                    <td className="text-xs font-bold text-[var(--color-text-main)]">{alert.attack_type}</td>
                    <td className="text-xs font-mono font-bold text-[var(--color-text-main)]">{alert.source_ip}</td>
                    <td className="text-xs font-mono text-[var(--color-text-muted)]">{alert.destination_ip}</td>
                    <td>
                      <span className={clsx(
                        'text-xs font-extrabold px-2 py-0.5 rounded',
                        alert.risk_score >= 75 ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                        alert.risk_score >= 50 ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                        'text-[var(--color-text-muted)]'
                      )}>
                        {alert.risk_score}
                      </span>
                    </td>
                    <td>
                      <Badge
                        variant={
                          alert.status === 'NEW' ? 'info' :
                          alert.status === 'RESOLVED' ? 'low' :
                          alert.status === 'ESCALATED' ? 'critical' : 'medium'
                        }
                      >
                        {alert.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Card>
      </div>

      {/* Top Suspicious Sources & Active Model Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Suspicious Sources */}
        <Card p-6>
          <div className="mb-4">
            <h3 className="card-title">Top Suspicious Sources</h3>
            <p className="text-xs text-[var(--color-text-muted)]">Highest risk originating network addresses</p>
          </div>
          {sources.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="Awaiting Network Telemetry"
              description="Awaiting network flow telemetry to identify suspicious origin addresses."
              variant="normal"
              minHeight="min-h-[180px]"
            />
          ) : (
            <DataTable>
              <thead>
                <tr>
                  <th>Source IP</th>
                  <th>Total Events</th>
                  <th>Risk Score</th>
                  <th>Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.ip}>
                    <td className="text-xs font-mono font-bold text-[var(--color-text-main)]">{s.ip}</td>
                    <td className="text-xs font-semibold text-[var(--color-text-muted)]">{s.events} events</td>
                    <td>
                      <span className={clsx(
                        'text-xs font-extrabold px-2 py-0.5 rounded',
                        s.risk_score >= 75 ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                        s.risk_score >= 50 ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                        'text-[var(--color-text-muted)]'
                      )}>
                        {s.risk_score}
                      </span>
                    </td>
                    <td className="text-xs text-[var(--color-text-muted)]">
                      {new Date(s.last_seen).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Card>

        {/* Model Status Card */}
        <Card p-6 className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="card-title">Active ML Model Status</h3>
                <p className="text-xs text-[var(--color-text-muted)]">Detection engine operational status</p>
              </div>
              <Badge variant="low" className="flex items-center gap-1 px-3 py-1 text-xs">
                <span className="status-dot status-healthy pulse-dot" /> Operational
              </Badge>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-[var(--color-border-subtle)]">
                <span className="text-xs font-semibold text-[var(--color-text-muted)]">Model Architecture</span>
                <span className="font-bold text-[var(--color-text-main)]">{modelStatus.current_model}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[var(--color-border-subtle)]">
                <span className="text-xs font-semibold text-[var(--color-text-muted)]">Version</span>
                <span className="font-mono font-bold text-[var(--color-text-main)]">{modelStatus.version}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[var(--color-border-subtle)]">
                <span className="text-xs font-semibold text-[var(--color-text-muted)]">Evaluation Status</span>
                <span className="text-xs font-medium text-[var(--color-text-muted)] italic">Not Evaluated</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[var(--color-border-subtle)]">
                <span className="text-xs font-semibold text-[var(--color-text-muted)]">Detection Mode</span>
                <span className="font-semibold text-[var(--color-text-main)]">{modelStatus.detection_mode}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs font-semibold text-[var(--color-text-muted)]">Inference Service</span>
                <div className="flex items-center gap-2">
                  <span className="status-dot status-healthy" />
                  <span className="font-bold text-xs text-emerald-500 capitalize">{modelStatus.health}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <span>Baseline Supervised Classifier</span>
            <button onClick={() => navigate('/models')} className="font-bold text-amber-500 hover:underline cursor-pointer">
              Models & Metrics →
            </button>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
