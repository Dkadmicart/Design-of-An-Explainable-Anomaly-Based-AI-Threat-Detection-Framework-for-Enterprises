import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Hexagon, Activity, Target,
  ArrowRight, CheckCircle2,
  Eye, ChevronRight, Shield, Zap,
  Cpu, Lock, Sparkles, Sliders,
  BarChart3,
  Sun, Moon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/common/Button';
import { ThreatCanvas } from '../components/landing/ThreatCanvas';
import { ThreatRadar } from '../components/landing/ThreatRadar';
import { ShapWaterfall, type ShapFeature } from '../components/landing/ShapWaterfall';

// ─── Threat Scenario Definitions ────────────────────────────────────────────
interface ThreatScenario {
  id: 'ddos' | 'scan' | 'sqli' | 'normal';
  label: string;
  title: string;
  severity: 'Critical' | 'Medium' | 'Safe';
  mitre: string;
  anomalyScore: number;
  rate: string;
  telemetryLog: string;
  action: string;
  shapFeatures: ShapFeature[];
}

const SCENARIOS: Record<string, ThreatScenario> = {
  ddos: {
    id: 'ddos',
    label: 'SYN DDoS',
    title: 'Volumetric SYN Flood Denial of Service',
    severity: 'Critical',
    mitre: 'Impact • T1498.001',
    anomalyScore: 0.984,
    rate: '142,500 pkts/s',
    telemetryLog: 'INBOUND [192.168.1.100:443] SYN_SENT x94,200 | FlowBytes/s 8.4x baseline',
    action: 'Null-route target subnet & enforce edge rate-limiting via BGP Flowspec.',
    shapFeatures: [
      { name: 'flow_bytes_s', label: 'Flow Volume Rate', rawVal: '14.8 MB/s', shapVal: 0.84, percentage: 92 },
      { name: 'syn_flag_count', label: 'SYN Flag Saturation', rawVal: '98.2%', shapVal: 0.72, percentage: 80 },
      { name: 'pkt_len_std', label: 'Packet Length Variance', rawVal: '0.04', shapVal: 0.46, percentage: 55 },
      { name: 'tcp_ack_ratio', label: 'ACK Handshake Ratio', rawVal: '0.01%', shapVal: -0.15, percentage: 18 },
    ],
  },
  scan: {
    id: 'scan',
    label: 'Port Scan',
    title: 'Nmap Stealth Reconnaissance Sweep',
    severity: 'Medium',
    mitre: 'Discovery • T1046',
    anomalyScore: 0.912,
    rate: '2,840 probes/s',
    telemetryLog: 'SRC 10.0.8.44 -> DST [1-65535] | RST_RECVD: 94% | Sequential port sweep',
    action: 'Isolate source IP 10.0.8.44 at edge NAC & enforce immediate port lockout.',
    shapFeatures: [
      { name: 'dst_port_variance', label: 'Port Dispersal Entropy', rawVal: '9.82', shapVal: 0.76, percentage: 85 },
      { name: 'rst_flag_ratio', label: 'RST Rejection Ratio', rawVal: '94.2%', shapVal: 0.58, percentage: 68 },
      { name: 'flow_duration', label: 'Microflow Duration', rawVal: '1.2ms', shapVal: 0.39, percentage: 48 },
      { name: 'payload_size', label: 'Payload Data Size', rawVal: '0 bytes', shapVal: -0.12, percentage: 15 },
    ],
  },
  sqli: {
    id: 'sqli',
    label: 'CVE / SQLi',
    title: 'Web Application Exploit & Payload Ingress',
    severity: 'Critical',
    mitre: 'Initial Access • T1190',
    anomalyScore: 0.958,
    rate: '48 req/s',
    telemetryLog: 'POST /api/v1/auth/token?admin=1 UNION SELECT | SQL pattern match 0.96',
    action: 'WAF rule #4902 auto-activated: terminate session & quarantine source endpoint.',
    shapFeatures: [
      { name: 'payload_entropy', label: 'String Payload Entropy', rawVal: '5.84 bits', shapVal: 0.79, percentage: 88 },
      { name: 'pkt_length_std', label: 'Length Deviance', rawVal: '1420 bytes', shapVal: 0.64, percentage: 72 },
      { name: 'bwd_iat_mean', label: 'Response Inter-Arrival', rawVal: '850ms', shapVal: 0.41, percentage: 50 },
      { name: 'tls_cipher', label: 'TLS Handshake Signature', rawVal: 'Standard', shapVal: -0.18, percentage: 22 },
    ],
  },
  normal: {
    id: 'normal',
    label: 'Benign Flow',
    title: 'Legitimate Enterprise HTTPS TLS 1.3 Traffic',
    severity: 'Safe',
    mitre: 'Benign Baseline Operations',
    anomalyScore: 0.021,
    rate: '320 pkts/s',
    telemetryLog: 'SESSION OK: 10.0.2.15:52410 -> CDN Edge 104.16.24.5:443 | Cipher: TLS_AES_256',
    action: 'Traffic conforms to operational baseline. No mitigation required.',
    shapFeatures: [
      { name: 'tls_handshake', label: 'Verified TLS Handshake', rawVal: 'Valid Cert', shapVal: -0.88, percentage: 95 },
      { name: 'tcp_ack_ratio', label: 'Balanced TCP ACK Flow', rawVal: '1:1.02', shapVal: -0.74, percentage: 82 },
      { name: 'flow_duration', label: 'Duration Stability', rawVal: '4.8s', shapVal: -0.52, percentage: 60 },
      { name: 'flow_bytes_s', label: 'Data Transfer Rate', rawVal: '184 KB/s', shapVal: 0.05, percentage: 10 },
    ],
  },
};

