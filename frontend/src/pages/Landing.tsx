import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Hexagon, Activity, Search, Brain, Target,
  ArrowRight, Menu, X, Users, FileText, CheckCircle2,
  AlertTriangle, Terminal, ChevronDown, ChevronUp,
  Layers, RefreshCw, BarChart2, Eye,
  ShieldCheck, Server, Key
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// ─── Telemetry Visualizer Scenarios (Truthful Product UI Representation) ─────
interface ThreatScenario {
  id: string;
  name: string;
  type: string;
  status: 'Critical' | 'High' | 'Medium' | 'Safe';
  mitreTactic: string;
  mitreId: string;
  features: { name: string; level: 'High' | 'Elevated' | 'Normal'; description: string }[];
  recommendedAction: string;
}

const THREAT_SCENARIOS: Record<string, ThreatScenario> = {
  dos: {
    id: 'dos',
    name: 'SYN Flood DDoS Attack',
    type: 'Denial of Service',
    status: 'Critical',
    mitreTactic: 'Impact',
    mitreId: 'T1498.001',
    features: [
      { name: 'Connection Rate', level: 'High', description: 'Abnormal connection frequency to single target' },
      { name: 'SYN Error Rate', level: 'High', description: 'Incomplete TCP handshakes observed' },
      { name: 'Destination Variance', level: 'Elevated', description: 'Target port repetition' },
      { name: 'Payload Byte Ratio', level: 'Normal', description: 'Header-only packet distribution' },
    ],
    recommendedAction: 'Apply rate-limiting on ingress firewall & trigger automated IP null-routing.',
  },
  exfil: {
    id: 'exfil',
    name: 'Automated Data Exfiltration',
    type: 'Data Exfiltration',
    status: 'High',
    mitreTactic: 'Exfiltration',
    mitreId: 'T1020',
    features: [
      { name: 'Outbound Byte Volume', level: 'High', description: 'Egress payload above historical baseline' },
      { name: 'Session Duration', level: 'Elevated', description: 'Persistent encrypted egress session' },
      { name: 'Protocol Entropy', level: 'Elevated', description: 'High entropy DNS query patterns' },
      { name: 'Destination Count', level: 'Normal', description: 'Single external egress endpoint' },
    ],
    recommendedAction: 'Isolate host host-104-sec and revoke active session tokens.',
  },
  probe: {
    id: 'probe',
    name: 'Nmap Stealth Port Scan',
    type: 'Reconnaissance',
    status: 'Medium',
    mitreTactic: 'Reconnaissance',
    mitreId: 'T1046',
    features: [
      { name: 'Port Diversity Rate', level: 'High', description: 'Sequential probe across multiple ports' },
      { name: 'Rejection Flag Ratio', level: 'Elevated', description: 'Elevated connection rejections' },
      { name: 'Session Duration', level: 'Normal', description: 'Transient connection attempts' },
      { name: 'TCP Header Flags', level: 'Elevated', description: 'Non-standard flag combinations' },
    ],
    recommendedAction: 'Block source subnet 192.168.1.105/24 at edge router.',
  },
  normal: {
    id: 'normal',
    name: 'Standard HTTPS Web Flow',
    type: 'Normal Operation',
    status: 'Safe',
    mitreTactic: 'None',
    mitreId: 'N/A',
    features: [
      { name: 'TLS Handshake Rate', level: 'Normal', description: 'Standard TLS 1.3 negotiation' },
      { name: 'Payload Byte Ratio', level: 'Normal', description: 'Typical web traffic ratio' },
      { name: 'Auth Token Status', level: 'Normal', description: 'Valid session token present' },
      { name: 'Request Velocity', level: 'Normal', description: 'Traffic within expected limits' },
    ],
    recommendedAction: 'No action required. Traffic classified as benign user activity.',
  },
};

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-amber-200 selection:text-amber-900 overflow-x-hidden">
      <Navbar isAuthenticated={isAuthenticated} navigate={navigate} />
      <main>
        <HeroSection isAuthenticated={isAuthenticated} navigate={navigate} />
        <PlatformOverviewSection />
        <CapabilitiesSection />
        <HowItWorksSection />
        <ExplainableAISection />
        <MITRESection />
        <SecuritySection />
        <FAQSection />
        <FinalCTASection navigate={navigate} />
      </main>
      <Footer />
    </div>
  );
}

