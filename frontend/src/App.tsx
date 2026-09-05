import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import LiveMonitor from './pages/LiveMonitor';
import Alerts from './pages/Alerts';
import AlertInvestigation from './pages/AlertInvestigation';
import NetworkEvents from './pages/NetworkEvents';
import Investigate from './pages/Investigate';
import ThreatIntel from './pages/ThreatIntel';
import MitreAttack from './pages/MitreAttack';
import Models from './pages/Models';
import Analytics from './pages/Analytics';
import Datasets from './pages/Datasets';
import SystemHealth from './pages/SystemHealth';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          {/* Default Root Redirects to Dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          {/* Main Canonical Routes */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/live-monitor" element={<LiveMonitor />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/alerts/:alertId" element={<AlertInvestigation />} />
          <Route path="/investigate" element={<Investigate />} />
          <Route path="/network-events" element={<NetworkEvents />} />
          <Route path="/threat-intelligence" element={<ThreatIntel />} />
          <Route path="/mitre" element={<MitreAttack />} />
          <Route path="/models" element={<Models />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/datasets" element={<Datasets />} />
          <Route path="/system-health" element={<SystemHealth />} />
          <Route path="/settings" element={<Settings />} />

          {/* Short Aliases for backward compatibility */}
          <Route path="/monitor" element={<Navigate to="/live-monitor" replace />} />
          <Route path="/events" element={<Navigate to="/network-events" replace />} />
          <Route path="/threat-intel" element={<Navigate to="/threat-intelligence" replace />} />
          <Route path="/health" element={<Navigate to="/system-health" replace />} />

          {/* Fallback Catch-all Route */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
