import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Clock, Info, Database } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../services/api';
import type { MLModel } from '../types';
import { PageContainer, PageHeader } from '../components/common/PageContainer';
import { Card } from '../components/common/Card';
import { EmptyState } from '../components/common/EmptyState';
import { DataTable } from '../components/common/DataTable';
import { Badge } from '../components/common/Badge';

const TABS = ['Model Registry', 'Performance Matrix', 'Evaluation Splits'] as const;

export default function ModelsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('Model Registry');
  const [models, setModels] = useState<MLModel[]>([]);

  useEffect(() => {
    api.getModels().then(res => setModels(res.models)).catch(console.error);
  }, []);

  const activeModel = models.find(m => m.status === 'ACTIVE') || {
    id: 'none',
    name: 'Random Forest Baseline',
    version: 'v1.0.0',
    model_type: 'Supervised Ensemble',
    status: 'ACTIVE' as const,
    description: 'Primary supervised classifier baseline',
    trained_at: null,
    training_dataset: 'CIC-IDS2017 Benchmark',
    hyperparameters: null,
  };

  return (
    <PageContainer>
      {/* Page Header */}
      <PageHeader
        title="ML Detection Model Management"
        subtitle="Supervised classifiers & anomaly detection models evaluation"
        statusBadge={
          <Badge variant="neutral" className="px-3 py-1 text-xs font-bold uppercase tracking-wider">
            Model Registry
          </Badge>
        }
        actions={
          <button
            onClick={() => navigate('/datasets')}
            className="btn btn-secondary btn-sm flex items-center gap-1.5"
          >
            <Database size={15} /> Dataset Inventory
          </button>
        }
      />

      {/* Active Model Baseline Card */}
      <Card p-6 className="border-l-4 border-l-[#F5B700] bg-gradient-to-r from-white to-amber-50/30">
        <div className="flex items-center gap-2 mb-4">
          <Brain size={22} className="text-[#B45309]" />
          <h3 className="card-title text-base text-[#92400E]">Active Classification Model Baseline</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Model Architecture</span>
            <p className="text-base font-extrabold text-slate-900 mt-1">{activeModel.name}</p>
          </div>
          <div>
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Version</span>
            <p className="text-sm font-extrabold text-slate-900 mt-1">{activeModel.version}</p>
          </div>
          <div>
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Status</span>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="status-dot status-healthy pulse-dot" />
              <span className="text-xs font-bold text-emerald-700">ACTIVE INFERENCE</span>
            </div>
          </div>
          <div>
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Evaluation Status</span>
            <p className="text-xs text-slate-400 italic font-medium mt-1">
              Not Evaluated
            </p>
          </div>
          <div>
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Target Dataset</span>
            <p className="text-xs font-extrabold text-slate-900 mt-1">{activeModel.training_dataset || 'CIC-IDS2017'}</p>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx('tab text-sm py-2.5 px-4 font-semibold', activeTab === tab && 'tab-active')}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Model Registry' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {models.map((model) => (
            <Card
              key={model.id}
              hover
              p-5
              className={clsx('flex flex-col justify-between', model.status === 'ACTIVE' && 'border-[#F5B700]')}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="card-title text-base">{model.name}</h3>
                  <Badge
                    variant={
                      model.status === 'ACTIVE' ? 'low' :
                      model.status === 'TRAINING' ? 'high' : 'info'
                    }
                  >
                    {model.status}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed font-medium">{model.description}</p>
              </div>

              <div className="space-y-2 text-xs pt-3 border-t border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Algorithm Type</span>
                  <span className="font-bold text-slate-900">{model.model_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Version</span>
                  <span className="font-mono font-bold text-slate-900">{model.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Evaluation Status</span>
                  <span className="text-slate-400 italic font-medium">
                    Not Evaluated
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'Performance Matrix' && (
        <Card p-6 className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="card-title">Model Metrics Matrix</h3>
              <p className="text-xs text-slate-500 mt-0.5">Evaluation metrics will populate when model training scripts execute</p>
            </div>
          </div>

          <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200 text-xs text-blue-800 flex items-start gap-2">
            <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <span>Research Integrity: All metrics show "Not Evaluated" until models are trained and evaluated on dataset splits.</span>
          </div>

          <DataTable>
            <thead>
              <tr>
                <th>Model Algorithm</th>
                <th>Precision</th>
                <th>Recall</th>
                <th>F1 Score</th>
                <th>ROC-AUC</th>
                <th>PR-AUC</th>
                <th>False Positive Rate</th>
                <th>Inference Latency</th>
              </tr>
            </thead>
            <tbody>
              {models.map((model) => (
                <tr key={model.id}>
                  <td className="text-xs font-bold text-slate-900">{model.name}</td>
                  <td className="text-xs text-slate-400 italic font-medium">Not Evaluated</td>
                  <td className="text-xs text-slate-400 italic font-medium">Not Evaluated</td>
                  <td className="text-xs text-slate-400 italic font-medium">Not Evaluated</td>
                  <td className="text-xs text-slate-400 italic font-medium">Not Evaluated</td>
                  <td className="text-xs text-slate-400 italic font-medium">Not Evaluated</td>
                  <td className="text-xs text-slate-400 italic font-medium">Not Evaluated</td>
                  <td className="text-xs text-slate-400 italic font-medium">Not Evaluated</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Card>
      )}

      {activeTab === 'Evaluation Splits' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { title: 'Training Split (70%)', desc: 'Baseline training set for model fitting' },
            { title: 'Validation Split (15%)', desc: 'Hyperparameter tuning and early stopping' },
            { title: 'Test Evaluation Split (15%)', desc: 'Unseen evaluation set for precision/recall' }
          ].map((split) => (
            <Card key={split.title} p-6 className="text-center py-10 space-y-3">
              <div>
                <h3 className="card-title text-base">{split.title}</h3>
                <p className="text-xs text-slate-500 font-medium mt-1">{split.desc}</p>
              </div>
              <EmptyState
                icon={Clock}
                title="Split Metrics Pending"
                description="Split metrics will populate during the ML training phase."
                variant="normal"
                minHeight="min-h-[160px]"
              />
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
