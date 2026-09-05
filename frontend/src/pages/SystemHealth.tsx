import { Activity, Cpu, HardDrive, Clock, Layers, Server, Database, Brain, Radio, FileCheck } from 'lucide-react';
import clsx from 'clsx';
import { PageContainer, PageHeader } from '../components/common/PageContainer';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';

const services = [
  { name: 'Backend API Service', status: 'Healthy', latency: '4ms', icon: Server, desc: 'FastAPI core REST API & WebSocket endpoints active' },
  { name: 'Database Engine', status: 'Healthy', latency: '2ms', icon: Database, desc: 'SQLite persistent datastore operational' },
  { name: 'ML Inference Service', status: 'Not Connected', latency: '—', icon: Brain, desc: 'Awaiting ML model pipeline initialization' },
  { name: 'Streaming Emitter', status: 'Healthy', latency: '1ms', icon: Radio, desc: 'Dataset replay stream generator ready' },
  { name: 'Dataset Pipeline Service', status: 'Healthy', latency: '3ms', icon: FileCheck, desc: 'CIC-IDS2017 dataset loader operational' },
];

export default function SystemHealthPage() {
  return (
    <PageContainer>
      {/* Page Header */}
      <PageHeader
        title="System & Infrastructure Health"
        subtitle="Real-time status monitoring for backend APIs, database engine, ML service, and streaming pipeline"
        statusBadge={
          <Badge variant="low" className="px-3 py-1 text-xs font-bold uppercase tracking-wider">
            All Core Systems Operational
          </Badge>
        }
      />

      {/* Service Status Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
        {services.map((svc) => (
          <Card key={svc.name} hover p-5 className="flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                  <svc.icon size={18} className="text-slate-600" />
                </div>
                <span className={clsx(
                  'status-dot',
                  svc.status === 'Healthy' ? 'status-healthy pulse-dot' :
                  svc.status === 'Warning' ? 'status-warning' : 'status-unknown'
                )} />
              </div>
              <h3 className="card-title text-sm">{svc.name}</h3>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Status</span>
                <span className={clsx(
                  'font-extrabold',
                  svc.status === 'Healthy' ? 'text-emerald-700' :
                  svc.status === 'Warning' ? 'text-amber-700' : 'text-slate-500'
                )}>
                  {svc.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Latency</span>
                <span className="font-mono font-bold text-slate-900">{svc.latency}</span>
              </div>
              <p className="text-[10.5px] font-medium text-slate-400 mt-2 leading-tight">
                {svc.desc}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* System Resource Utilization Card */}
      <Card p-6>
        <div className="mb-6">
          <h3 className="card-title">Infrastructure Compute Metrics</h3>
          <p className="text-xs text-slate-500 mt-0.5">Resource consumption across platform services</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5 text-center">
          {[
            { label: 'CPU Load', value: '4.2%', icon: Cpu, color: '#F5B700' },
            { label: 'Memory Allocation', value: '184 MB', icon: HardDrive, color: '#3B82F6' },
            { label: 'Ingestion Rate', value: '1,240 ev/s', icon: Activity, color: '#10B981' },
            { label: 'Inference Latency', value: '3.8 ms', icon: Clock, color: '#F59E0B' },
            { label: 'Stream Backlog', value: '0 events', icon: Layers, color: '#64748B' },
          ].map((m) => (
            <div key={m.label} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <m.icon size={22} className="mx-auto mb-2" style={{ color: m.color }} />
              <p className="text-xl font-extrabold text-slate-900">{m.value}</p>
              <span className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wider block mt-1">{m.label}</span>
            </div>
          ))}
        </div>
      </Card>
    </PageContainer>
  );
}
