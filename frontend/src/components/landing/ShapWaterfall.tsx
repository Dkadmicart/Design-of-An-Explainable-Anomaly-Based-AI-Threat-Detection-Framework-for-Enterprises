import React from 'react';

export interface ShapFeature {
  name: string;
  label: string;
  rawVal: string;
  shapVal: number; // positive = malicious push, negative = benign push
  percentage: number; // 0 - 100 for visual bar
}

interface ShapWaterfallProps {
  features: ShapFeature[];
  baseScore?: number;
  anomalyScore: number;
  className?: string;
  theme?: 'dark' | 'light';
}

export const ShapWaterfall: React.FC<ShapWaterfallProps> = ({
  features,
  anomalyScore,
  className = '',
  theme = 'dark',
}) => {
  const isLight = theme === 'light';

  return (
    <div className={`space-y-6 font-sans ${className}`}>
      {/* Header bar with Anomaly Risk Gauge (Centered) */}
      <div className={`flex flex-wrap items-center justify-center gap-4 sm:gap-8 pb-4 border-b text-center ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
        <span className={`font-mono text-xs font-bold flex items-center justify-center gap-2.5 ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
          <span className="w-2.5 h-2.5 rounded-full bg-[#F5B700] animate-pulse" />
          TreeSHAP Attribution Vector
        </span>
        <div className="flex items-center justify-center gap-2.5 font-mono text-xs">
          <span className={isLight ? 'text-slate-500 font-semibold' : 'text-slate-400'}>P(Anomaly):</span>
          <span
            className={`font-black text-sm px-2.5 py-0.5 rounded-full border ${
              anomalyScore > 0.8
                ? isLight ? 'bg-red-50 text-red-700 border-red-300' : 'bg-red-950/80 text-red-300 border-red-800'
                : anomalyScore > 0.4
                ? isLight ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-amber-950/80 text-amber-300 border-amber-800'
                : isLight ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
            }`}
          >
            {(anomalyScore * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Feature Contributions List — Spacious dedicated feature panels */}
      <div className="space-y-4">
        {features.map((feat, idx) => {
          const isMaliciousPush = feat.shapVal >= 0;
          return (
            <div
              key={idx}
              className={`p-3.5 sm:p-4 rounded-xl border space-y-2.5 transition-all ${
                isLight ? 'bg-slate-50/70 border-slate-200' : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              {/* Row 1: Label and Score */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`font-bold tracking-tight text-sm truncate ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                    {feat.label}
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border flex-shrink-0 ${
                    isLight 
                      ? 'bg-white text-slate-700 border-slate-300 font-semibold' 
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}>
                    {feat.rawVal}
                  </span>
                </div>
                <div
                  className={`font-mono text-sm font-black flex-shrink-0 ml-3 ${
                    isMaliciousPush
                      ? isLight ? 'text-amber-700' : 'text-amber-400'
                      : isLight ? 'text-cyan-700' : 'text-cyan-400'
                  }`}
                >
                  {isMaliciousPush ? `+${feat.shapVal.toFixed(2)}` : feat.shapVal.toFixed(2)}
                </div>
              </div>

              {/* Row 2: Sub-telemetry key */}
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>
                  key: <strong className={isLight ? 'text-slate-800' : 'text-slate-300'}>{feat.name}</strong>
                </span>
                <span className={isLight ? 'text-slate-600 font-semibold' : 'text-slate-400'}>
                  Weight: {feat.percentage}%
                </span>
              </div>

              {/* Row 3: Progress Bar with smooth rounded edges */}
              <div className={`h-2.5 w-full rounded-full overflow-hidden p-0.5 border ${
                isLight 
                  ? 'bg-slate-200 border-slate-300' 
                  : 'bg-slate-950 border-slate-800'
              }`}>
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    isMaliciousPush
                      ? 'bg-gradient-to-r from-amber-500 to-red-500'
                      : 'bg-gradient-to-r from-emerald-500 to-cyan-500'
                  }`}
                  style={{ width: `${Math.min(Math.max(feat.percentage, 6), 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Legend */}
      <div className={`pt-3 border-t flex flex-wrap items-center justify-between gap-3 text-xs font-mono ${
        isLight ? 'border-slate-200 text-slate-700' : 'border-slate-800 text-slate-400'
      }`}>
        <span className="flex items-center gap-1.5 font-bold">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" /> +Risk Driver
        </span>
        <span className="flex items-center gap-1.5 font-bold">
          <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500 inline-block" /> -Benign Baseline
        </span>
        <span className={isLight ? 'text-slate-500 italic text-[11px]' : 'text-slate-500 italic text-[11px]'}>
          TreeSHAP Exact Decomposition
        </span>
      </div>
    </div>
  );
};