type Theme = 'dark' | 'light';

/* ═══════════════════════════════════════════════════════════════════════════
   LANDING PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { theme, toggleTheme, isLight } = useTheme();
  const [activeKey, setActiveKey] = useState<'ddos' | 'scan' | 'sqli' | 'normal'>('ddos');
  const [packetCounter, setPacketCounter] = useState(1489240);

  const scenario = SCENARIOS[activeKey];
  const goTo = useCallback((path: string) => navigate(isAuthenticated ? path : '/login'), [navigate, isAuthenticated]);

  // Live telemetry stream counter
  useEffect(() => {
    const timer = setInterval(() => {
      setPacketCounter((p) => p + Math.floor(Math.random() * 45 + 15));
    }, 1200);
    return () => clearInterval(timer);
  }, []);

  // Theme-aware tokens with high contrast
  const bgMain = isLight ? 'bg-[#F8FAFC]' : 'bg-[#020617]';
  const bgSectionAlt = isLight ? 'bg-white' : 'bg-[#060D20]';
  const textHeading = isLight ? 'text-slate-900' : 'text-slate-100';
  const textBody = isLight ? 'text-slate-700' : 'text-slate-300';
  const textMuted = isLight ? 'text-slate-600' : 'text-slate-400';
  const borderCol = isLight ? 'border-slate-200' : 'border-slate-800';
  const cardBg = isLight ? 'bg-white shadow-xl border-slate-200' : 'bg-slate-900/80 border-slate-800 shadow-2xl';
  const navBg = isLight ? 'bg-white/95 border-b border-slate-200' : 'bg-[#020617]/90 border-b border-white/[0.08]';

  return (
    <div
      data-theme={theme}
      className={`min-h-screen ${bgMain} ${textHeading} font-sans selection:bg-amber-400 selection:text-slate-950 flex flex-col transition-colors duration-300`}
    >
      {/* ━━━━ NAVBAR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <header className={`w-full ${navBg} backdrop-blur-xl sticky top-0 z-50 transition-colors duration-300`}>
        <div className="landing-container h-18 sm:h-20 flex items-center justify-between">
          {/* Brand Logo */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-[#F5B700] border border-amber-600/40 flex items-center justify-center group-hover:scale-105 transition-transform shadow-[0_0_20px_rgba(245,183,0,0.4)]">
                <Hexagon size={20} className="text-slate-950 fill-slate-950/20" strokeWidth={2.5} />
              </div>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#020617] animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className={`text-base sm:text-lg font-black tracking-tight leading-none ${isLight ? 'text-slate-900' : 'text-white'}`}>
                SentinelAI
              </span>
              <span className={`text-[10px] font-mono font-bold tracking-wider uppercase mt-1 ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                Explainable SOC Platform
              </span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-4">
            {/* Live Packet Counter */}
            <div
              className={`hidden md:flex items-center gap-2.5 px-4 py-1.5 rounded-full border text-xs font-mono font-semibold ${isLight ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>LIVE:</span>
              <span className="text-amber-600 dark:text-amber-400 font-bold tabular-nums">
                {packetCounter.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400">pkts/s</span>
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className={`theme-toggle rounded-full ${isLight ? 'border-slate-300' : 'border-white/20'}`}
              aria-label="Toggle dark/light theme"
              title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              <div className="theme-toggle-knob rounded-full">
                {isLight ? (
                  <Moon size={12} className="text-white" />
                ) : (
                  <Sun size={12} className="text-slate-950" />
                )}
              </div>
            </button>

            {/* Auth Buttons */}
            {isAuthenticated ? (
              <Button
                variant="primary"
                size="md"
                shape="rounded"
                iconRight={ArrowRight}
                onClick={() => navigate('/dashboard')}
                className="font-bold px-5 h-10 rounded-xl"
              >
                SOC Console
              </Button>
            ) : (
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="md"
                  shape="rounded"
                  onClick={() => navigate('/login')}
                  className={`h-10 px-4 rounded-xl font-bold ${isLight ? 'text-slate-700 hover:text-slate-950 hover:bg-slate-200/60' : 'text-slate-300 hover:text-white'
                    }`}
                >
                  Sign In
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  shape="rounded"
                  iconRight={ArrowRight}
                  onClick={() => navigate('/login')}
                  className="font-bold px-5 h-10 rounded-xl"
                >
                  Launch Console
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ━━━━ HERO SECTION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className={`relative overflow-hidden cyber-grid-bg border-b ${borderCol} transition-colors duration-300`}>
        {theme === 'dark' && <ThreatCanvas threatLevel={scenario.severity} className="opacity-45" />}

        {/* Ambient Glowing Orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className={`absolute top-[8%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-[140px] animate-pulse-glow ${isLight ? 'bg-amber-300/[0.14]' : 'bg-amber-500/[0.09]'
              }`}
          />
        </div>

        <div className="relative z-10 landing-container flex flex-col items-center text-center pt-24 pb-24 sm:pt-32 sm:pb-32 lg:pt-36 lg:pb-36">
          {/* Badge */}
          <div
            className={`inline-flex items-center gap-2.5 px-5 py-2 rounded-full border text-xs font-mono font-bold tracking-widest uppercase shadow-sm ${isLight
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-[0_0_20px_rgba(245,183,0,0.15)]'
              }`}
          >
            <Shield size={15} className="text-amber-500 animate-pulse" />
            <span>EXPLAINABLE ANOMALY-BASED AI THREAT DETECTION</span>
          </div>

          {/* Explicit Physical Spacer between Badge and Headline */}
          <div className="h-8 sm:h-10" />

          {/* Headline */}
          <h1
            className={`max-w-4xl text-3xl sm:text-5xl lg:text-6xl font-black leading-[1.15] tracking-tight ${textHeading}`}
          >
            Next-Gen Threat Detection{' '}
            <span className="animate-shimmer-text block sm:inline">with TreeSHAP Explainability</span>
          </h1>

          {/* Explicit Physical Spacer between Headline and Subtitle */}
          <div className="h-8 sm:h-10" />

          {/* Subtitle */}
          <p
            className={`max-w-2xl text-base sm:text-lg leading-relaxed ${textBody}`}
          >
            Eliminate black-box AI doubt. Real-time anomaly detection with tri-ensemble machine learning
            and instant feature-level root cause attribution down to network flow telemetry.
          </p>

          {/* Explicit Physical Spacer between Subtitle and Buttons */}
          <div className="h-12 sm:h-16" />

          {/* CTA Buttons — ROUNDED, ROOMY SIZES WITH AMPLE BREATHING ROOM */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5 sm:gap-6 w-full max-w-xl mx-auto">
            <Button
              variant="primary"
              size="xl"
              shape="rounded"
              iconRight={ArrowRight}
              onClick={() => goTo('/dashboard')}
              className="w-full sm:w-auto h-14 sm:h-15 px-9 sm:px-10 text-base font-extrabold rounded-2xl shadow-[0_0_30px_rgba(245,183,0,0.35)] hover:shadow-[0_0_45px_rgba(245,183,0,0.55)] cursor-pointer"
            >
              Launch SOC Console
            </Button>
            <Button
              variant="secondary-dark"
              size="xl"
              shape="rounded"
              icon={Activity}
              onClick={() => goTo('/live-monitor')}
              className={`w-full sm:w-auto h-14 sm:h-15 px-8 sm:px-9 text-base font-bold rounded-2xl border-2 ${isLight
                  ? 'bg-white text-slate-900 border-slate-300 hover:bg-slate-100 hover:border-slate-400 shadow-md'
                  : 'bg-slate-900/90 text-slate-100 border-slate-700 hover:border-slate-500 hover:bg-slate-800 shadow-lg'
                }`}
            >
              Live Threat Monitor
            </Button>
          </div>

          {/* Explicit Physical Spacer between Buttons and Trust Badges (Guarantees zero overlap) */}
          <div className="h-16 sm:h-20" />

          {/* Trust Badges */}
          <div
            className={`flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-xs sm:text-sm font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'
              }`}
          >
            {[
              { icon: CheckCircle2, label: 'TreeSHAP Attribution', color: 'text-amber-500' },
              { icon: Target, label: 'MITRE ATT&CK Triage', color: 'text-cyan-500' },
              { icon: Zap, label: '<42 ms Latency', color: 'text-emerald-500' },
              { icon: Cpu, label: '99.4% Precision', color: 'text-amber-500' },
            ].map((badge, i) => {
              const Icon = badge.icon;
              return (
                <span key={i} className="flex items-center gap-2">
                  <Icon size={16} className={badge.color} strokeWidth={2.5} />
                  <span>{badge.label}</span>
                </span>
              );
            })}
          </div>
        </div>
      </section>

      {/* ━━━━ GENEROUS PHYSICAL SPACING BEFORE INTERACTIVE THREAT INSPECTOR ━━ */}
      <div className="h-16 sm:h-28 w-full" />

      {/* ━━━━ INTERACTIVE THREAT INSPECTOR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className={`${bgSectionAlt} border-b ${borderCol} py-28 sm:py-36 transition-colors duration-300`}>
        <div className="landing-container flex flex-col items-center">
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto flex flex-col items-center">
            <span
              className={`text-xs font-mono font-bold tracking-widest uppercase flex items-center justify-center gap-2 ${isLight ? 'text-amber-700' : 'text-amber-400'
                }`}
            >
              <Sliders size={14} />
              INTERACTIVE THREAT INSPECTOR
            </span>
            <div className="h-4" />
            <h2 className={`text-2xl sm:text-4xl font-black tracking-tight ${textHeading}`}>
              Inspect Live Vectors &amp; Feature Attribution
            </h2>
            <div className="h-5" />
            <p className={`text-sm sm:text-base leading-relaxed ${textMuted}`}>
              Click any vector below to evaluate autonomous AI verdict, radar blips, and SHAP Shapley values.
            </p>
          </div>

          {/* Explicit Physical Spacer between Header and Main Console Card */}
          <div className="h-14 sm:h-18" />

          {/* Main Console Box (2-Column Architecture with Scanline & Rounded Buttons, Centered) */}
          <div className={`relative w-full max-w-6xl mx-auto glass-cyber-card rounded-3xl border-2 ${borderCol} overflow-hidden shadow-2xl`}>
            {/* Animated Laser Scanline Beam across the card */}
            <div className="animate-scanline" />

            {/* Top Toolbar: Stream Status + Scenario Tabs (Centered) */}
            <div
              className={`border-b ${borderCol} p-6 sm:p-7 flex flex-col items-center justify-center gap-5 text-center ${isLight ? 'bg-slate-50/90' : 'bg-slate-900/90'
                }`}
            >
              <div className="flex items-center justify-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className={`text-xs font-mono font-bold uppercase tracking-wider ${textHeading}`}>
                  Telemetry Stream Active
                </span>
                <span className={`text-xs font-mono ${textMuted}`}>
                  Rate: <strong className="text-amber-500 font-bold">{scenario.rate}</strong>
                </span>
              </div>

              {/* Scenario Switcher Tabs: Rounded Buttons, Centered */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                {(['ddos', 'scan', 'sqli', 'normal'] as const).map((key) => {
                  const isActive = activeKey === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveKey(key)}
                      className={`h-11 sm:h-12 px-5 sm:px-6 rounded-xl text-xs sm:text-sm font-mono font-bold border transition-all duration-200 cursor-pointer ${isActive
                          ? 'bg-[#F5B700] text-slate-950 border-amber-600 shadow-[0_0_18px_rgba(245,183,0,0.4)] scale-102'
                          : isLight
                            ? 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:text-slate-900 hover:border-slate-400'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                        }`}
                    >
                      {SCENARIOS[key].label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Body: 2 Columns with Generous Dedicated Widths */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
              {/* Left Column (5 Cols): Radar Display + Classification Verdict */}
              <div className="lg:col-span-5 p-6 sm:p-10 space-y-8 flex flex-col justify-between">
                <div>
                  <div className="flex flex-wrap items-center justify-center gap-3 mb-5 text-center">
                    <span className={`text-xs font-mono font-bold uppercase tracking-wider ${textMuted}`}>
                      Radar Telemetry Scan
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-black font-mono uppercase border ${scenario.severity === 'Critical'
                          ? isLight
                            ? 'bg-red-50 text-red-700 border-red-300'
                            : 'bg-red-950/80 text-red-300 border-red-800'
                          : scenario.severity === 'Medium'
                            ? isLight
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-amber-950/80 text-amber-300 border-amber-800'
                            : isLight
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                        }`}
                    >
                      {scenario.severity} RISK
                    </span>
                  </div>

                  <div className="h-4" />

                  {/* Threat Radar Display (Centered) */}
                  <div className="py-2 flex justify-center">
                    <ThreatRadar threatType={scenario.id} theme={theme} />
                  </div>
                </div>

                <div className="h-6" />

                {/* Classification Verdict Box (Centered Text & Layout) */}
                <div className={`p-6 rounded-2xl border space-y-4 text-center flex flex-col items-center ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'}`}>
                  <div>
                    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider block mb-1.5 ${textMuted}`}>
                      Vector Classification
                    </span>
                    <h3 className={`text-base sm:text-lg font-black leading-snug ${textHeading}`}>
                      {scenario.title}
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5 text-xs font-mono w-full">
                    <div className={`p-3.5 rounded-xl border text-center ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                      <span className={`text-[10px] block ${textMuted}`}>MITRE Technique</span>
                      <strong className="text-amber-600 dark:text-amber-400 text-xs truncate block mt-1">
                        {scenario.mitre}
                      </strong>
                    </div>
                    <div className={`p-3.5 rounded-xl border text-center ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                      <span className={`text-[10px] block ${textMuted}`}>Model Confidence</span>
                      <strong className="text-cyan-600 dark:text-cyan-400 text-xs block mt-1">
                        {(scenario.anomalyScore * 100).toFixed(1)}% Match
                      </strong>
                    </div>
                  </div>

                  <div className={`text-xs font-mono p-3.5 rounded-xl border w-full text-center truncate ${isLight ? 'bg-slate-100 text-slate-800 border-slate-300' : 'bg-slate-900/80 text-slate-300 border-slate-800'}`}>
                    &gt; {scenario.telemetryLog}
                  </div>
                </div>
              </div>

              {/* Right Column (7 Cols): TreeSHAP Waterfall Studio */}
              <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between">
                <div>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-6 text-center">
                    <div>
                      <span className={`text-xs font-mono font-bold uppercase tracking-wider block ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                        Explainable Attribution
                      </span>
                      <div className="h-1.5" />
                      <h3 className={`text-lg sm:text-xl font-black tracking-tight ${textHeading}`}>
                        TreeSHAP Root Cause Breakdown
                      </h3>
                    </div>
                    <span className={`text-xs font-mono px-3.5 py-1.5 rounded-full border self-center ${isLight ? 'bg-slate-100 border-slate-300 text-slate-700 font-semibold' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                      Additive Shapley Values
                    </span>
                  </div>

                  <div className="h-6 sm:h-8" />

                  {/* Waterfall Component with Theme Support */}
                  <ShapWaterfall
                    features={scenario.shapFeatures}
                    anomalyScore={scenario.anomalyScore}
                    theme={theme}
                  />
                </div>

                <div className="h-8 sm:h-10" />

                {/* Remediation Action Banner with Rounded Button (Centered) */}
                <div
                  className={`p-6 sm:p-7 rounded-2xl border flex flex-col items-center justify-center text-center gap-4 ${isLight ? 'bg-amber-50/70 border-amber-200' : 'bg-amber-500/[0.04] border-amber-500/20'
                    }`}
                >
                  <div className="space-y-1.5 flex flex-col items-center text-center">
                    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider block ${isLight ? 'text-amber-800' : 'text-amber-400'}`}>
                      Autonomous SOC Remediation
                    </span>
                    <p className={`text-xs sm:text-sm leading-relaxed max-w-lg ${textBody}`}>
                      {scenario.action}
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="md"
                    shape="rounded"
                    onClick={() => goTo('/alerts')}
                    className="font-bold px-8 h-11 rounded-xl border border-amber-600/40"
                  >
                    Investigate Alert
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━ GENEROUS PHYSICAL SPACING BEFORE BENCHMARK VALIDATION ━━━━━━━ */}
      <div className="h-16 sm:h-28 w-full" />

      {/* ━━━━ KEY METRICS (BENCHMARK VALIDATION - Centered) ━━━━━━━━━━━━━━━ */}
      <section className={`${bgMain} border-b ${borderCol} py-28 sm:py-36 transition-colors duration-300`}>
        <div className="landing-container flex flex-col items-center">
          {/* Section Header (Centered) */}
          <div className="text-center max-w-2xl mx-auto flex flex-col items-center">
            <span
              className={`text-xs font-mono font-bold uppercase tracking-widest flex items-center justify-center gap-2 ${isLight ? 'text-amber-700' : 'text-amber-400'
                }`}
            >
              <BarChart3 size={14} />
              BENCHMARK VALIDATION
            </span>
            <div className="h-4" />
            <h2 className={`text-2xl sm:text-4xl font-black tracking-tight ${textHeading}`}>
              Empirical Precision &amp; Real-Time Latency
            </h2>
            <div className="h-5" />
            <p className={`text-sm sm:text-base leading-relaxed ${textMuted}`}>
              Evaluated against standard CIC-IDS2017 &amp; NSL-KDD enterprise benchmarks with zero explainability lag.
            </p>
          </div>

          {/* Explicit Physical Spacer between Header and Metric Cards */}
          <div className="h-14 sm:h-20" />

          {/* Metric Cards Grid (Centered) */}
          <div className="w-full max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {[
              { val: '99.4%', label: 'Ensemble Accuracy', desc: 'CIC-IDS2017 Benchmark', color: 'text-amber-600 dark:text-amber-400', borderTop: 'border-t-4 border-t-amber-500' },
              { val: '<42ms', label: 'Inference Latency', desc: 'Sub-Second Pipeline', color: 'text-cyan-600 dark:text-cyan-400', borderTop: 'border-t-4 border-t-cyan-500' },
              { val: '100%', label: 'TreeSHAP Coverage', desc: 'Every Alert Explained', color: 'text-emerald-600 dark:text-emerald-400', borderTop: 'border-t-4 border-t-emerald-500' },
              { val: '14+', label: 'MITRE ATT&CK', desc: 'Tactics Auto-Mapped', color: 'text-amber-600 dark:text-amber-400', borderTop: 'border-t-4 border-t-amber-500' },
            ].map((metric, i) => (
              <div
                key={i}
                className={`text-center p-8 sm:p-10 rounded-2xl border transition-all duration-300 hover:-translate-y-1.5 flex flex-col items-center justify-center ${cardBg} ${metric.borderTop} hover:border-amber-500/50`}
              >
                <div className={`text-3xl sm:text-5xl font-black font-mono mb-3 ${metric.color}`}>
                  {metric.val}
                </div>
                <div className={`text-sm sm:text-base font-bold mb-2 ${textHeading}`}>{metric.label}</div>
                <div className={`text-xs font-mono ${textMuted}`}>{metric.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━━ GENEROUS PHYSICAL SPACING BEFORE SYSTEM ARCHITECTURE ━━━━━━━━ */}
      <div className="h-16 sm:h-28 w-full" />

      {/* ━━━━ SYSTEM ARCHITECTURE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className={`${bgSectionAlt} border-b ${borderCol} pt-28 pb-36 sm:pt-36 sm:pb-48 transition-colors duration-300`}>
        <div className="landing-container flex flex-col items-center">
          {/* Centered Section Header */}
          <div className="text-center max-w-2xl mx-auto">
            <span
              className={`text-xs font-mono font-bold uppercase tracking-widest flex items-center justify-center gap-2 ${isLight ? 'text-amber-700' : 'text-amber-400'
                }`}
            >
              <Sparkles size={14} />
              SYSTEM ARCHITECTURE
            </span>
            <div className="h-4" />
            <h2 className={`text-2xl sm:text-4xl font-black tracking-tight ${textHeading}`}>
              Three Stages from Raw NetFlow to Root Cause
            </h2>
            <div className="h-5" />
            <p className={`text-sm sm:text-base leading-relaxed ${textMuted}`}>
              Deterministic, transparent pipeline built for high-throughput enterprise network fabrics.
            </p>
          </div>

          {/* Explicit Physical Spacer between Header and Architecture Cards */}
          <div className="h-16 sm:h-20" />

          {/* Centered Architecture Cards Grid */}
          <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10">
            {[
              {
                step: '01',
                title: 'Telemetry Ingestion',
                tag: '78 Statistical Metrics',
                desc: 'Extract packet length deviance, inter-arrival times, flag saturation ratios, and payload entropy from live NetFlow & PCAP streams.',
                icon: Activity,
                color: 'text-amber-600 dark:text-amber-400',
                borderCol: 'border-amber-500/40',
              },
              {
                step: '02',
                title: 'Tri-Ensemble Inference',
                tag: 'RF + XGBoost + IsoForest',
                desc: 'Parallel supervised and unsupervised classifiers partition benign operational traffic from zero-day anomaly vectors.',
                icon: Cpu,
                color: 'text-cyan-600 dark:text-cyan-400',
                borderCol: 'border-cyan-500/40',
              },
              {
                step: '03',
                title: 'TreeSHAP Attribution',
                tag: 'Exact Shapley Values',
                desc: 'Decomposes predictions into exact per-feature contributions, mapping root-cause features directly to MITRE ATT&CK techniques.',
                icon: Eye,
                color: 'text-emerald-600 dark:text-emerald-400',
                borderCol: 'border-emerald-500/40',
              },
            ].map((stage, i) => {
              const Icon = stage.icon;
              return (
                <div
                  key={i}
                  className={`p-8 sm:p-10 rounded-3xl border-2 ${cardBg} hover:border-amber-500 hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-7">
                      <div
                        className={`w-13 h-13 rounded-2xl border-2 ${stage.borderCol} flex items-center justify-center ${stage.color} ${isLight ? 'bg-slate-100' : 'bg-slate-800'
                          }`}
                      >
                        <Icon size={24} strokeWidth={2.2} />
                      </div>
                      <span className={`text-xs font-mono font-black px-3 py-1 rounded-full border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700'} ${textMuted}`}>
                        STAGE {stage.step}
                      </span>
                    </div>

                    <span className="text-xs font-mono text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider block mb-2.5">
                      {stage.tag}
                    </span>
                    <h3 className={`text-lg sm:text-xl font-black tracking-tight leading-snug mb-3.5 ${textHeading}`}>
                      {stage.title}
                    </h3>
                    <p className={`text-xs sm:text-sm leading-relaxed ${textBody}`}>
                      {stage.desc}
                    </p>
                  </div>

                  <div className={`mt-10 pt-5 border-t ${borderCol} flex items-center justify-between text-xs font-mono font-bold ${textMuted}`}>
                    <span>Phase {i + 1} of 3</span>
                    <ChevronRight size={16} className={stage.color} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ━━━━ GENEROUS PHYSICAL SPACING BEFORE ENTERPRISE SOC READY ━━━━━━━ */}
      <div className="h-16 sm:h-28 w-full" />

      {/* ━━━━ ENTERPRISE SOC READY (Centered & Generously Spaced) ━━━━━━━━━ */}
      <section className={`${bgMain} pt-24 pb-32 sm:pt-36 sm:pb-44 transition-colors duration-300`}>
        <div className="landing-container flex justify-center">
          <div className="w-full max-w-3xl relative">
            {/* Ambient Radial Glow */}
            <div
              className={`absolute -top-20 left-1/2 -translate-x-1/2 w-88 h-44 blur-[120px] pointer-events-none rounded-full animate-pulse-glow ${isLight ? 'bg-amber-300/[0.22]' : 'bg-amber-500/[0.14]'
                }`}
            />

            {/* Content Container */}
            <div
              className={`relative rounded-3xl border-2 px-8 sm:px-16 py-18 sm:py-24 flex flex-col items-center text-center ${isLight
                  ? 'bg-white border-amber-300 shadow-2xl'
                  : 'bg-slate-900/90 border-amber-500/30 shadow-[0_0_50px_rgba(245,183,0,0.12)]'
                }`}
            >
              {/* Badge */}
              <div
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-mono font-bold tracking-widest uppercase ${isLight
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  }`}
              >
                <Lock size={13} />
                <span>ENTERPRISE SOC READY</span>
              </div>

              <div className="h-6 sm:h-7" />

              {/* Centered Heading */}
              <h3 className={`text-2xl sm:text-4xl font-black tracking-tight max-w-xl mx-auto leading-tight ${textHeading}`}>
                Explore Your Explainable Threat Intelligence Console
              </h3>

              <div className="h-5" />

              {/* Centered Subtitle */}
              <p className={`text-sm sm:text-base max-w-lg mx-auto leading-relaxed ${textBody}`}>
                Live telemetry monitoring, MITRE ATT&amp;CK heatmaps, TreeSHAP explainability waterfalls,
                and dataset benchmark replays — unified in one deterministic interface.
              </p>

              <div className="h-10 sm:h-12" />

              {/* Rounded, Roomy Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full max-w-md mx-auto">
                <Button
                  variant="primary"
                  size="xl"
                  shape="rounded"
                  iconRight={ArrowRight}
                  onClick={() => goTo('/dashboard')}
                  className="w-full sm:w-auto h-14 px-9 text-base font-extrabold rounded-2xl shadow-[0_0_25px_rgba(245,183,0,0.35)] cursor-pointer"
                >
                  {isAuthenticated ? 'Enter Console' : 'Launch Console'}
                </Button>
                <Button
                  variant="secondary-dark"
                  size="xl"
                  shape="rounded"
                  icon={Activity}
                  onClick={() => goTo('/live-monitor')}
                  className={`w-full sm:w-auto h-14 px-8 text-base font-bold rounded-2xl border-2 ${isLight
                      ? 'bg-white text-slate-900 border-slate-300 hover:bg-slate-100 shadow-md'
                      : 'bg-slate-900/90 text-slate-100 border-slate-700 hover:border-slate-500'
                    }`}
                >
                  Live Telemetry
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━ GENEROUS PHYSICAL SPACING AFTER ENTERPRISE SOC READY ━━━━━━━━ */}
      <div className="h-16 sm:h-28 w-full" />

      {/* ━━━━ FOOTER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <footer className={`${bgSectionAlt} border-t ${borderCol} py-12 sm:py-16 transition-colors duration-300`}>
        <div className="landing-container flex flex-col sm:flex-row items-center justify-between gap-6 text-xs font-mono">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#F5B700] border border-amber-600/40 flex items-center justify-center">
              <Hexagon size={14} className="text-slate-950" strokeWidth={2.5} />
            </div>
            <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
              SentinelAI Threat Platform
            </span>
          </div>

          <span className={textMuted}>
            Explainable IDS &bull; MITRE ATT&amp;CK Matrix &bull; TreeSHAP Attribution
          </span>

          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-2 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            All Detection Engines Operational
          </span>
        </div>
      </footer>
    </div>
  );
}
