import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  Hexagon, Activity, Target,
  ArrowRight, Eye, ChevronRight, Shield,
  Cpu, Lock, Sliders, BarChart3, Sun, Moon,
  Database, AlertTriangle, Menu, X, Radio,
  ShieldCheck, Mail
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
  radarScores: number[];
  shapFeatures: ShapFeature[];
}

const SCENARIOS: Record<'ddos' | 'scan' | 'sqli' | 'normal', ThreatScenario> = {
  ddos: {
    id: 'ddos',
    label: 'SYN Flood DDoS',
    title: 'Volumetric SYN Flood Attack Detected',
    severity: 'Critical',
    mitre: 'T1498.001 - Network DoS: Direct Flood',
    anomalyScore: 0.984,
    rate: '142,800 pkts/sec',
    telemetryLog: 'FLOW_ALERT: 198.51.100.42:443 -> 10.0.0.8:any | TCP [SYN] seq_deviance=99.2% rate=142.8k_pps entropy=0.12',
    radarScores: [98, 92, 45, 88, 30, 95],
    shapFeatures: [
      { name: 'syn_flag_count', label: 'SYN Flag Saturation', rawVal: '1,420 pkts/s', shapVal: 2.45, percentage: 88 },
      { name: 'fwd_packets_s', label: 'Forward Packet Rate', rawVal: '8,920/s', shapVal: 1.82, percentage: 72 },
      { name: 'flow_duration', label: 'Flow Lifetime Dev.', rawVal: '0.002s', shapVal: 1.15, percentage: 54 },
      { name: 'packet_length_std', label: 'Packet Length Variance', rawVal: '0.04 (Homog.)', shapVal: 0.94, percentage: 42 },
    ],
  },
  scan: {
    id: 'scan',
    label: 'Port Recon Scan',
    title: 'Distributed Port Reconnaissance Scan',
    severity: 'Medium',
    mitre: 'T1046 - Network Service Discovery',
    anomalyScore: 0.742,
    rate: '12,400 pkts/sec',
    telemetryLog: 'SCAN_ALERT: 203.0.113.19 -> 10.0.0.0/24:multi-port | TCP [SYN/ACK] sweep_ratio=94.1% dst_entropy=0.98',
    radarScores: [40, 75, 82, 35, 60, 70],
    shapFeatures: [
      { name: 'dst_port_entropy', label: 'Dest Port Dispersion', rawVal: '0.98 (Max)', shapVal: 1.95, percentage: 82 },
      { name: 'flow_iat_mean', label: 'Rapid Inter-Arrival Time', rawVal: '1.2 ms', shapVal: 1.40, percentage: 65 },
      { name: 'fwd_packets_s', label: 'Multi-Host Rate', rawVal: '3,200/s', shapVal: 0.88, percentage: 45 },
      { name: 'flow_duration', label: 'Ephemeral Connection', rawVal: '0.04s', shapVal: 0.62, percentage: 32 },
    ],
  },
  sqli: {
    id: 'sqli',
    label: 'CVE / SQL Injection',
    title: 'Web Application Exploit Attempt',
    severity: 'Critical',
    mitre: 'T1190 - Exploit Public-Facing Application',
    anomalyScore: 0.912,
    rate: '840 pkts/sec',
    telemetryLog: 'EXPLOIT_ALERT: 198.51.100.77:5231 -> 10.0.0.15:80 | HTTP POST payload_entropy=0.89 pattern=\'UNION SELECT--',
    radarScores: [30, 45, 96, 70, 88, 85],
    shapFeatures: [
      { name: 'payload_entropy', label: 'Payload Shuffled Entropy', rawVal: '0.89 High', shapVal: 2.15, percentage: 84 },
      { name: 'fwd_packet_len_max', label: 'Abnormal Payload Size', rawVal: '4,096 bytes', shapVal: 1.70, percentage: 70 },
      { name: 'fwd_seg_size_avg', label: 'POST Chunk Ratio', rawVal: '1,460 bytes', shapVal: 1.10, percentage: 52 },
      { name: 'flow_duration', label: 'Session Dwell Time', rawVal: '1.82s', shapVal: 0.74, percentage: 36 },
    ],
  },
  normal: {
    id: 'normal',
    label: 'Benign Flow Baseline',
    title: 'Normal Enterprise HTTPS Flow Baseline',
    severity: 'Safe',
    mitre: 'N/A - Legitimate Enterprise Traffic',
    anomalyScore: 0.012,
    rate: '3,200 pkts/sec',
    telemetryLog: 'BASELINE_VERIFIED: 10.0.1.20:49210 -> 10.0.0.5:443 | TLS 1.3 complete_handshake ack_ratio=1.00 status=STABLE',
    radarScores: [10, 15, 8, 12, 14, 10],
    shapFeatures: [
      { name: 'syn_flag_count', label: 'SYN Handshake Parity', rawVal: '1 per flow', shapVal: -1.85, percentage: 92 },
      { name: 'fwd_packets_s', label: 'Expected HTTPS Bandwidth', rawVal: '42 pkts/s', shapVal: -1.20, percentage: 78 },
      { name: 'packet_length_std', label: 'Normal TLS Length Spread', rawVal: '340 bytes', shapVal: -0.90, percentage: 68 },
      { name: 'flow_duration', label: 'Duration Stability', rawVal: '4.8s', shapVal: -0.52, percentage: 60 },
    ],
  },
};

