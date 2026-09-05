import { useState, useEffect } from 'react';
import { Search, ShieldAlert } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../services/api';
import type { InvestigationResult } from '../types';
import { PageContainer, PageHeader } from '../components/common/PageContainer';
import { Card } from '../components/common/Card';
import { EmptyState } from '../components/common/EmptyState';
import { DataTable } from '../components/common/DataTable';
import { Badge } from '../components/common/Badge';

export default function InvestigatePage() {
  const [targetEntity, setTargetEntity] = useState('192.168.1.105');
  const [inputQuery, setInputQuery] = useState('192.168.1.105');
  const [investigationData, setInvestigationData] = useState<InvestigationResult | null>(null);

  useEffect(() => {
    if (targetEntity) {
      api.investigateIP(targetEntity)
        .then(setInvestigationData)
        .catch(console.error);
    }
  }, [targetEntity]);

  const relatedEvents = investigationData?.events || [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputQuery.trim()) {
      setTargetEntity(inputQuery.trim());
    }
  };

  return (
    <PageContainer>
      {/* Page Header */}
      <PageHeader
        title="Entity & Incident Investigation"
        subtitle="Correlate network flow events, analyze entity behavior, and reconstruct attack progression"
        statusBadge={
          <Badge variant="neutral" className="px-3 py-1 text-xs font-bold uppercase tracking-wider">
            Entity Correlation
          </Badge>
        }
      />

      {/* Entity Search Bar Card */}
      <Card p-6>
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Enter IP Address, Hostname, Domain, or Alert ID to correlate..."
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              className="input input-has-icon h-[46px] text-sm bg-slate-50 focus:bg-white"
            />
          </div>
          <button type="submit" className="btn btn-primary h-[46px] px-6 w-full sm:w-auto font-bold">
            Correlate Entity
          </button>
        </form>
        <div className="flex items-center gap-2 mt-3 text-xs text-slate-400 font-medium">
          <span>Quick Examples:</span>
          {['192.168.1.105', '10.0.2.42', '443'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setInputQuery(s);
                setTargetEntity(s);
              }}
              className="font-mono text-slate-600 hover:text-slate-900 hover:underline cursor-pointer bg-slate-50 px-2 py-0.5 rounded border border-slate-200"
            >
              {s}
            </button>
          ))}
        </div>
      </Card>

      {/* Target Entity Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card padding="compact">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Target Entity</span>
          <p className="text-xl font-extrabold text-slate-900 font-mono mt-1">{targetEntity}</p>
          <span className="text-xs font-medium text-slate-500 mt-1 block">Network Endpoint Node</span>
        </Card>

        <Card padding="compact">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Correlated Anomalies</span>
          <p className="text-xl font-extrabold text-red-600 mt-1">{relatedEvents.length} Events</p>
          <span className="text-xs font-medium text-slate-500 mt-1 block">Correlated network flows</span>
        </Card>

        <Card padding="compact">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Max Risk Score</span>
          <p className="text-xl font-extrabold text-[#B45309] mt-1">
            {relatedEvents.length > 0 ? Math.max(...relatedEvents.map(e => e.risk_score)) : 0} / 100
          </p>
          <span className="text-xs font-medium text-slate-500 mt-1 block">Calculated Anomaly Score</span>
        </Card>

        <Card padding="compact">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Activity Window</span>
          <p className="text-sm font-extrabold text-slate-900 mt-1">Last 24 Hours</p>
          <span className="text-xs text-slate-400 mt-1 block font-medium">Entity correlation workspace</span>
        </Card>
      </div>

      {/* Correlated Event Log Table */}
      <Card p-6>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="card-title">Correlated Flow Events for {targetEntity}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Flow timeline matching target entity address</p>
          </div>
        </div>

        {relatedEvents.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title="No Correlated Events"
            description={`No flow events matching entity "${targetEntity}" were found in telemetry records.`}
            variant="normal"
            minHeight="min-h-[240px]"
          />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Source IP</th>
                <th>Destination IP</th>
                <th>Destination Port</th>
                <th>Protocol</th>
                <th>Model Prediction</th>
                <th>Risk Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {relatedEvents.map((evt) => (
                <tr key={evt.id} className={clsx(evt.prediction !== 'BENIGN' && 'row-suspicious')}>
                  <td className="text-xs font-mono text-slate-500">{new Date(evt.timestamp).toLocaleTimeString()}</td>
                  <td className="text-xs font-mono font-bold text-slate-900">{evt.source_ip}</td>
                  <td className="text-xs font-mono text-slate-600">{evt.destination_ip}</td>
                  <td className="text-xs font-mono text-slate-600">{evt.destination_port}</td>
                  <td className="text-xs font-bold text-slate-900">{evt.protocol}</td>
                  <td>
                    <Badge variant={evt.prediction === 'BENIGN' ? 'low' : 'critical'}>
                      {evt.prediction === 'BENIGN' ? 'Normal Traffic' : evt.attack_type}
                    </Badge>
                  </td>
                  <td className="text-xs font-bold text-slate-900">{evt.risk_score}%</td>
                  <td>
                    <Badge variant={evt.risk_score >= 75 ? 'critical' : evt.risk_score >= 50 ? 'high' : 'low'}>
                      {evt.risk_score >= 75 ? 'CRITICAL' : evt.risk_score >= 50 ? 'HIGH' : 'LOW'}
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