// ─── 1. NAVBAR ───────────────────────────────────────────────────────────────
function Navbar({ isAuthenticated, navigate }: { isAuthenticated: boolean; navigate: (path: string) => void }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    setMobileNavOpen(false);
    const element = document.getElementById(id);
    if (element) {
      const y = element.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <header 
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled 
          ? 'bg-slate-950 border-b border-slate-800 shadow-md text-white' 
          : 'bg-slate-950 border-b border-slate-800/80 text-white'
      }`}
    >
      <div className="landing-container h-[72px] flex items-center justify-between">
        
        {/* LEFT: Logo & Badge */}
        <div 
          className="flex items-center gap-3 cursor-pointer group flex-shrink-0"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <div className="w-9 h-9 rounded-xl bg-[#F5B700] flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
            <Hexagon size={20} className="text-slate-950 fill-slate-950/20" strokeWidth={2.5} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-white tracking-tight">SentinelAI</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-slate-700 hidden sm:inline-block">
              XAI Enterprise
            </span>
          </div>
        </div>

        {/* CENTER: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-7">
          {[
            { name: 'Platform', id: 'platform-overview' },
            { name: 'Capabilities', id: 'capabilities' },
            { name: 'Architecture', id: 'how-it-works' },
            { name: 'Explainable AI', id: 'explainable-ai' },
            { name: 'MITRE Matrix', id: 'mitre-matrix' },
            { name: 'Security', id: 'security' },
            { name: 'FAQ', id: 'faq' },
          ].map((item) => (
            <button
              key={item.name}
              onClick={() => scrollToSection(item.id)}
              className="text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              {item.name}
            </button>
          ))}
        </nav>

        {/* RIGHT: Action Buttons */}
        <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
          {isAuthenticated ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-2 bg-slate-800 text-white border border-slate-700 px-4 h-[42px] rounded-xl text-xs font-bold shadow-sm hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <span>SOC Console</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate('/login')}
                className="text-xs font-bold text-slate-300 hover:text-white px-3 py-2 transition-colors cursor-pointer"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-2 bg-[#F5B700] text-slate-950 px-4 h-[42px] rounded-xl text-xs font-bold shadow-sm hover:bg-[#FACC15] transition-colors cursor-pointer"
              >
                <span>Launch Console</span>
                <ArrowRight size={14} />
              </button>
            </>
          )}
        </div>

        {/* MOBILE MENU TRIGGER */}
        <button
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          className="p-2 text-slate-200 bg-slate-900 border border-slate-800 rounded-lg lg:hidden cursor-pointer"
          aria-label="Toggle navigation menu"
        >
          {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* MOBILE DROPDOWN DRAWER */}
      {mobileNavOpen && (
        <div className="lg:hidden bg-slate-950 border-b border-slate-800 px-6 py-6 space-y-4 shadow-xl">
          <nav className="flex flex-col space-y-3">
            {[
              { name: 'Platform Overview', id: 'platform-overview' },
              { name: 'Capabilities', id: 'capabilities' },
              { name: 'How It Works', id: 'how-it-works' },
              { name: 'Explainable AI', id: 'explainable-ai' },
              { name: 'MITRE ATT&CK Matrix', id: 'mitre-matrix' },
              { name: 'Enterprise Security', id: 'security' },
              { name: 'Frequently Asked Questions', id: 'faq' },
            ].map((item) => (
              <button
                key={item.name}
                onClick={() => scrollToSection(item.id)}
                className="text-left text-sm font-semibold text-slate-300 hover:text-white py-1"
              >
                {item.name}
              </button>
            ))}
          </nav>
          <div className="pt-4 border-t border-slate-800 flex flex-col gap-2">
            <button
              onClick={() => { setMobileNavOpen(false); navigate('/login'); }}
              className="w-full bg-[#F5B700] text-slate-950 h-[44px] rounded-xl text-xs font-bold text-center shadow-sm"
            >
              {isAuthenticated ? 'Enter SOC Console' : 'Sign In to Console'}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

// ─── 2. HERO SECTION ─────────────────────────────────────────────────────────
function HeroSection({ isAuthenticated, navigate }: { isAuthenticated: boolean; navigate: (path: string) => void }) {
  const [activeScenarioKey, setActiveScenarioKey] = useState<string>('dos');
  const activeScenario = THREAT_SCENARIOS[activeScenarioKey];

  return (
    <section className="pt-28 pb-16 lg:pt-32 lg:pb-20 bg-slate-950 text-white border-b border-slate-800">
      <div className="landing-container">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(480px,0.95fr)] gap-10 lg:gap-14 items-center">
          
          {/* LEFT CONTENT */}
          <div className="space-y-6 max-w-[620px]">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-amber-400 text-[11px] font-bold tracking-wider uppercase">
              <span className="w-2 h-2 rounded-full bg-[#F5B700] animate-pulse"></span>
              EXPLAINABLE ANOMALY-BASED AI SECURITY
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-[54px] font-extrabold text-white tracking-tight leading-[1.08] max-w-[620px]">
              Next-Gen AI Threat Detection with <span className="text-[#F5B700]">Full Explainability</span>
            </h1>

            <p className="text-sm sm:text-base lg:text-[17px] text-slate-300 font-normal leading-[1.6] max-w-[600px]">
              SentinelAI transforms network telemetry into actionable security intelligence. Detect zero-day anomalies, trace exact root-cause SHAP attribution metrics, and automatically map incidents to the MITRE ATT&CK framework in real time.
            </p>

            {/* BUTTONS */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
              <button
                onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login')}
                className="inline-flex items-center justify-center gap-2 bg-[#F5B700] text-slate-950 px-5 h-[46px] rounded-xl text-xs font-bold shadow-md hover:bg-[#FACC15] transition-colors cursor-pointer"
              >
                <span>Launch Console</span>
                <ArrowRight size={15} />
              </button>
              <button
                onClick={() => {
                  const el = document.getElementById('platform-overview');
                  if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
                }}
                className="inline-flex items-center justify-center gap-2 bg-slate-900 text-slate-200 border border-slate-800 px-5 h-[46px] rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <span>Explore Platform</span>
              </button>
            </div>

            {/* CHECKLIST */}
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-800/80 text-xs font-semibold text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-amber-400 flex-shrink-0" />
                <span>SHAP Feature Attribution</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-amber-400 flex-shrink-0" />
                <span>Automated MITRE Correlation</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-amber-400 flex-shrink-0" />
                <span>Argon2id &amp; Granular RBAC</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-amber-400 flex-shrink-0" />
                <span>Network Flow Analysis</span>
              </div>
            </div>
          </div>

          {/* RIGHT VISUAL: PRODUCT INTERFACE PREVIEW */}
          <div className="w-full max-w-[580px] lg:ml-auto">
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-2xl space-y-4">
              
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Terminal size={15} className="text-amber-400" />
                  <span className="text-xs font-bold text-slate-200">Product Interface Preview</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">
                  SYSTEM READY
                </span>
              </div>

              {/* Scenario Selector */}
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Select Threat Vector:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { key: 'dos', label: 'SYN DDoS' },
                    { key: 'exfil', label: 'Exfiltration' },
                    { key: 'probe', label: 'Nmap Scan' },
                    { key: 'normal', label: 'Normal Flow' },
                  ].map((btn) => (
                    <button
                      key={btn.key}
                      onClick={() => setActiveScenarioKey(btn.key)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        activeScenarioKey === btn.key
                          ? 'bg-[#F5B700] text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Scenario Details */}
              <div className="bg-slate-950 rounded-xl p-3.5 sm:p-4 border border-slate-800 space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-mono">Classification</div>
                    <div className="font-bold text-white text-sm">{activeScenario.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase font-mono">Risk Level</div>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                      activeScenario.status === 'Critical' ? 'bg-red-950 text-red-300 border border-red-800/80' :
                      activeScenario.status === 'High' ? 'bg-amber-950 text-amber-300 border border-amber-800/80' :
                      activeScenario.status === 'Medium' ? 'bg-yellow-950 text-yellow-300 border border-yellow-800/80' :
                      'bg-emerald-950 text-emerald-300 border border-emerald-800/80'
                    }`}>
                      {activeScenario.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-800/80 text-[11px]">
                  <span className="text-slate-400">
                    MITRE Mapping: <strong className="text-slate-200">{activeScenario.mitreTactic} ({activeScenario.mitreId})</strong>
                  </span>
                  <span className="text-slate-400 text-[10px] font-mono">
                    {activeScenario.type}
                  </span>
                </div>

                {/* Feature Attribution List */}
                <div className="space-y-2 pt-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Feature Attribution Factors</div>
                  {activeScenario.features.map((f, i) => (
                    <div key={i} className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between text-[11px]">
                      <div>
                        <div className="font-mono font-bold text-slate-200">{f.name}</div>
                        <div className="text-[10px] text-slate-400">{f.description}</div>
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        f.level === 'High' ? 'bg-red-950 text-red-400' :
                        f.level === 'Elevated' ? 'bg-amber-950 text-amber-400' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {f.level}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Recommendation */}
                <div className="p-2.5 bg-slate-900 rounded-lg border border-amber-500/30 text-[11px] text-slate-300">
                  <strong className="text-amber-300">Recommended Response: </strong>{activeScenario.recommendedAction}
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

// ─── 3. PLATFORM OVERVIEW SECTION ───────────────────────────────────────────
function PlatformOverviewSection() {
  return (
    <section id="platform-overview" className="py-20 bg-white border-b border-slate-200">
      <div className="landing-container">
        
        <div className="text-center max-w-[850px] mx-auto mb-14 space-y-3">
          <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
            UNIFIED SECURITY PLATFORM
          </span>
          <h2 className="text-3xl lg:text-[38px] font-black text-slate-900 tracking-tight">
            An Integrated Security Operations Platform
          </h2>
          <p className="text-base text-slate-600 font-medium leading-relaxed max-w-[760px] mx-auto">
            Eliminate black-box AI doubt with verifiable, explainable anomaly detection and instant forensic triage in a unified workspace.
          </p>
        </div>

        {/* 3 EQUAL CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="landing-card min-h-[210px] justify-between">
            <div>
              <div className="landing-icon-box">
                <Activity size={22} />
              </div>
              <h3 className="landing-card-title">Real-Time Telemetry &amp; Replay</h3>
              <p className="landing-card-desc">
                Ingest continuous network flow records or replay benchmark PCAP datasets (NSL-KDD, CIC-IDS2017) with variable speed controls.
              </p>
            </div>
          </div>

          <div className="landing-card min-h-[210px] justify-between">
            <div>
              <div className="landing-icon-box">
                <Brain size={22} />
              </div>
              <h3 className="landing-card-title">Multi-Model Detection Framework</h3>
              <p className="landing-card-desc">
                Leverage ensemble machine learning models (XGBoost, Random Forest, Autoencoder) side-by-side with SHAP feature explanations.
              </p>
            </div>
          </div>

          <div className="landing-card min-h-[210px] justify-between">
            <div>
              <div className="landing-icon-box">
                <Target size={22} />
              </div>
              <h3 className="landing-card-title">MITRE ATT&amp;CK Alignment</h3>
              <p className="landing-card-desc">
                Automatically map detected network anomalies directly to standard MITRE tactics and technique IDs for fast compliance reporting.
              </p>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}

// ─── 4. CAPABILITIES SECTION ─────────────────────────────────────────────────
function CapabilitiesSection() {
  return (
    <section id="capabilities" className="py-20 bg-[#F8FAFC] border-b border-slate-200">
      <div className="landing-container">
        
        <div className="text-center max-w-[850px] mx-auto mb-14 space-y-3">
          <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
            CORE SOC CAPABILITIES
          </span>
          <h2 className="text-3xl lg:text-[38px] font-black text-slate-900 tracking-tight">
            Purpose-Built for Security Analysis
          </h2>
          <p className="text-base text-slate-600 font-medium leading-relaxed max-w-[760px] mx-auto">
            Equip security analysts with deep forensic tools, payload inspection, and customizable threat investigation workflows.
          </p>
        </div>

        {/* 6 BALANCED GRID CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: <Search size={22} />,
              title: 'Deep Investigation Workspace',
              desc: 'Pivot on suspect IP addresses, examine packet flows, and trace incident progression seamlessly in a dedicated workspace.',
            },
            {
              icon: <AlertTriangle size={22} />,
              title: 'Automated Risk Classification',
              desc: 'Classify incoming events by severity thresholds (Critical, High, Medium, Low) with automated triage recommendations.',
            },
            {
              icon: <BarChart2 size={22} />,
              title: 'Anomaly Heatmaps & Metrics',
              desc: 'Track threat velocity, model performance metrics, and attack distribution charts in real-time dashboards.',
            },
            {
              icon: <Layers size={22} />,
              title: 'PCAP Replay Engine',
              desc: 'Simulate high-throughput network traffic from historical PCAP files to test SOC preparedness and model accuracy.',
            },
            {
              icon: <RefreshCw size={22} />,
              title: 'Continuous Threat Stream',
              desc: 'Streaming event bus processing packet vectors with minimal ingestion latency for immediate analyst alert triage.',
            },
            {
              icon: <ShieldCheck size={22} />,
              title: 'Role-Based Analyst Workflows',
              desc: 'Separate Analyst and Administrator views with granular permissions, analyst case notes, and incident assignment.',
            },
          ].map((cap, idx) => (
            <div key={idx} className="landing-card min-h-[210px] justify-between">
              <div>
                <div className="landing-icon-box-neutral">
                  {cap.icon}
                </div>
                <h3 className="landing-card-title">{cap.title}</h3>
                <p className="landing-card-desc">{cap.desc}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

// ─── 5. HOW IT WORKS SECTION ────────────────────────────────────────────────
function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20 bg-white border-b border-slate-200">
      <div className="landing-container">
        
        <div className="text-center max-w-[850px] mx-auto mb-14 space-y-3">
          <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
            PIPELINE ARCHITECTURE
          </span>
          <h2 className="text-3xl lg:text-[38px] font-black text-slate-900 tracking-tight">
            How SentinelAI Works
          </h2>
          <p className="text-base text-slate-600 font-medium leading-relaxed max-w-[760px] mx-auto">
            A 6-step detection pipeline processing raw network telemetry into actionable security responses.
          </p>
        </div>

        {/* 6 PROCESS STEPS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { step: '01', title: 'Network Telemetry', desc: 'Continuous stream ingestion of PCAP logs and network flow records.' },
            { step: '02', title: 'Feature Processing', desc: 'Real-time extraction of statistical metrics (duration, flags, byte ratios).' },
            { step: '03', title: 'AI Detection', desc: 'Ensemble model inference generating risk probability scores.' },
            { step: '04', title: 'Risk Classification', desc: 'Categorizing events into severity tiers (Critical, High, Medium, Low).' },
            { step: '05', title: 'Investigation', desc: 'XAI SHAP feature breakdown revealing exact metric anomaly drivers.' },
            { step: '06', title: 'Security Response', desc: 'Automated firewall rule suggestions and MITRE ATT&CK correlation.' },
          ].map((item, idx) => (
            <div key={idx} className="landing-card bg-slate-50 border-slate-200 space-y-3">
              <div className="w-8 h-8 rounded-lg bg-[#F5B700] text-slate-950 font-black text-xs flex items-center justify-center">
                {item.step}
              </div>
              <h3 className="landing-card-title">{item.title}</h3>
              <p className="landing-card-desc">{item.desc}</p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

// ─── 6. EXPLAINABLE AI SECTION ──────────────────────────────────────────────
function ExplainableAISection() {
  return (
    <section id="explainable-ai" className="py-20 bg-slate-950 text-white border-b border-slate-800">
      <div className="landing-container">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          {/* LEFT: Benefits */}
          <div className="lg:col-span-5 space-y-6">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              NO BLACK BOXES
            </span>
            <h2 className="text-3xl lg:text-[38px] font-black text-white tracking-tight leading-tight">
              Why Explainable AI Matters in Security
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Legacy ML models flag anomalies without explaining why. SentinelAI breaks down every inference into human-readable SHAP feature attribution metrics.
            </p>

            <div className="space-y-4 text-xs sm:text-sm pt-2">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3">
                <Eye size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">Root Cause Transparency</div>
                  <div className="text-slate-400 text-xs mt-0.5">Analysts inspect exact feature weights behind every anomaly score.</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3">
                <CheckCircle2 size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">False Positive Reduction</div>
                  <div className="text-slate-400 text-xs mt-0.5">Quickly distinguish benign software spikes from malicious attack vectors.</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3">
                <ShieldCheck size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">Analyst Confidence</div>
                  <div className="text-slate-400 text-xs mt-0.5">Defensible evidence for SOC escalation and incident documentation.</div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: SHAP Visualization Card */}
          <div className="lg:col-span-7 bg-slate-900 rounded-2xl border border-slate-800 p-5 sm:p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Brain className="text-amber-400" size={18} />
                <span className="text-xs font-bold text-white">SHAP Feature Impact Breakdown</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Target: FLOW-9942</span>
            </div>

            <div className="space-y-3 text-xs">
              {[
                { name: 'dst_host_diff_srv_rate', impact: 'High Impact', pct: 85, color: 'bg-red-500', desc: 'Targeting multiple distinct ports' },
                { name: 'flag_REJ', impact: 'Elevated', pct: 65, color: 'bg-amber-500', desc: 'Connection rejections detected' },
                { name: 'duration', impact: 'Normal', pct: 35, color: 'bg-emerald-400', desc: 'Short connection lifespan' },
                { name: 'logged_in', impact: 'Normal', pct: 45, color: 'bg-emerald-400', desc: 'No user session token present' },
              ].map((item, idx) => (
                <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-mono text-slate-200 truncate max-w-[200px]">{item.name}</span>
                    <span className="font-mono font-bold text-slate-300">{item.impact}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color}`} style={{ width: `${item.pct}%` }}></div>
                  </div>
                  <div className="text-[10px] text-slate-400">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

// ─── 7. MITRE SECTION ─────────────────────────────────────────────────────────
function MITRESection() {
  return (
    <section id="mitre-matrix" className="py-20 bg-white border-b border-slate-200">
      <div className="landing-container">
        
        <div className="text-center max-w-[850px] mx-auto mb-14 space-y-3">
          <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
            STANDARDIZED MAPPING
          </span>
          <h2 className="text-3xl lg:text-[38px] font-black text-slate-900 tracking-tight">
            MITRE ATT&amp;CK Framework Mapping
          </h2>
          <p className="text-base text-slate-600 font-medium leading-relaxed max-w-[760px] mx-auto">
            SentinelAI automatically correlates raw network anomaly vectors with standardized MITRE tactics and technique IDs.
          </p>
        </div>

        {/* TECHNIQUE CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { tactic: 'Reconnaissance', id: 'T1046', title: 'Network Service Discovery', desc: 'Probing remote hosts for open ports and vulnerable listening services.' },
            { tactic: 'Initial Access', id: 'T1190', title: 'Exploit Public App', desc: 'Exploiting software vulnerabilities in public facing network services.' },
            { tactic: 'Execution', id: 'T1059', title: 'Command & Scripting', desc: 'Abusing command interpreters to execute malicious payload scripts.' },
            { tactic: 'Command & Control', id: 'T1071', title: 'Application Layer Protocol', desc: 'Communicating via DNS/HTTPS tunneling to bypass firewall rules.' },
            { tactic: 'Exfiltration', id: 'T1020', title: 'Automated Exfiltration', desc: 'Transferring sensitive enterprise datasets to external C2 nodes.' },
            { tactic: 'Impact', id: 'T1498', title: 'Network Denial of Service', desc: 'Saturating network bandwidth or connection tables via SYN flooding.' },
          ].map((m, idx) => (
            <div key={idx} className="landing-card bg-slate-50 border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                  {m.id}
                </span>
                <span className="text-[10px] font-bold text-slate-500 uppercase">{m.tactic}</span>
              </div>
              <h3 className="landing-card-title">{m.title}</h3>
              <p className="landing-card-desc">{m.desc}</p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

// ─── 8. SECURITY SECTION ────────────────────────────────────────────────────
function SecuritySection() {
  return (
    <section id="security" className="py-20 bg-[#F8FAFC] border-b border-slate-200">
      <div className="landing-container">
        
        <div className="text-center max-w-[850px] mx-auto mb-14 space-y-3">
          <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
            ZERO-TRUST ARCHITECTURE
          </span>
          <h2 className="text-3xl lg:text-[38px] font-black text-slate-900 tracking-tight">
            Enterprise Security &amp; Access Controls
          </h2>
          <p className="text-base text-slate-600 font-medium leading-relaxed max-w-[760px] mx-auto">
            Built on strict zero-trust standards to ensure telemetry privacy and user access control.
          </p>
        </div>

        {/* 4 CLEAN CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: <Key size={22} />, title: 'Argon2id Password Hashing', desc: 'Secure user credential hashing using memory-hard Argon2id.' },
            { icon: <Users size={22} />, title: 'Role-Based Access Control', desc: 'Enforced Analyst vs Administrator privileges server-side.' },
            { icon: <FileText size={22} />, title: 'Audit Logging', desc: 'Complete audit trail logging for all state changes and authentication.' },
            { icon: <Server size={22} />, title: 'Enterprise SSO Ready', desc: 'Token-based REST API authentication with extensible SSO provider hooks.' },
          ].map((sec, idx) => (
            <div key={idx} className="landing-card min-h-[210px] justify-between">
              <div>
                <div className="landing-icon-box-neutral">
                  {sec.icon}
                </div>
                <h3 className="landing-card-title">{sec.title}</h3>
                <p className="landing-card-desc">{sec.desc}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

// ─── 9. FAQ SECTION ─────────────────────────────────────────────────────────
function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'What benchmark cybersecurity datasets does SentinelAI support?',
      a: 'SentinelAI natively supports benchmark network datasets including CIC-IDS2017, NSL-KDD, and UNSW-NB15, as well as live streaming PCAP flow records.',
    },
    {
      q: 'How does SentinelAI generate Explainable AI (XAI) feature values?',
      a: 'SentinelAI uses TreeSHAP and Kernel SHAP algorithm wrappers to calculate feature attribution scores for every inference, highlighting exact metric impacts in real time.',
    },
    {
      q: 'Can SentinelAI integrate with existing SIEM tools?',
      a: 'Yes. SentinelAI provides REST APIs that stream structured JSON alert payloads with MITRE IDs directly into Splunk, Elastic SIEM, or IBM QRadar.',
    },
    {
      q: 'What user role controls are supported?',
      a: 'The platform enforces Role-Based Access Control (RBAC) with dedicated Security Analyst and System Administrator permission levels.',
    },
  ];

  return (
    <section id="faq" className="py-20 bg-white border-b border-slate-200">
      <div className="landing-container">
        
        <div className="text-center max-w-[850px] mx-auto mb-14 space-y-3">
          <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
            FREQUENTLY ASKED QUESTIONS
          </span>
          <h2 className="text-3xl lg:text-[38px] font-black text-slate-900 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-base text-slate-600 font-medium leading-relaxed max-w-[760px] mx-auto">
            Common questions regarding model explainability, datasets, and integration.
          </p>
        </div>

        <div className="max-w-[900px] mx-auto space-y-3">
          {faqs.map((faq, idx) => (
            <div key={idx} className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
              <button
                onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                className="w-full p-5 text-left flex justify-between items-center gap-4 font-bold text-slate-900 text-sm sm:text-base hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span>{faq.q}</span>
                {openIndex === idx ? (
                  <ChevronUp size={18} className="text-amber-600 flex-shrink-0" />
                ) : (
                  <ChevronDown size={18} className="text-slate-400 flex-shrink-0" />
                )}
              </button>
              {openIndex === idx && (
                <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-[1.55] border-t border-slate-200/60 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

// ─── 10. FINAL CTA SECTION ──────────────────────────────────────────────────
function FinalCTASection({ navigate }: { navigate: (path: string) => void }) {
  return (
    <section className="py-20 bg-[#F8FAFC]">
      <div className="landing-container">
        <div className="max-w-[1240px] mx-auto rounded-3xl bg-slate-950 p-8 lg:p-12 text-center text-white space-y-6">
          <div className="max-w-2xl mx-auto space-y-3">
            <h2 className="text-3xl lg:text-[38px] font-black tracking-tight leading-tight">
              Ready to Secure Your Enterprise Perimeter?
            </h2>
            <p className="text-slate-300 text-sm sm:text-base font-normal max-w-[650px] mx-auto leading-relaxed">
              Join SOC security teams leveraging explainable AI threat detection to safeguard high-throughput network environments.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
            <button
              onClick={() => navigate('/login')}
              className="bg-[#F5B700] text-slate-950 px-6 h-[46px] rounded-xl text-xs font-bold hover:bg-[#FACC15] transition-colors cursor-pointer"
            >
              Enter SOC Console
            </button>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="bg-slate-800 text-slate-200 border border-slate-700 px-6 h-[46px] rounded-xl text-xs font-semibold hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Back to Top
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 11. FOOTER ─────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-slate-800 text-slate-400 py-8 text-xs">
      <div className="landing-container flex flex-col sm:flex-row items-center justify-between gap-6">
        
        {/* LEFT */}
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="w-7 h-7 rounded-lg bg-[#F5B700] flex items-center justify-center">
            <Hexagon size={16} className="text-slate-950 fill-slate-950/20" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-white text-sm tracking-tight">SentinelAI</span>
        </div>

        {/* CENTER */}
        <div className="flex flex-wrap justify-center gap-6 font-semibold text-slate-400">
          <a href="#platform-overview" className="hover:text-amber-400 transition-colors">Platform</a>
          <a href="#explainable-ai" className="hover:text-amber-400 transition-colors">Explainable AI</a>
          <a href="#mitre-matrix" className="hover:text-amber-400 transition-colors">MITRE ATT&amp;CK</a>
          <a href="#how-it-works" className="hover:text-amber-400 transition-colors">Architecture</a>
          <a href="#faq" className="hover:text-amber-400 transition-colors">FAQ</a>
        </div>

        {/* RIGHT */}
        <div className="text-slate-500 font-mono text-[11px]">
          &copy; {new Date().getFullYear()} SentinelAI Framework.
        </div>

      </div>
    </footer>
  );
}
