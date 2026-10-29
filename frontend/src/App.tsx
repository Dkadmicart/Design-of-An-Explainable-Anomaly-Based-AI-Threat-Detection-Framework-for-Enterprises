import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { PublicRoute } from './components/auth/PublicRoute';

import Layout from './components/layout/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

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
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
        <Routes>
          {/* ─── Public Routes ────────────────────────────────────────── */}
          <Route path="/" element={<Landing />} />
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicRoute>
                <Signup />
              </PublicRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PublicRoute>
                <ForgotPassword />
              </PublicRoute>
            }
          />
          <Route
            path="/reset-password"
            element={
              <PublicRoute>
                <ResetPassword />
              </PublicRoute>
            }
          />
          <Route path="/auth/google" element={<Navigate to="/login" replace />} />

          {/* ─── Protected SOC Workspace Routes ───────────────────────── */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
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

            {/* Aliases for convenience */}
            <Route path="/monitor" element={<Navigate to="/live-monitor" replace />} />
            <Route path="/events" element={<Navigate to="/network-events" replace />} />
            <Route path="/threat-intel" element={<Navigate to="/threat-intelligence" replace />} />
            <Route path="/health" element={<Navigate to="/system-health" replace />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </ThemeProvider>
  );
}
