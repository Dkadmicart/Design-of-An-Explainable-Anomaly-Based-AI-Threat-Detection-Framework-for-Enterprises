import { useState, useEffect } from 'react';
import { Save, Check, Sliders, Shield } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../services/api';
import type { AppSettings } from '../types';
import { PageContainer, PageHeader } from '../components/common/PageContainer';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({
    detection_mode: 'binary',
    alert_threshold: 50.0,
    replay_speed: 1.0,
    notifications_enabled: true,
    selected_model: 'Random Forest Baseline',
    selected_dataset: 'CIC-IDS2017 Benchmark',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getSettings().then(setSettings).catch(console.error);
  }, []);

  const handleSave = async () => {
    await api.updateSettings(settings).catch(console.error);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <PageContainer className="max-w-4xl">
      {/* Page Header */}
      <PageHeader
        title="Platform Configuration"
        subtitle="Global threat alert thresholds, active model selection, and replay settings"
        statusBadge={
          <Badge variant="neutral" className="px-3 py-1 text-xs font-bold uppercase tracking-wider">
            System Preferences
          </Badge>
        }
      />

      {saved && (
        <div className="p-4 rounded-xl bg-emerald-50 text-emerald-800 text-sm font-bold flex items-center gap-2 border border-emerald-200 animate-fade-in shadow-2xs">
          <Check size={18} className="text-emerald-600" /> Platform settings saved successfully.
        </div>
      )}

      {/* Detection Mode Card */}
      <Card p-6 className="space-y-5">
        <div className="flex items-center gap-2">
          <Sliders size={18} className="text-slate-600" />
          <h3 className="card-title text-base">Detection Classification Engine</h3>
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3 block">
              Classification Architecture
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { id: 'binary', title: 'Binary Detection Mode', desc: 'Classifies traffic strictly into BENIGN vs ATTACK' },
                { id: 'multiclass', title: 'Multiclass Detection Mode', desc: 'Classifies traffic into explicit attack types (DDoS, DoS, PortScan, etc.)' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSettings(s => ({ ...s, detection_mode: m.id as 'binary' | 'multiclass' }))}
                  className={clsx(
                    'p-4 sm:p-5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between',
                    settings.detection_mode === m.id
                      ? 'bg-amber-500/10 border-amber-400 ring-2 ring-amber-400/20 font-bold'
                      : 'border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <div>
                    <div className="font-extrabold text-sm text-slate-900 mb-1">{m.title}</div>
                    <div className="text-xs text-slate-500 font-medium leading-relaxed">{m.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">
                Alert Generation Threshold
              </label>
              <span className="text-xs font-extrabold text-red-700 bg-red-50 px-3 py-1 rounded-lg border border-red-200">
                Risk Score &ge; {settings.alert_threshold}
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={90}
              value={settings.alert_threshold}
              onChange={(e) => setSettings(s => ({ ...s, alert_threshold: Number(e.target.value) }))}
              className="w-full accent-[#F5B700] cursor-pointer my-2"
            />
            <div className="flex justify-between text-[11px] font-semibold text-slate-400">
              <span>Low (Higher sensitivity)</span>
              <span>High (Critical focus)</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Model & Dataset Selection Card */}
      <Card p-6 className="space-y-5">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-slate-600" />
          <h3 className="card-title text-base">Active Model & Dataset Bindings</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2.5 block">
              Active Detection Model
            </label>
            <select
              value={settings.selected_model}
              onChange={(e) => setSettings(s => ({ ...s, selected_model: e.target.value }))}
              className="input select text-xs py-2.5 bg-slate-50 focus:bg-white"
            >
              <option value="Random Forest Baseline">Random Forest Baseline</option>
              <option value="XGBoost Classifier">XGBoost Classifier</option>
              <option value="Logistic Regression">Logistic Regression Baseline</option>
              <option value="Isolation Forest">Isolation Forest Anomaly Detector</option>
              <option value="Autoencoder">Deep Autoencoder Network</option>
              <option value="LSTM Sequence Classifier">LSTM Sequence Classifier</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2.5 block">
              Active Data Stream Source
            </label>
            <select
              value={settings.selected_dataset}
              onChange={(e) => setSettings(s => ({ ...s, selected_dataset: e.target.value }))}
              className="input select text-xs py-2.5 bg-slate-50 focus:bg-white"
            >
              <option value="CIC-IDS2017 Benchmark">CIC-IDS2017 Benchmark Dataset</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Form Action Card Footer */}
      <Card padding="compact" className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-slate-500 font-medium">
          Persist detection engine rules and baseline classifier preferences across platform sessions.
        </div>
        <button className="btn btn-primary px-6 py-2.5 font-bold text-xs flex-shrink-0 w-full sm:w-auto" onClick={handleSave}>
          <Save size={16} /> Save Configuration Settings
        </button>
      </Card>
    </PageContainer>
  );
}
