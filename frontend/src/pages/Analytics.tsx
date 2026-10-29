import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Info, BarChart2 } from 'lucide-react';
import { api } from '../services/api';
import type { AttackDistribution } from '../types';
import { PageContainer, PageHeader } from '../components/common/PageContainer';
import { Card } from '../components/common/Card';
import { EmptyState } from '../components/common/EmptyState';
import { Badge } from '../components/common/Badge';

export default function AnalyticsPage() {
  const [attacks, setAttacks] = useState<AttackDistribution[]>([]);

  useEffect(() => {
    api.getAttackDistribution().then(res => setAttacks(res.distribution)).catch(console.error);
  }, []);

  return (
    <PageContainer>
      {/* Page Header */}
      <PageHeader
        title="Detection Engine Analytics"
        subtitle="Statistical class imbalance, confusion matrix, and performance curve analysis"
        statusBadge={
          <Badge variant="neutral" className="px-3 py-1 text-xs font-bold uppercase tracking-wider">
            Analytics Workspace
          </Badge>
        }
      />

      {/* Class Distribution Chart Card */}
      <Card p-6 className="min-w-0 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="card-title">Class Distribution (CIC-IDS2017 Benchmark Dataset)</h3>
            <p className="text-xs text-slate-500 mt-0.5">Class imbalance between benign background traffic and attack categories</p>
          </div>
        </div>

        {attacks.length > 0 ? (
          <div className="h-[280px] w-full min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attacks} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="type" tick={{ fontSize: 11 }} stroke="#94A3B8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" />
                <Tooltip
                  formatter={(val: any) => (val ?? 0).toLocaleString()}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    fontSize: '13px',
                  }}
                />
                <Bar dataKey="count" fill="#F5B700" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState
            icon={BarChart2}
            title="No Dataset Classifications Available"
            description="Class distribution will render when dataset telemetry is parsed."
            variant="normal"
            minHeight="min-h-[240px]"
          />
        )}
      </Card>

      {/* Analytics Evaluation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
        <Card p-6 className="min-w-0 overflow-hidden">
          <h3 className="card-title mb-1">Confusion Matrix</h3>
          <p className="text-xs text-slate-500 mb-4">Classification performance metrics matrix</p>
          <EmptyState
            icon={Info}
            title="Confusion Matrix Not Evaluated"
            description="Requires running model inference on full validation set split."
            variant="normal"
            minHeight="min-h-[180px]"
          />
        </Card>

        <Card p-6 className="min-w-0 overflow-hidden">
          <h3 className="card-title mb-1">ROC & Precision-Recall Curves</h3>
          <p className="text-xs text-slate-500 mb-4">Trade-off between detection rate and false positive rate</p>
          <EmptyState
            icon={BarChart2}
            title="ROC Curve Not Evaluated"
            description="Awaiting model evaluation run results."
            variant="normal"
            minHeight="min-h-[180px]"
          />
        </Card>
      </div>
    </PageContainer>
  );
}
