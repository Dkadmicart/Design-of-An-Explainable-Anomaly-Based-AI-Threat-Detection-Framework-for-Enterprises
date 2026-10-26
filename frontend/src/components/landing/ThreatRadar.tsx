import React, { useEffect, useState } from 'react';

interface AnomalyBlip {
  id: number;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  label: string;
  severity: 'Critical' | 'Medium' | 'Safe';
  pingTime: number;
}

interface ThreatRadarProps {
  threatType: 'ddos' | 'scan' | 'sqli' | 'normal';
  className?: string;
  theme?: 'dark' | 'light';
}

export const ThreatRadar: React.FC<ThreatRadarProps> = ({ threatType, className = '', theme = 'dark' }) => {
  const [blips, setBlips] = useState<AnomalyBlip[]>([]);
  const isLight = theme === 'light';

  useEffect(() => {
    // Generate scenario blips based on the threat vector
    if (threatType === 'ddos') {
      setBlips([
        { id: 1, x: 74, y: 32, label: 'SYN-FLOOD #1', severity: 'Critical', pingTime: Date.now() },
        { id: 2, x: 82, y: 45, label: 'SYN-FLOOD #2', severity: 'Critical', pingTime: Date.now() + 100 },
        { id: 3, x: 70, y: 65, label: 'BOTNET-GW', severity: 'Critical', pingTime: Date.now() + 200 },
        { id: 4, x: 62, y: 28, label: 'SPOOF-SRC', severity: 'Critical', pingTime: Date.now() + 300 },
      ]);
    } else if (threatType === 'scan') {
      setBlips([
        { id: 1, x: 35, y: 25, label: 'PORT 22 RECON', severity: 'Medium', pingTime: Date.now() },
        { id: 2, x: 42, y: 30, label: 'PORT 445 SMB', severity: 'Medium', pingTime: Date.now() + 150 },
        { id: 3, x: 50, y: 22, label: 'PORT 3389 RDP', severity: 'Medium', pingTime: Date.now() + 300 },
      ]);
    } else if (threatType === 'sqli') {
      setBlips([
        { id: 1, x: 48, y: 55, label: 'CVE INGRESS', severity: 'Critical', pingTime: Date.now() },
        { id: 2, x: 52, y: 48, label: 'PAYLOAD-EXPLOIT', severity: 'Critical', pingTime: Date.now() + 200 },
      ]);
    } else {
      setBlips([
        { id: 1, x: 50, y: 50, label: 'BENIGN EDGE', severity: 'Safe', pingTime: Date.now() },
        { id: 2, x: 54, y: 46, label: 'TLS 1.3 GATEWAY', severity: 'Safe', pingTime: Date.now() + 100 },
      ]);
    }
  }, [threatType]);

  return (
    <div className={`relative flex items-center justify-center p-2 select-none ${className}`}>
      {/* Outer Radar Container */}
      <div className={`relative w-48 h-48 sm:w-52 sm:h-52 lg:w-56 lg:h-56 rounded-full bg-slate-950 border-2 ${
        isLight ? 'border-slate-300 shadow-xl' : 'border-slate-700/80 shadow-[0_0_30px_rgba(0,0,0,0.8)_inset]'
      } overflow-hidden`}>
        
        {/* Radar Concentric Circles */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[85%] h-[85%] rounded-full border border-slate-800/80" />
          <div className="absolute w-[60%] h-[60%] rounded-full border border-slate-800/70" />
          <div className="absolute w-[35%] h-[35%] rounded-full border border-slate-800/60" />
          <div className="absolute w-[12%] h-[12%] rounded-full border border-amber-500/40 bg-amber-500/15" />

          {/* Crosshairs */}
          <div className="absolute w-full h-[1px] bg-slate-800/80" />
          <div className="absolute h-full w-[1px] bg-slate-800/80" />

          {/* Compass labels */}
          <span className="absolute top-1.5 text-[9px] font-mono font-bold text-slate-400">000°</span>
          <span className="absolute bottom-1.5 text-[9px] font-mono font-bold text-slate-400">180°</span>
          <span className="absolute left-2 text-[9px] font-mono font-bold text-slate-400">270°</span>
          <span className="absolute right-2 text-[9px] font-mono font-bold text-slate-400">090°</span>
        </div>

        {/* Continuous Rotating Radar Sweep Beam */}
        <div className="absolute inset-0 origin-center animate-radar-sweep pointer-events-none">
          <div
            className="w-full h-full"
            style={{
              background: 'conic-gradient(from 0deg, transparent 0deg, transparent 310deg, rgba(245, 183, 0, 0.08) 330deg, rgba(245, 183, 0, 0.35) 360deg)',
            }}
          />
        </div>

        {/* Dynamic Threat Blips */}
        {blips.map((blip) => {
          const colorClass =
            blip.severity === 'Critical'
              ? 'bg-red-500 text-red-300 shadow-[0_0_12px_#EF4444]'
              : blip.severity === 'Medium'
              ? 'bg-amber-400 text-amber-200 shadow-[0_0_10px_#F5B700]'
              : 'bg-emerald-400 text-emerald-200 shadow-[0_0_10px_#10B981]';

          const pingClass =
            blip.severity === 'Critical'
              ? 'border-red-500'
              : blip.severity === 'Medium'
              ? 'border-amber-400'
              : 'border-emerald-400';

          return (
            <div
              key={blip.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
              style={{ left: `${blip.x}%`, top: `${blip.y}%` }}
            >
              {/* Outer Pulsing Ping Ring */}
              <span
                className={`absolute -inset-2.5 rounded-full border opacity-75 animate-ping ${pingClass}`}
              />
              
              {/* Core Node */}
              <span className={`relative block w-2.5 h-2.5 rounded-full ${colorClass}`} />

              {/* Tooltip on hover */}
              <div className="absolute left-3 top-[-10px] hidden group-hover:flex flex-col bg-slate-900/95 border border-slate-700 text-[9px] font-mono px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-30">
                <span className="font-bold text-white">{blip.label}</span>
                <span className="text-slate-400">{blip.severity} Alert</span>
              </div>
            </div>
          );
        })}

        {/* HUD Overlay Text */}
        <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[9px] font-mono text-slate-400 pointer-events-none">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            SWEEP 360°
          </span>
          <span className="text-amber-400 font-bold">
            {blips.length} {blips.length === 1 ? 'TARGET' : 'TARGETS'}
          </span>
        </div>
      </div>
    </div>
  );
};
