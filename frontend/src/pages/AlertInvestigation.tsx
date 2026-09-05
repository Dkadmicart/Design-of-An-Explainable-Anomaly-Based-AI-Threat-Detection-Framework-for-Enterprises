import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, AlertTriangle, Clock, Shield, Globe,
  ExternalLink, MessageSquare, CheckCircle, XCircle,
  Activity, Info
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../services/api';
import type { Alert, MitreTechnique, NetworkEvent } from '../types';
import { PageContainer, PageHeader } from '../components/common/PageContainer';
import { Card } from '../components/common/Card';
import { Badge, SeverityBadge } from '../components/common/Badge';

export default function AlertInvestigationPage() {
  const { alertId } = useParams();
  const navigate = useNavigate();
  const [notes, setNotes] = useState<{ content: string; time: string }[]>([]);
  const [newNote, setNewNote] = useState('');
  const [alertStatus, setAlertStatus] = useState('NEW');
  const [alert, setAlert] = useState<Alert | null>(null);
  const [mitreTechniques, setMitreTechniques] = useState<MitreTechnique[]>([]);
  const [relatedEvents, setRelatedEvents] = useState<NetworkEvent[]>([]);

  useEffect(() => {
    if (alertId) {
      api.getAlert(alertId).then(res => {
        if (res.alert) {
          setAlert(res.alert);
          setAlertStatus(res.alert.status);
        }
      }).catch(console.error);
    }
    api.getMitreTechniques().then(res => setMitreTechniques(res.techniques)).catch(console.error);
    api.getEvents({ page_size: 6 }).then(res => setRelatedEvents(res.events)).catch(console.error);
  }, [alertId]);

  const mitre = useMemo(() => {
    if (!alert) return undefined;
    return mitreTechniques.find(m => m.attack_types.includes(alert.attack_type));
  }, [alert, mitreTechniques]);

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    setNotes((prev) => [...prev, { content: newNote, time: new Date().toISOString() }]);
    setNewNote('');
  };

  const handleAction = async (action: string) => {
    setAlertStatus(action);
    if (alertId) {
      if (action === 'RESOLVED') await api.resolveAlert(alertId, newNote);
      else if (action === 'ESCALATED') await api.escalateAlert(alertId, newNote);
      else if (action === 'CONFIRMED') await api.confirmAlert(alertId, newNote);
      else if (action === 'BENIGN') await api.markBenignAlert(alertId, newNote);
    }
  };

  if (!alert) {
    return (
      <PageContainer>
        <Card p-12 className="text-center space-y-4 max-w-xl mx-auto my-12">
          <AlertTriangle size={32} className="mx-auto text-amber-500" />
          <h2 className="text-lg font-bold text-slate-900">Alert Not Found</h2>
          <p className="text-xs text-slate-500">No alert record exists matching ID "{alertId}".</p>
          <button onClick={() => navigate('/alerts')} className="btn btn-primary btn-sm mx-auto">
            Return to Alerts Queue
          </button>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* Back Button & Header */}
      <div className="space-y-4">
        <button
          onClick={() => navigate('/alerts')}
          className="btn btn-secondary btn-sm flex items-center gap-2"
        >
          <ArrowLeft size={16} /> Back to Alert Queue
        </button>

        <PageHeader
          title="Alert Investigation Workspace"
          subtitle={`Incident ID: ${alert.id} • Category: ${alert.attack_type}`}
          statusBadge={<SeverityBadge severity={alert.severity} />}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <button className="btn btn-secondary btn-sm" onClick={() => handleAction('INVESTIGATING')}>
                <Activity size={15} className="text-blue-600" /> Mark Investigating
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => handleAction('CONFIRMED')}>
                <Shield size={15} /> Confirm Threat
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => handleAction('FALSE_POSITIVE')}>
                <CheckCircle size={15} className="text-green-600" /> Mark False Positive
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => handleAction('RESOLVED')}>
                <XCircle size={15} className="text-red-600" /> Resolve Alert
              </button>
            </div>
          }
        />
      </div>

      {alertStatus !== 'NEW' && (
        <div className={clsx(
          'px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2',
          alertStatus === 'FALSE_POSITIVE' ? 'bg-green-50 text-green-700 border border-green-200' :
          alertStatus === 'CONFIRMED' ? 'bg-red-50 text-red-700 border border-red-200' :
          alertStatus === 'INVESTIGATING' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
          'bg-emerald-50 text-emerald-700 border border-emerald-200'
        )}>
          <span>Alert Status Updated:</span> <span className="underline">{alertStatus}</span>
        </div>
      )}

      {/* Incident Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
        {[
          { label: 'Alert ID', value: alert.id.slice(-8) },
          { label: 'Severity Level', value: alert.severity },
          { label: 'Attack Type', value: alert.attack_type },
          { label: 'Risk Score', value: `${alert.risk_score}/100` },
          { label: 'Model Confidence', value: `${((alert.confidence || 0) * 100).toFixed(0)}%` },
          { label: 'First Seen', value: new Date(alert.first_seen).toLocaleTimeString() },
          { label: 'Last Seen', value: new Date(alert.last_seen).toLocaleTimeString() },
        ].map((item) => (
          <Card key={item.label} padding="compact">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">{item.label}</span>
            <div className="text-base font-extrabold text-slate-900 mt-1 truncate">{item.value}</div>
          </Card>
        ))}
      </div>

      {/* Why Was This Flagged? Box */}
      <Card p-6 className="bg-amber-50/60 border-amber-200">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={20} className="text-[#B45309]" />
          <h3 className="card-title text-base text-[#92400E]">Why Was This Flagged?</h3>
        </div>
        <p className="text-sm font-semibold text-slate-900 leading-relaxed">
          {alert.detection_reason || 'Anomaly detected based on network flow telemetry metrics.'}
        </p>
      </Card>

      {/* Explainability & Network Telemetry Context */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feature Contribution Explainability */}
        <Card p-6 className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="card-title">Feature Importance & Explanation</h3>
                <p className="text-xs text-slate-500 mt-0.5">Top network parameters triggering model prediction</p>
              </div>
              <span className="text-xs text-slate-400 font-semibold italic bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                SHAP Explainer
              </span>
            </div>

            <div className="p-6 border-2 border-dashed border-slate-200 rounded-xl text-center bg-slate-50/60 space-y-2 my-2">
              <Info size={24} className="mx-auto text-slate-400" />
              <p className="text-xs font-bold text-slate-800">Model Explanation Unavailable</p>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                Feature explainability weights will automatically generate when running trained SHAP model pipelines in the next development phase.
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-4 italic pt-3 border-t border-slate-100">
            Explainability feature weights are derived via SHAP (SHapley Additive exPlanations) when model server is active.
          </p>
        </Card>

        {/* Network Telemetry Context */}
        <Card p-6>
          <div className="flex items-center gap-2 mb-4">
            <Globe size={18} className="text-slate-500" />
            <h3 className="card-title">Network Telemetry Context</h3>
          </div>
          <div className="space-y-3 text-sm">
            {[
              { label: 'Source IP Address', value: alert.source_ip, bold: true },
              { label: 'Destination IP Address', value: alert.destination_ip, bold: true },
              { label: 'Transport Protocol', value: alert.protocol },
              { label: 'Source Port', value: alert.source_port },
              { label: 'Destination Port', value: alert.destination_port },
              { label: 'Flow Duration', value: 'Flow telemetry captured' },
              { label: 'Packet Count', value: 'Awaiting flow parse' },
              { label: 'Byte Volume', value: 'Awaiting flow parse' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-500">{item.label}</span>
                <span className={clsx('text-xs font-mono', item.bold ? 'font-bold text-slate-900' : 'text-slate-600')}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Correlated Event Timeline */}
      <Card p-6>
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} className="text-slate-500" />
          <h3 className="card-title">Correlated Event Timeline</h3>
        </div>
        {relatedEvents.length > 0 ? (
          <div className="relative pl-6 space-y-4">
            <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-200" />
            {relatedEvents.map((evt) => (
              <div key={evt.id} className="relative flex items-start gap-4">
                <div className={clsx(
                  'absolute left-[-17px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white',
                  evt.prediction !== 'BENIGN' ? 'bg-amber-500' : 'bg-slate-300'
                )} />
                <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 gap-2">
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-500">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-xs font-semibold text-slate-900 ml-3">
                      {evt.source_ip} → {evt.destination_ip}:{evt.destination_port} ({evt.protocol})
                    </span>
                  </div>
                  <Badge variant={evt.prediction === 'BENIGN' ? 'low' : 'high'} className="self-start sm:self-auto">
                    {evt.prediction === 'BENIGN' ? 'Normal Traffic' : evt.attack_type}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic py-6 text-center">
            No correlated timeline events recorded.
          </p>
        )}
      </Card>

      {/* MITRE ATT&CK & Analyst Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MITRE ATT&CK */}
        <Card p-6 className="flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Shield size={18} className="text-slate-500" />
              <h3 className="card-title">MITRE ATT&CK Framework Mapping</h3>
            </div>
            {mitre ? (
              <div className="space-y-3.5 text-sm">
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-500">Tactic Category</span>
                  <span className="text-xs font-bold text-slate-900">{mitre.tactic}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-500">Technique Name</span>
                  <span className="text-xs font-bold text-slate-900">{mitre.name}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-500">Technique Identifier</span>
                  <span className="text-xs font-mono font-bold text-blue-600">{mitre.id}</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  {mitre.description}
                </p>
              </div>
            ) : (
              <div className="p-6 border border-dashed border-slate-200 rounded-xl text-center bg-slate-50/60 my-2">
                <p className="text-xs text-slate-400 italic">
                  No MITRE mappings available for this detection.
                </p>
              </div>
            )}
          </div>
          {mitre?.url && (
            <a
              href={mitre.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm w-full mt-4"
            >
              <ExternalLink size={14} /> Open Technique Specification on MITRE ATT&CK
            </a>
          )}
        </Card>

        {/* Analyst Notes */}
        <Card p-6 className="flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare size={18} className="text-slate-500" />
              <h3 className="card-title">Analyst Notes & Triage History</h3>
            </div>

            <div className="space-y-3 mb-4 max-h-[220px] overflow-y-auto pr-1">
              {notes.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">
                  No notes recorded yet for this alert. Add investigation observations below.
                </p>
              ) : (
                notes.map((note, i) => (
                  <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-xs font-medium text-slate-900">{note.content}</p>
                    <span className="text-[10.5px] font-semibold text-slate-400 mt-1.5 block">
                      {new Date(note.time).toLocaleString()} • Analyst Tier-2
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-100">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Type investigation findings, root cause analysis, or triage notes..."
              className="input text-xs min-h-[70px] resize-y bg-slate-50 focus:bg-white"
              rows={3}
            />
            <button className="btn btn-primary btn-sm w-full" onClick={handleAddNote}>
              Add Analyst Note
            </button>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