export type Theme = 'dark' | 'light';

// ─── Animation Variants ─────────────────────────────────────────────────────
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: 'easeOut',
    },
  },
};

// ─── Streamlined Navigation Structure ───────────────────────────────────────
const NAV_LINKS = [
  { label: 'Home', id: 'hero' },
  { label: 'Features', id: 'features' },
  { label: 'Dashboard', id: 'dashboard' },
  { label: 'How It Works', id: 'how-it-works' },
  { label: 'Contact', id: 'contact' },
];

/* ═══════════════════════════════════════════════════════════════════════════
   LANDING PAGE COMPONENT (CENTER-ALIGNED & JUSTIFIED SPACING)
   ═══════════════════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { theme, toggleTheme, isLight } = useTheme();

  // State
  const [activeKey, setActiveKey] = useState<'ddos' | 'scan' | 'sqli' | 'normal'>('ddos');
  const [packetCounter, setPacketCounter] = useState(1489240);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scenario = SCENARIOS[activeKey];
  const goTo = useCallback((path: string) => navigate(isAuthenticated ? path : '/login'), [navigate, isAuthenticated]);

  // Smooth scroll handler
  const handleNavClick = (id: string) => {
    setMobileMenuOpen(false);
    if (id === 'hero') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const element = document.getElementById(id);
    if (element) {
      const y = element.getBoundingClientRect().top + window.scrollY - 84;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // Live packet counter simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setPacketCounter((prev) => prev + Math.floor(Math.random() * 45) - 20);
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  // Theme-aware tokens
  const bgMain = isLight ? 'bg-[#F8FAFC]' : 'bg-[#020617]';
  const bgAlt = isLight ? 'bg-white' : 'bg-[#060D20]';
  const bgCard = isLight ? 'bg-white' : 'bg-[#0B132B]/70';
  const borderCol = isLight ? 'border-slate-200' : 'border-slate-800/80';
  const textHeading = isLight ? 'text-slate-900' : 'text-slate-100';
  const textBody = isLight ? 'text-slate-700' : 'text-slate-300';
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400';
  const navBg = isLight ? 'bg-white/90 border-slate-200' : 'bg-[#020617]/90 border-slate-800/80';

  return (
    <div
      data-theme={theme}
      className={`w-full min-h-screen ${bgMain} ${textHeading} font-sans selection:bg-amber-400 selection:text-slate-950 block transition-colors duration-200`}
    >
      {/* ━━━━ STICKY ENTERPRISE NAVBAR (COMPACT & BALANCED) ━━━━━━━━━━━━━━━━━ */}
      <header className={`w-full ${navBg} backdrop-blur-xl sticky top-0 z-50 border-b transition-colors duration-200`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          {/* Brand Logo */}
          <div
            className="flex items-center gap-2.5 cursor-pointer group flex-shrink-0 mr-2 sm:mr-4"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-lg bg-[#F5B700] border border-amber-600/40 flex items-center justify-center group-hover:scale-105 transition-transform shadow-[0_0_15px_rgba(245,183,0,0.35)]">
                <Hexagon size={17} className="text-slate-950 fill-slate-950/20" strokeWidth={2.5} />
              </div>
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 border-2 border-[#020617] animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className={`text-base font-black tracking-tight leading-none ${isLight ? 'text-slate-900' : 'text-white'}`}>
                SentinelAI
              </span>
              <span className={`text-[9px] font-mono font-bold tracking-wider uppercase mt-0.5 ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                Enterprise SOC
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links (Properly Spaced & Centered) */}
          <nav className="hidden lg:flex items-center justify-center gap-5 xl:gap-8 text-xs font-bold uppercase tracking-wider flex-shrink-0">
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                onClick={() => handleNavClick(link.id)}
                className={`transition-colors cursor-pointer px-2 py-1 rounded-md ${
                  isLight ? 'text-slate-600 hover:text-slate-950 hover:bg-slate-100' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0">
            {/* Live Packet Counter Pill (Compact & on xl screens) */}
            <div
              className={`hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-mono font-semibold ${
                isLight ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-slate-900 border-slate-800 text-slate-300'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>LIVE:</span>
              <span className="text-amber-500 font-bold tabular-nums">
                {packetCounter.toLocaleString()}
              </span>
              <span className="text-[9px] text-slate-400">pkts/s</span>
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

            {/* Desktop CTAs */}
            <div className="hidden sm:flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                shape="rounded"
                onClick={() => navigate('/login')}
                className={`h-9 px-3 rounded-lg text-xs font-bold ${
                  isLight ? 'text-slate-700 hover:text-slate-950 hover:bg-slate-200/60' : 'text-slate-300 hover:text-white'
                }`}
              >
                Sign In
              </Button>
              <Button
                variant="primary"
                size="sm"
                shape="rounded"
                iconRight={ArrowRight}
                onClick={() => goTo('/dashboard')}
                className="font-bold px-4 h-9 rounded-lg text-xs shadow-md cursor-pointer"
              >
                Launch Console
              </Button>
            </div>

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`p-1.5 rounded-lg border lg:hidden cursor-pointer ${
                isLight ? 'bg-slate-100 border-slate-300 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-200'
              }`}
              aria-label="Toggle navigation drawer"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={`lg:hidden px-6 py-6 border-b ${borderCol} ${bgMain}`}
            >
              <nav className="flex flex-col gap-4 text-center">
                {NAV_LINKS.map((link) => (
                  <button
                    key={link.id}
                    onClick={() => handleNavClick(link.id)}
                    className={`text-sm font-bold uppercase tracking-wider py-1.5 transition-colors ${
                      isLight ? 'text-slate-700 hover:text-slate-950' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {link.label}
                  </button>
                ))}
              </nav>
              <div className={`mt-6 pt-5 border-t ${borderCol} flex flex-col gap-3`}>
                <Button
                  variant="primary"
                  size="lg"
                  shape="rounded"
                  iconRight={ArrowRight}
                  onClick={() => goTo('/dashboard')}
                  className="w-full font-bold h-12"
                >
                  Launch Console
                </Button>
                <Button
                  variant="secondary-dark"
                  size="lg"
                  shape="rounded"
                  onClick={() => navigate('/login')}
                  className="w-full font-bold h-12"
                >
                  Sign In
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ━━━━ 1. HERO SECTION (CENTER-ALIGNED) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id="hero" className={`w-full block relative overflow-hidden py-16 md:py-20 lg:py-24 border-b ${borderCol} cyber-grid-bg transition-colors duration-200`}>
        {/* Strictly contained interactive network canvas */}
        <ThreatCanvas threatLevel={scenario.severity} className={theme === 'dark' ? 'opacity-40' : 'opacity-25'} />

        {/* Subtle Ambient Radial Glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className={`absolute top-[-10%] left-1/2 -translate-x-1/2 w-[680px] h-[340px] rounded-full blur-[140px] pointer-events-none ${
              isLight ? 'bg-amber-300/[0.18]' : 'bg-amber-500/[0.10]'
            }`}
          />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center text-center">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-center justify-center max-w-3xl mx-auto text-center"
          >
            {/* Eyebrow Pill */}
            <motion.div
              variants={itemVariants}
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-mono font-bold tracking-widest uppercase mb-6 shadow-sm ${
                isLight
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-[0_0_20px_rgba(245,183,0,0.15)]'
              }`}
            >
              <Shield size={13} className="text-amber-500" />
              <span>EXPLAINABLE AI THREAT DETECTION |  ENTERPRISE SOC</span>
            </motion.div>

            {/* Clear Value Headline */}
            <motion.h1
              variants={itemVariants}
              className={`text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight mb-6 text-center ${textHeading}`}
            >
              Autonomous Threat Detection{' '}
              <span className="animate-shimmer-text block sm:inline">with Explainable AI</span>
            </motion.h1>

            {/* Concise Subheadline */}
            <motion.p
              variants={itemVariants}
              className={`max-w-xl mx-auto text-base sm:text-lg leading-relaxed mb-10 text-center ${textBody}`}
            >
              Real-time network anomaly detection powered by tri-ensemble machine learning and instant mathematical TreeSHAP root-cause attribution.
            </motion.p>

            {/* Maximum 2 CTAs */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5 w-full max-w-md mx-auto"
            >
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full sm:w-auto">
                <Button
                  variant="primary"
                  size="xl"
                  shape="rounded"
                  iconRight={ArrowRight}
                  onClick={() => goTo('/dashboard')}
                  className="w-full sm:w-auto h-13 px-8 text-base font-extrabold rounded-2xl shadow-[0_0_25px_rgba(245,183,0,0.35)] cursor-pointer"
                >
                  Launch SOC Console
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full sm:w-auto">
                <Button
                  variant="secondary-dark"
                  size="xl"
                  shape="rounded"
                  icon={Activity}
                  onClick={() => goTo('/live-monitor')}
                  className={`w-full sm:w-auto h-13 px-8 text-base font-bold rounded-2xl border-2 ${
                    isLight
                      ? 'bg-white text-slate-900 border-slate-300 hover:bg-slate-100 shadow-md'
                      : 'bg-slate-900/90 text-slate-100 border-slate-700 hover:border-slate-500 shadow-lg'
                  }`}
                >
                  Live Threat Monitor
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ━━━━ 2. FEATURES SECTION (CENTER-ALIGNED) ━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id="features" className={`w-full block relative overflow-hidden py-20 md:py-28 lg:py-32 border-b ${borderCol} ${bgAlt} transition-colors duration-200`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="max-w-3xl mx-auto text-center mb-12 md:mb-16"
          >
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-mono font-bold tracking-widest uppercase mb-4 ${
                isLight ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}
            >
              <Shield size={14} />
              <span>CORE CAPABILITIES</span>
            </div>
            <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4 ${textHeading}`}>
              Engineered for Zero-Trust Enterprise SOCs
            </h2>
            <p className={`text-base sm:text-lg leading-relaxed ${textMuted}`}>
              Three core pillars delivering real-time anomaly detection, mathematically verified explainability, and automated incident containment.
            </p>
          </motion.div>

          {/* Symmetrical 3-Card Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {[
              {
                icon: Cpu,
                color: 'text-amber-500',
                borderHover: 'hover:border-amber-500/40',
                title: 'Tri-Ensemble Machine Learning',
                desc: 'Consensus voting combining Random Forest, XGBoost, and Isolation Forest to detect known signatures and novel zero-day anomalies.',
                tag: 'Supervised + Unsupervised',
              },
              {
                icon: Eye,
                color: 'text-cyan-500',
                borderHover: 'hover:border-cyan-500/40',
                title: 'Instant TreeSHAP Explainability',
                desc: 'Exact cooperative game-theory Shapley values isolate the packet features responsible for each alert in less than 5 milliseconds.',
                tag: 'Mathematical Verifiability',
              },
              {
                icon: Target,
                color: 'text-emerald-500',
                borderHover: 'hover:border-emerald-500/40',
                title: 'Autonomous SOC Orchestration',
                desc: 'Direct MITRE ATT&CK correlation with automated firewall isolation rules, BGP Flowspec route adjustments, and SIEM dispatch.',
                tag: 'Zero-Touch Containment',
              },
            ].map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.45, delay: i * 0.1, ease: 'easeOut' }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className={`p-7 sm:p-8 rounded-2xl border transition-all duration-300 flex flex-col items-center text-center justify-between ${bgCard} ${borderCol} ${feature.borderHover} shadow-md`}
                >
                  <div className="flex flex-col items-center text-center w-full">
                    <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center ${feature.color} ${
                      isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-800/80 border-slate-700'
                    } mb-5 shadow-sm`}>
                      <Icon size={26} strokeWidth={2.2} />
                    </div>

                    <span className={`inline-block text-[10px] font-mono font-bold px-3 py-1 rounded-full border uppercase mb-3 ${
                      isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}>
                      {feature.tag}
                    </span>

                    <h3 className={`text-lg font-bold tracking-tight mb-2 ${textHeading}`}>
                      {feature.title}
                    </h3>
                    <p className={`text-sm leading-relaxed max-w-xs mx-auto ${textBody}`}>
                      {feature.desc}
                    </p>
                  </div>

                  <div className={`mt-6 pt-4 border-t ${borderCol} flex items-center justify-center gap-1.5 text-xs font-mono font-bold w-full ${textMuted}`}>
                    <span>Operational Metric</span>
                    <ChevronRight size={14} className={feature.color} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ━━━━ 3. INTERACTIVE THREAT INSPECTOR (CLEAN UNIFIED DASHBOARD) ━━━ */}
      <section id="threat-inspector" className={`w-full block relative overflow-hidden py-20 md:py-28 lg:py-32 border-b ${borderCol} ${bgMain} transition-colors duration-200`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="max-w-3xl mx-auto text-center mb-12 md:mb-16"
          >
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-mono font-bold tracking-widest uppercase mb-4 ${
                isLight ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}
            >
              <Sliders size={14} />
              <span>LIVE TELEMETRY INSPECTOR</span>
            </div>
            <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4 ${textHeading}`}>
              Inspect Vectors &amp; Feature Attribution
            </h2>
            <p className={`text-base sm:text-lg leading-relaxed ${textMuted}`}>
              Select an attack vector below to inspect autonomous AI verdicts, 360° radar sweeps, and per-feature Shapley value contributions.
            </p>
          </motion.div>

          {/* Unified Console Container (Clean 50/50, No Colliding Boxes) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`rounded-2xl border ${borderCol} ${bgCard} shadow-xl overflow-hidden`}
          >
            {/* Centered Scenario Tab Bar */}
            <div className={`p-4 sm:p-5 border-b ${borderCol} flex flex-col sm:flex-row items-center justify-between gap-3 ${isLight ? 'bg-slate-100/60' : 'bg-slate-900/60'}`}>
              <div className="flex flex-wrap items-center justify-center gap-2 mx-auto sm:mx-0">
                {(['ddos', 'scan', 'sqli', 'normal'] as const).map((key) => {
                  const s = SCENARIOS[key];
                  const isActive = activeKey === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveKey(key)}
                      className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#F5B700] text-slate-950 shadow-md'
                          : isLight
                          ? 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-300'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-mono font-bold flex-shrink-0 mx-auto sm:mx-0">
                <span className={`w-2 h-2 rounded-full ${scenario.severity === 'Critical' ? 'bg-rose-500 animate-pulse' : scenario.severity === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                <span className={scenario.severity === 'Critical' ? 'text-rose-500' : scenario.severity === 'Medium' ? 'text-amber-500' : 'text-emerald-500'}>
                  {scenario.severity.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Symmetrical 50/50 Body */}
            <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
              
              {/* Left Column: 360° Radar & Ingest Telemetry */}
              <div className="flex flex-col items-center justify-between p-5 sm:p-6 rounded-xl border border-slate-800/60 bg-slate-950/40 text-center">
                <div className="w-full flex flex-col items-center">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-500 mb-4">
                    360° Attack Geometry
                  </span>
                  <ThreatRadar threatType={scenario.id} theme={theme} className="w-full" />
                </div>
                
                <div className="mt-6 w-full pt-3 border-t border-slate-800 text-xs font-mono space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={textMuted}>Inference Consensus:</span>
                    <span className="font-bold text-amber-500">{(scenario.anomalyScore * 100).toFixed(1)}% Confidence</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={textMuted}>MITRE ATT&amp;CK:</span>
                    <span className="font-bold text-cyan-400">{scenario.mitre}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={textMuted}>Telemetry Ingest:</span>
                    <span className="font-bold text-slate-200">{scenario.rate}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: TreeSHAP Feature Attribution */}
              <div className="flex flex-col justify-between p-5 sm:p-6 rounded-xl border border-slate-800/60 bg-slate-950/40">
                <div>
                  {/* Raw Packet Log */}
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto mb-4">
                    {scenario.telemetryLog}
                  </div>

                  {/* Compact TreeSHAP Feature Bars */}
                  <ShapWaterfall
                    features={scenario.shapFeatures}
                    anomalyScore={scenario.anomalyScore}
                    theme={theme}
                  />
                </div>

                {/* Mitigation Action Button */}
                <div className={`mt-5 pt-3 border-t ${borderCol} flex flex-col sm:flex-row items-center justify-between gap-3`}>
                  <div className="text-xs font-mono text-slate-400">
                    Status: <span className="text-amber-500 font-bold">{(scenario.anomalyScore * 100).toFixed(1)}% anomaly</span>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    shape="rounded"
                    iconRight={ArrowRight}
                    onClick={() => goTo('/dashboard')}
                    className="font-bold px-5 h-9 rounded-lg shadow-md cursor-pointer w-full sm:w-auto text-xs"
                  >
                    Mitigate in SOC Console
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ━━━━ 4. HOW IT WORKS (CENTER-ALIGNED) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id="how-it-works" className={`w-full block relative overflow-hidden py-20 md:py-28 lg:py-32 border-b ${borderCol} ${bgAlt} transition-colors duration-200`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="max-w-3xl mx-auto text-center mb-12 md:mb-16"
          >
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-mono font-bold tracking-widest uppercase mb-4 ${
                isLight ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}
            >
              <Radio size={14} />
              <span>HOW IT WORKS</span>
            </div>
            <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4 ${textHeading}`}>
              From Raw Packets to Explainable Defense
            </h2>
            <p className={`text-base sm:text-lg leading-relaxed ${textMuted}`}>
              A deterministic, sub-42 millisecond pipeline that transforms network noise into verified security action.
            </p>
          </motion.div>

          {/* 3 Sequential Architecture Stages */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {[
              {
                step: '01',
                title: 'High-Speed Ingestion',
                tag: '78 Statistical Metrics',
                desc: 'Real-time eBPF & NetFlow stream parsing extracts packet length variance, flag saturation, and payload entropy with zero packet drops.',
                icon: Activity,
                color: 'text-amber-500',
              },
              {
                step: '02',
                title: 'Tri-Ensemble Inference',
                tag: 'RF + XGBoost + IsoForest',
                desc: 'Parallel supervised and unsupervised models evaluate flow vectors concurrently to isolate known threats and novel zero-day anomalies.',
                icon: Cpu,
                color: 'text-cyan-500',
              },
              {
                step: '03',
                title: 'TreeSHAP Attribution',
                tag: 'Exact Shapley Weights',
                desc: 'Mathematical decomposition isolates the exact flow features driving the alert, mapping directly to MITRE ATT&CK techniques in <5ms.',
                icon: Eye,
                color: 'text-emerald-500',
              },
            ].map((stage, i) => {
              const Icon = stage.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.45, delay: i * 0.1, ease: 'easeOut' }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className={`p-7 sm:p-8 rounded-2xl border transition-all duration-300 flex flex-col items-center text-center justify-between ${bgCard} ${borderCol} shadow-md`}
                >
                  <div className="flex flex-col items-center text-center w-full">
                    <span className={`inline-block text-xs font-mono font-black px-3 py-1 rounded-full border mb-5 ${
                      isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}>
                      STAGE {stage.step}
                    </span>

                    <div className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center ${stage.color} ${
                      isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700'
                    } mb-5 shadow-sm`}>
                      <Icon size={26} strokeWidth={2.2} />
                    </div>

                    <span className="text-xs font-mono text-amber-500 font-bold uppercase tracking-wider block mb-2">
                      {stage.tag}
                    </span>
                    <h3 className={`text-lg font-black tracking-tight mb-2 ${textHeading}`}>
                      {stage.title}
                    </h3>
                    <p className={`text-sm leading-relaxed max-w-xs mx-auto ${textBody}`}>
                      {stage.desc}
                    </p>
                  </div>

                  <div className={`mt-6 pt-4 border-t ${borderCol} flex items-center justify-center gap-1.5 text-xs font-mono font-bold w-full ${textMuted}`}>
                    <span>Phase {i + 1} of 3</span>
                    <ChevronRight size={14} className={stage.color} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ━━━━ 5. DASHBOARD SPOTLIGHT (CENTER-ALIGNED) ━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id="dashboard" className={`w-full block relative overflow-hidden py-20 md:py-28 lg:py-32 border-b ${borderCol} ${bgMain} transition-colors duration-200`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="max-w-3xl mx-auto text-center mb-12 md:mb-16"
          >
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-mono font-bold tracking-widest uppercase mb-4 ${
                isLight ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}
            >
              <Radio size={14} />
              <span>SOC WORKSPACE</span>
            </div>
            <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4 ${textHeading}`}>
              Unified Security Operations Console
            </h2>
            <p className={`text-base sm:text-lg leading-relaxed ${textMuted}`}>
              Real-time packet visualization, MITRE ATT&amp;CK navigation, and deep alert investigation in one command center.
            </p>
          </motion.div>

          {/* 4 Feature Pillars Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 sm:mb-16">
            {[
              {
                icon: Activity,
                title: 'Live Telemetry Stream',
                desc: 'Real-time packet visualization displaying flow rates, protocol ratios, and network anomalies.',
                path: '/live-monitor',
              },
              {
                icon: Target,
                title: 'MITRE ATT&CK Matrix',
                desc: 'Interactive enterprise matrix mapping detected anomalies into tactical techniques.',
                path: '/mitre',
              },
              {
                icon: AlertTriangle,
                title: 'Deep Alert Triage',
                desc: 'Investigate alerts with feature-by-feature Shapley score breakdowns and root causes.',
                path: '/alerts',
              },
              {
                icon: Database,
                title: 'Dataset Replay Lab',
                desc: 'Replay raw CIC-IDS2017 & NSL-KDD benchmark flows to stress test inference accuracy.',
                path: '/datasets',
              },
            ].map((card, i) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.45, delay: i * 0.08 }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  onClick={() => goTo(card.path)}
                  className={`p-6 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col items-center text-center justify-between ${bgCard} ${borderCol} hover:border-amber-500/50 shadow-md`}
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-5">
                      <Icon size={22} />
                    </div>
                    <h3 className={`text-base font-bold mb-2 ${textHeading}`}>
                      {card.title}
                    </h3>
                    <p className={`text-xs sm:text-sm leading-relaxed ${textBody}`}>
                      {card.desc}
                    </p>
                  </div>
                  <div className="mt-5 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-center gap-1.5 text-xs font-mono font-bold text-amber-500 w-full">
                    <span>Open Module</span>
                    <ArrowRight size={13} />
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Centered Console Launch CTA */}
          <div className="flex justify-center mt-6 sm:mt-8">
            <Button
              variant="primary"
              size="lg"
              shape="rounded"
              iconRight={ArrowRight}
              onClick={() => goTo('/dashboard')}
              className="px-8 font-bold h-12 rounded-xl shadow-lg cursor-pointer"
            >
              Enter Full SOC Console
            </Button>
          </div>
        </div>
      </section>

      {/* ━━━━ 6. EMPIRICAL BENCHMARKS (JUSTIFIED SPACING) ━━━━━━━━━━━━━━━━━━ */}
      <section id="benchmarks" className={`w-full block relative overflow-hidden py-20 md:py-28 lg:py-32 border-b ${borderCol} ${bgAlt} transition-colors duration-200`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="max-w-3xl mx-auto text-center mb-12 md:mb-16"
          >
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-mono font-bold tracking-widest uppercase mb-4 ${
                isLight ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}
            >
              <BarChart3 size={14} />
              <span>EMPIRICAL BENCHMARKS</span>
            </div>
            <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4 ${textHeading}`}>
              Validated on Enterprise Industry Datasets
            </h2>
            <p className={`text-base sm:text-lg leading-relaxed ${textMuted}`}>
              Evaluated rigorously against the CIC-IDS2017 &amp; NSL-KDD cybersecurity benchmarks with zero explainability lag.
            </p>
          </motion.div>

          {/* 4 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 sm:mb-16">
            {[
              { val: '99.4%', label: 'Ensemble Precision', desc: 'CIC-IDS2017 Benchmark', color: 'text-amber-500', borderTop: 'border-t-4 border-t-amber-500' },
              { val: '<42ms', label: 'Inference Latency', desc: 'Real-Time Pipeline', color: 'text-cyan-500', borderTop: 'border-t-4 border-t-cyan-500' },
              { val: '100%', label: 'TreeSHAP Coverage', desc: 'Every Alert Attributed', color: 'text-emerald-500', borderTop: 'border-t-4 border-t-emerald-500' },
              { val: '87%', label: 'False Positive Cut', desc: 'Noise Reduction vs Legacy', color: 'text-amber-500', borderTop: 'border-t-4 border-t-amber-500' },
            ].map((metric, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                whileHover={{ y: -3 }}
                className={`text-center p-6 rounded-2xl border transition-all duration-300 ${bgCard} ${borderCol} ${metric.borderTop} shadow-md`}
              >
                <div className={`text-3xl sm:text-4xl font-black font-mono mb-2 ${metric.color}`}>
                  {metric.val}
                </div>
                <div className={`text-sm font-bold mb-1 ${textHeading}`}>{metric.label}</div>
                <div className={`text-xs font-mono ${textMuted}`}>{metric.desc}</div>
              </motion.div>
            ))}
          </div>

          {/* Trust Badges Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center pt-2">
            {[
              { title: 'SOC 2 Type II', subtitle: 'Security & Availability Audit' },
              { title: 'ISO/IEC 27001', subtitle: 'Information Security Management' },
              { title: 'NIST CSF', subtitle: 'Cybersecurity Framework Ready' },
              { title: 'HIPAA & GDPR', subtitle: 'Zero Telemetry Data Leakage' },
            ].map((badge, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                whileHover={{ y: -3 }}
                className={`p-5 rounded-2xl border ${borderCol} ${bgCard} flex flex-col items-center justify-center shadow-sm`}
              >
                <ShieldCheck size={26} className="text-amber-500 mb-2" />
                <strong className={`text-sm font-mono font-bold ${textHeading}`}>{badge.title}</strong>
                <span className={`text-[11px] font-mono mt-1 ${textMuted}`}>{badge.subtitle}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━━ 7. CONTACT & CLOSING CTA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id="contact" className={`w-full block relative overflow-hidden py-20 md:py-28 lg:py-32 border-b ${borderCol} ${bgMain} transition-colors duration-200`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl mx-auto relative"
          >
            {/* Ambient Glow */}
            <div
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[220px] blur-[120px] pointer-events-none rounded-full ${
                isLight ? 'bg-amber-300/[0.22]' : 'bg-amber-500/[0.10]'
              }`}
            />

            {/* Container Card */}
            <div
              className={`relative rounded-3xl border-2 px-6 sm:px-14 py-12 sm:py-16 flex flex-col items-center text-center ${
                isLight
                  ? 'bg-white border-amber-300 shadow-xl'
                  : 'bg-slate-900/90 border-amber-500/30 shadow-[0_0_40px_rgba(245,183,0,0.10)]'
              }`}
            >
              <div
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-mono font-bold tracking-widest uppercase mb-6 ${
                  isLight
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                }`}
              >
                <Lock size={13} />
                <span>ENTERPRISE SOC READY</span>
              </div>

              <h2 className={`text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight max-w-2xl mx-auto leading-tight mb-5 text-center ${textHeading}`}>
                Ready to Eliminate Black-Box AI Doubt from Your SOC?
              </h2>

              <p className={`text-sm sm:text-base max-w-xl mx-auto leading-relaxed mb-8 text-center ${textBody}`}>
                Deploy SentinelAI for real-time anomaly detection, automated MITRE ATT&amp;CK correlation, and verified TreeSHAP attribution.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md mx-auto">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full sm:w-auto">
                  <Button
                    variant="primary"
                    size="lg"
                    shape="rounded"
                    iconRight={ArrowRight}
                    onClick={() => goTo('/dashboard')}
                    className="w-full sm:w-auto h-12 px-8 text-sm font-extrabold rounded-xl shadow-md cursor-pointer"
                  >
                    Launch SOC Console
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full sm:w-auto">
                  <Button
                    variant="secondary-dark"
                    size="lg"
                    shape="rounded"
                    icon={Mail}
                    onClick={() => {
                      window.location.href = 'mailto:contact@sentinelai.security?subject=Enterprise%20SOC%20Inquiry';
                    }}
                    className={`w-full sm:w-auto h-12 px-7 text-sm font-bold rounded-xl border-2 ${
                      isLight
                        ? 'bg-white text-slate-900 border-slate-300 hover:bg-slate-100 shadow-sm'
                        : 'bg-slate-900/90 text-slate-100 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    Contact Security Team
                  </Button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ━━━━ 8. ULTRA-COMPACT ENTERPRISE FOOTER ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <footer className={`w-full block border-t ${borderCol} ${bgMain} py-6 sm:py-7 transition-colors duration-200`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono">
            
            {/* Left: Brand + Status Pill + Copyright */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-[#F5B700] flex items-center justify-center shadow-xs">
                  <Hexagon size={13} className="text-slate-950" strokeWidth={2.5} />
                </div>
                <span className={`font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  SentinelAI
                </span>
              </div>

              <span className={`hidden sm:inline text-slate-300 dark:text-slate-700`}>•</span>

              <div className="flex items-center gap-1.5 text-emerald-500 font-semibold text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Systems Operational</span>
              </div>

              <span className={`hidden sm:inline text-slate-300 dark:text-slate-700`}>•</span>

              <span className={textMuted}>
                &copy; {new Date().getFullYear()} SentinelAI Inc.
              </span>
            </div>

            {/* Right: Sleek Inline Horizontal Links */}
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs">
              <button onClick={() => goTo('/dashboard')} className={`hover:text-amber-500 transition-colors cursor-pointer ${textMuted}`}>
                Console
              </button>
              <button onClick={() => goTo('/live-monitor')} className={`hover:text-amber-500 transition-colors cursor-pointer ${textMuted}`}>
                Monitor
              </button>
              <button onClick={() => goTo('/mitre')} className={`hover:text-amber-500 transition-colors cursor-pointer ${textMuted}`}>
                MITRE
              </button>
              <button onClick={() => goTo('/datasets')} className={`hover:text-amber-500 transition-colors cursor-pointer ${textMuted}`}>
                Datasets
              </button>
              <span className={`${textMuted} hover:text-amber-500 cursor-pointer`}>
                Privacy
              </span>
              <span className={`${textMuted} hover:text-amber-500 cursor-pointer`}>
                Terms
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
