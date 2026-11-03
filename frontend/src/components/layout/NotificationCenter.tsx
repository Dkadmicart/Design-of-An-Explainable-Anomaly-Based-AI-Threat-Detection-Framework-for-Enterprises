import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, AlertTriangle, ShieldAlert, CheckCheck, Check,
  Clock, Server, ChevronRight, X, ExternalLink, ShieldCheck,
  Radio, EyeOff, BellOff, RotateCcw, Trash2
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../services/api';
import type { Alert, AlertStatus } from '../../types';

const READ_STORAGE_KEY = 'sentinelai_read_alert_ids';
const SIMULATION_STORAGE_KEY = 'sentinelai_simulation_active';

// Verified enterprise reference threat alerts used for simulation and fallback
export const FALLBACK_THREAT_ALERTS: Alert[] = [
  {
    id: 'alt-crit-ddos-8921',
    event_id: 'evt-flow-99012',
    severity: 'CRITICAL',
    attack_type: 'DDoS - SYN Flood',
    status: 'NEW',
    risk_score: 98,
    confidence: 0.99,
    detection_model: 'XGBoost Anomaly Ensemble v2.4',
    detection_reason: 'Volumetric SYN flood anomaly detected exceeding 50,000 pps on core ingress gateway.',
    mitre_tactic: 'Impact',
    mitre_technique_id: 'T1498.001',
    mitre_technique_name: 'Direct Network Flood',
    source_ip: '198.51.100.42',
    destination_ip: '10.0.1.15',
    source_port: 44128,
    destination_port: 443,
    protocol: 'TCP',
    first_seen: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    last_seen: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
  },
  {
    id: 'alt-crit-inject-4310',
    event_id: 'evt-flow-99084',
    severity: 'CRITICAL',
    attack_type: 'SQL Injection Attack',
    status: 'INVESTIGATING',
    risk_score: 94,
    confidence: 0.96,
    detection_model: 'Transformer Sequence Detector v3',
    detection_reason: 'Abnormal SQL syntax injection patterns detected targeting production authentication endpoint.',
    mitre_tactic: 'Initial Access',
    mitre_technique_id: 'T1190',
    mitre_technique_name: 'Exploit Public-Facing Application',
    source_ip: '203.0.113.88',
    destination_ip: '10.0.2.80',
    source_port: 51220,
    destination_port: 3306,
    protocol: 'TCP',
    first_seen: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
    last_seen: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
  },
  {
    id: 'alt-high-portscan-2201',
    event_id: 'evt-flow-99155',
    severity: 'HIGH',
    attack_type: 'PortScan Reconnaissance',
    status: 'NEW',
    risk_score: 86,
    confidence: 0.92,
    detection_model: 'Random Forest Flow Classifier',
    detection_reason: 'Rapid horizontal sweep across internal subnet targeting management ports 22, 3389, and 445.',
    mitre_tactic: 'Discovery',
    mitre_technique_id: 'T1046',
    mitre_technique_name: 'Network Service Discovery',
    source_ip: '192.168.1.105',
    destination_ip: '10.0.3.0',
    source_port: 39102,
    destination_port: 22,
    protocol: 'TCP',
    first_seen: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    last_seen: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
  },
  {
    id: 'alt-high-bruteforce-7104',
    event_id: 'evt-flow-99210',
    severity: 'HIGH',
    attack_type: 'SSH Brute Force',
    status: 'NEW',
    risk_score: 82,
    confidence: 0.89,
    detection_model: 'XGBoost IDS Pipeline',
    detection_reason: 'Repeated cryptographic authentication failures within short temporal window from single host.',
    mitre_tactic: 'Credential Access',
    mitre_technique_id: 'T1110.001',
    mitre_technique_name: 'Password Guessing',
    source_ip: '185.220.101.5',
    destination_ip: '10.0.1.50',
    source_port: 58914,
    destination_port: 22,
    protocol: 'SSH',
    first_seen: new Date(Date.now() - 320 * 60 * 1000).toISOString(),
    last_seen: new Date(Date.now() - 310 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 320 * 60 * 1000).toISOString(),
  },
  {
    id: 'alt-high-botnet-6642',
    event_id: 'evt-flow-99341',
    severity: 'HIGH',
    attack_type: 'Botnet C2 Beaconing',
    status: 'INVESTIGATING',
    risk_score: 79,
    confidence: 0.88,
    detection_model: 'Autoencoder Flow Anomaly v1.8',
    detection_reason: 'Periodic outbound TCP beaconing matching recognized botnet Command-and-Control footprint.',
    mitre_tactic: 'Command and Control',
    mitre_technique_id: 'T1071.001',
    mitre_technique_name: 'Web Protocols',
    source_ip: '10.0.4.12',
    destination_ip: '93.184.216.34',
    source_port: 49152,
    destination_port: 8443,
    protocol: 'TCP',
    first_seen: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    last_seen: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
  },
];

/**
 * Enterprise Relative Timestamp Formatter
 * Complies with requirement: "Just now", "5m ago", "1h ago", "Yesterday", and older dates.
 */
export function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'Just now';
  const now = Date.now();
  const date = new Date(dateString);
  const diffMs = now - date.getTime();
  if (isNaN(diffMs) || diffMs < 0) return 'Just now';

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

type FilterOption = 'ALL' | 'CRITICAL' | 'HIGH' | 'UNREAD';

interface NotificationCenterProps {
  className?: string;
}

export default function NotificationCenter({ className }: NotificationCenterProps) {
  const navigate = useNavigate();

  // State
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterOption>('ALL');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  // Simulation state: persists until all alerts are marked as read
  const [isSimulated, setIsSimulated] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIMULATION_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [rawAlerts, setRawAlerts] = useState<Alert[]>(() => {
    try {
      if (localStorage.getItem(SIMULATION_STORAGE_KEY) === 'true') {
        return FALLBACK_THREAT_ALERTS;
      }
    } catch {}
    return [];
  });

  // Read / Unread IDs stored in localStorage
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(READ_STORAGE_KEY);
      return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);

  // Responsive screen-size tracking (<768px for mobile drawer, >=768px for dropdown)
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch alerts from API (preserves simulation until marked read)
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await api.getAlerts({ page_size: 100 });
      if (res && Array.isArray(res.alerts) && res.alerts.length > 0) {
        // If real backend has High or Critical alerts, use them
        const hasHighCrit = res.alerts.some(
          (a) => a && (a.severity === 'HIGH' || a.severity === 'CRITICAL')
        );
        if (hasHighCrit) {
          setIsSimulated(false);
          try {
            localStorage.removeItem(SIMULATION_STORAGE_KEY);
          } catch {}
          setRawAlerts(res.alerts);
          return;
        }
      }

      // If backend has no high/critical alerts, check if simulation is active
      const isSimActive = (() => {
        try {
          return localStorage.getItem(SIMULATION_STORAGE_KEY) === 'true';
        } catch {
          return false;
        }
      })();

      if (isSimActive) {
        // Keep simulated threats appearing continuously until user marks all as read
        setRawAlerts(FALLBACK_THREAT_ALERTS);
      } else {
        setRawAlerts([]);
      }
    } catch (err) {
      console.warn('NotificationCenter: API alerts fetch failed or backend offline.', err);
      const isSimActive = (() => {
        try {
          return localStorage.getItem(SIMULATION_STORAGE_KEY) === 'true';
        } catch {
          return false;
        }
      })();

      if (isSimActive) {
        setRawAlerts(FALLBACK_THREAT_ALERTS);
      } else {
        setRawAlerts([]);
      }
    }
  }, []);

  // Initial fetch and 25s polling interval
  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 25000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  // Outside click & Escape key handler
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (
        isOpen &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        triggerButtonRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
      if (isMobile) {
        document.body.style.overflow = 'hidden';
      }
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, isMobile]);

  // ─── Requirement 1: Filter to ONLY HIGH & CRITICAL and Sort ───
  // 1. CRITICAL first
  // 2. HIGH second
  // 3. Most recent timestamp first
  const highCritAlerts = useMemo(() => {
    const list = Array.isArray(rawAlerts) ? rawAlerts : [];
    return list
      .filter((a): a is Alert => {
        if (!a || !a.severity) return false;
        const sev = String(a.severity).toUpperCase();
        // Strictly exclude LOW and MEDIUM
        return sev === 'HIGH' || sev === 'CRITICAL';
      })
      .sort((a, b) => {
        // 1. CRITICAL first, HIGH second
        const rankA = a.severity === 'CRITICAL' ? 0 : 1;
        const rankB = b.severity === 'CRITICAL' ? 0 : 1;
        if (rankA !== rankB) {
          return rankA - rankB;
        }
        // 2. Most recent timestamp first
        const timeA = new Date(a.created_at || a.first_seen || 0).getTime();
        const timeB = new Date(b.created_at || b.first_seen || 0).getTime();
        return timeB - timeA;
      });
  }, [rawAlerts]);

  // Derived counts
  const totalCount = highCritAlerts.length;
  const criticalCount = useMemo(
    () => highCritAlerts.filter((a) => a.severity === 'CRITICAL').length,
    [highCritAlerts]
  );
  const highCount = useMemo(
    () => highCritAlerts.filter((a) => a.severity === 'HIGH').length,
    [highCritAlerts]
  );
  const unreadCount = useMemo(
    () => highCritAlerts.filter((a) => !readIds.has(a.id)).length,
    [highCritAlerts, readIds]
  );
  const hasUnreadCritical = useMemo(
    () => highCritAlerts.some((a) => a.severity === 'CRITICAL' && !readIds.has(a.id)),
    [highCritAlerts, readIds]
  );

  // Tab Filtering (All, Critical, High, Unread)
  const filteredAlerts = useMemo(() => {
    switch (activeFilter) {
      case 'CRITICAL':
        return highCritAlerts.filter((a) => a.severity === 'CRITICAL');
      case 'HIGH':
        return highCritAlerts.filter((a) => a.severity === 'HIGH');
      case 'UNREAD':
        return highCritAlerts.filter((a) => !readIds.has(a.id));
      case 'ALL':
      default:
        return highCritAlerts;
    }
  }, [highCritAlerts, activeFilter, readIds]);

  // ─── Mark as Read Actions ───
  const toggleMarkAsRead = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setReadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {}

      // If simulated and all alerts are now read, end simulation
      if (isSimulated) {
        const remainingUnread = highCritAlerts.filter((a) => !next.has(a.id));
        if (remainingUnread.length === 0) {
          setIsSimulated(false);
          try {
            localStorage.removeItem(SIMULATION_STORAGE_KEY);
          } catch {}
          setRawAlerts([]);
        }
      }

      return next;
    });
  }, [highCritAlerts, isSimulated]);

  const markAllAsRead = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setReadIds((prev) => {
      const next = new Set(prev);
      highCritAlerts.forEach((a) => next.add(a.id));
      try {
        localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });

    // When user marks all as read, simulated threats clear so empty notification bar appears
    if (isSimulated) {
      setIsSimulated(false);
      try {
        localStorage.removeItem(SIMULATION_STORAGE_KEY);
      } catch {}
      setRawAlerts([]);
    }
  }, [highCritAlerts, isSimulated]);

  // Manual actions to clear all or simulate sample threats
  const handleClearAll = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsSimulated(false);
    try {
      localStorage.removeItem(SIMULATION_STORAGE_KEY);
    } catch {}
    setRawAlerts([]);
  }, []);

  const handleLoadSampleAlerts = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsSimulated(true);
    try {
      localStorage.setItem(SIMULATION_STORAGE_KEY, 'true');
    } catch {}

    // Reset read state for simulated alerts so they appear fresh and unread
    setReadIds((prev) => {
      const next = new Set(prev);
      FALLBACK_THREAT_ALERTS.forEach((a) => next.delete(a.id));
      try {
        localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });

    setRawAlerts(FALLBACK_THREAT_ALERTS);
  }, []);

  // Quick Actions navigation
  const handleViewDetails = (alert: Alert, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(alert.id);
      try {
        localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {}

      if (isSimulated) {
        const remainingUnread = highCritAlerts.filter((a) => !next.has(a.id));
        if (remainingUnread.length === 0) {
          setIsSimulated(false);
          try {
            localStorage.removeItem(SIMULATION_STORAGE_KEY);
          } catch {}
          setRawAlerts([]);
        }
      }

      return next;
    });
    setIsOpen(false);
    navigate(`/alerts/${alert.id}`);
  };

  const handleOpenInvestigation = (alert: Alert, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(alert.id);
      try {
        localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {}

      if (isSimulated) {
        const remainingUnread = highCritAlerts.filter((a) => !next.has(a.id));
        if (remainingUnread.length === 0) {
          setIsSimulated(false);
          try {
            localStorage.removeItem(SIMULATION_STORAGE_KEY);
          } catch {}
          setRawAlerts([]);
        }
      }

      return next;
    });
    setIsOpen(false);
    const targetEntity = alert.destination_ip || alert.source_ip || '';
    navigate(`/investigate?target=${encodeURIComponent(targetEntity)}`);
  };

  const handleViewAllQueue = () => {
    setIsOpen(false);
    navigate('/alerts');
  };

  // Status badge formatter
  const renderStatus = (status?: AlertStatus | string) => {
    const s = String(status || 'NEW').toUpperCase();
    let label = 'Open';
    let badgeClass = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';

    if (s === 'INVESTIGATING') {
      label = 'Investigating';
      badgeClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    } else if (s === 'RESOLVED') {
      label = 'Resolved';
      badgeClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    } else if (s === 'CONFIRMED' || s === 'ESCALATED') {
      label = s === 'CONFIRMED' ? 'Confirmed' : 'Escalated';
      badgeClass = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
    }

    return (
      <span className={clsx('px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border font-mono', badgeClass)}>
        {label}
      </span>
    );
  };

  return (
    <div className={clsx('relative inline-block', className)} ref={containerRef}>
      {/* ─── Notification Trigger Button ─── */}
      <button
        ref={triggerButtonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Security notifications: ${unreadCount} unread out of ${totalCount} high and critical threats`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls="security-notification-panel"
        id="notification-bell-trigger"
        className={clsx(
          'relative w-10 h-10 flex items-center justify-center rounded-xl border transition-all duration-150 cursor-pointer flex-shrink-0 shadow-2xs select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2',
          isOpen
            ? 'bg-[var(--color-bg-subtle)] border-amber-400/60 text-[var(--color-text-main)] shadow-sm'
            : 'border-[var(--color-border-base)] bg-[var(--color-bg-card)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-main)]'
        )}
      >
        <Bell
          size={18}
          className={clsx(
            'transition-colors duration-150',
            hasUnreadCritical ? 'text-red-500 animate-pulse' : unreadCount > 0 ? 'text-amber-500' : ''
          )}
        />

        {/* ─── Badge Logic: Total and Unread Count with Pulse Indicator ─── */}
        {unreadCount > 0 ? (
          <>
            {/* Pulsing indicator behind badge if any unread is CRITICAL */}
            {hasUnreadCritical && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500/40 animate-ping pointer-events-none" />
            )}
            <span
              className={clsx(
                'absolute -top-1.5 -right-1.5 min-w-[19px] h-[19px] px-1 flex items-center justify-center rounded-full text-[10px] font-black font-mono shadow-xs border transition-transform',
                hasUnreadCritical
                  ? 'bg-red-600 text-white border-white dark:border-slate-900 animate-pulse ring-2 ring-red-500/20'
                  : 'bg-amber-500 text-slate-950 border-white dark:border-slate-900 ring-2 ring-amber-400/20'
              )}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          </>
        ) : totalCount > 0 ? (
          /* Static calm indicator when all are caught up */
          <span
            className="absolute top-2 right-2 w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500 ring-2 ring-white dark:ring-slate-900"
            title="All threats caught up"
          />
        ) : null}

        <span className="sr-only">
          {unreadCount > 0
            ? `${unreadCount} unread high and critical security threats`
            : totalCount > 0
            ? 'All security notifications read'
            : 'No security alerts in queue'}
        </span>
      </button>

      {/* ─── Notification Panel (Mobile Drawer or Desktop/Tablet Dropdown) ─── */}
      {isOpen && (
        <>
          {/* Mobile Overlay Backdrop (<768px) */}
          <div
            className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-50 animate-fade-in"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Panel Container */}
          <div
            id="security-notification-panel"
            role="dialog"
            aria-modal={isMobile}
            aria-label="Security Threat Notifications Queue"
            className={clsx(
              // Common Panel Styles
              'bg-[var(--color-bg-card)] border border-[var(--color-border-base)] shadow-2xl z-50 flex flex-col overflow-hidden text-[var(--color-text-main)]',
              // Mobile (<768px): Native Slide-over Drawer
              'max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:w-full max-md:max-w-[420px] max-md:rounded-none max-md:animate-slide-in-right',
              // Tablet (768px-1024px): Compact Anchored Dropdown
              'md:absolute md:right-0 md:top-full md:mt-2.5 md:rounded-2xl md:animate-fade-in',
              'md:w-[380px] lg:w-[440px]'
            )}
          >
            {/* ─── Panel Header ─── */}
            <div className="p-3.5 sm:p-4 border-b border-[var(--color-border-base)] bg-[var(--color-bg-subtle)] flex items-center justify-between gap-3 flex-shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={clsx(
                    'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-2xs border',
                    hasUnreadCritical
                      ? 'bg-red-500/10 text-red-500 border-red-500/30'
                      : totalCount > 0
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                  )}
                >
                  {totalCount > 0 ? <ShieldAlert size={17} /> : <ShieldCheck size={17} />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs sm:text-sm font-black tracking-tight text-[var(--color-text-main)] truncate">
                      Security Threats
                    </h2>
                    {unreadCount > 0 ? (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold font-mono bg-red-500 text-white">
                        {unreadCount} new
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        {totalCount === 0 ? 'Queue Empty' : 'All Read'}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--color-text-muted)] font-medium truncate">
                    Surfacing ONLY HIGH &amp; CRITICAL incidents
                  </p>
                </div>
              </div>

              {/* Header Actions: Mark All Read, Clear & Close Button */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] sm:min-h-[32px] text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-lg cursor-pointer transition-colors"
                    title="Mark all notifications as read"
                  >
                    <CheckCheck size={14} />
                    <span className="hidden sm:inline">Mark all read</span>
                  </button>
                )}

                {totalCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="flex items-center gap-1 px-2 py-1.5 min-h-[36px] sm:min-h-[32px] text-[11px] font-bold text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg cursor-pointer transition-colors"
                    title="Clear notification bar alerts to view empty state"
                  >
                    <Trash2 size={13} />
                    <span className="hidden sm:inline">Clear</span>
                  </button>
                )}

                {/* Close Button (Touch friendly min 44px on mobile) */}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-bg-card)] rounded-xl cursor-pointer transition-colors flex-shrink-0"
                  aria-label="Close notification panel"
                  title="Close notifications"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* ─── Severity Filter Bar inside Dropdown ─── */}
            <div className="px-3 sm:px-4 py-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] flex items-center gap-1.5 overflow-x-auto min-w-0 flex-shrink-0 select-none">
              <button
                type="button"
                onClick={() => setActiveFilter('ALL')}
                className={clsx(
                  'px-2.5 py-1.5 min-h-[36px] sm:min-h-[30px] rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5',
                  activeFilter === 'ALL'
                    ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-bg-subtle)]'
                )}
              >
                <span>All</span>
                <span className={clsx('text-[10px] px-1 py-0.2 rounded font-mono', activeFilter === 'ALL' ? 'bg-slate-950/20' : 'bg-[var(--color-bg-subtle)]')}>
                  {totalCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('CRITICAL')}
                className={clsx(
                  'px-2.5 py-1.5 min-h-[36px] sm:min-h-[30px] rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5',
                  activeFilter === 'CRITICAL'
                    ? 'bg-red-600 text-white font-black shadow-xs'
                    : 'text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10'
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span>Critical</span>
                <span className={clsx('text-[10px] px-1 py-0.2 rounded font-mono', activeFilter === 'CRITICAL' ? 'bg-white/20' : 'bg-[var(--color-bg-subtle)]')}>
                  {criticalCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('HIGH')}
                className={clsx(
                  'px-2.5 py-1.5 min-h-[36px] sm:min-h-[30px] rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5',
                  activeFilter === 'HIGH'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'text-[var(--color-text-muted)] hover:text-amber-500 hover:bg-amber-500/10'
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>High</span>
                <span className={clsx('text-[10px] px-1 py-0.2 rounded font-mono', activeFilter === 'HIGH' ? 'bg-slate-950/20' : 'bg-[var(--color-bg-subtle)]')}>
                  {highCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('UNREAD')}
                className={clsx(
                  'px-2.5 py-1.5 min-h-[36px] sm:min-h-[30px] rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ml-auto',
                  activeFilter === 'UNREAD'
                    ? 'bg-blue-600 text-white font-black shadow-xs'
                    : 'text-[var(--color-text-muted)] hover:text-blue-500 hover:bg-blue-500/10'
                )}
              >
                <span>Unread</span>
                <span className={clsx('text-[10px] px-1 py-0.2 rounded font-mono', activeFilter === 'UNREAD' ? 'bg-white/20' : 'bg-[var(--color-bg-subtle)]')}>
                  {unreadCount}
                </span>
              </button>
            </div>

            {/* ─── Alert Items Scrollable Container ─── */}
            <div className="flex-1 overflow-y-auto max-h-[calc(100vh-210px)] md:max-h-[440px] divide-y divide-[var(--color-border-subtle)] p-2 sm:p-2.5 space-y-2">
              {filteredAlerts.length === 0 ? (
                /* ─── Simple Empty Notification Bar with Short Comment ─── */
                <div className="p-3 sm:p-4">
                  <div className="rounded-xl border border-[var(--color-border-base)] bg-[var(--color-bg-subtle)] p-3.5 sm:p-4 shadow-2xs">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5 border border-emerald-500/20">
                        <BellOff size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-bold text-[var(--color-text-main)]">
                            {activeFilter === 'ALL'
                              ? 'No Alerts'
                              : activeFilter === 'CRITICAL'
                              ? 'No Critical Threats'
                              : activeFilter === 'HIGH'
                              ? 'No High Threats'
                              : 'No Unread Alerts'}
                          </h4>
                          <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            Normal
                          </span>
                        </div>

                        {/* Short, simple comment inside */}
                        <p className="text-xs text-[var(--color-text-muted)] mt-1.5 font-mono">
                          // All systems operating normally. No threats detected.
                        </p>

                        <div className="mt-3 pt-2.5 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-xs">
                          <button
                            type="button"
                            onClick={handleViewAllQueue}
                            className="text-[11px] font-bold text-amber-500 hover:text-amber-400 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>View Queue</span>
                            <ExternalLink size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={handleLoadSampleAlerts}
                            className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] inline-flex items-center gap-1 cursor-pointer"
                            title="Simulate sample alerts"
                          >
                            <RotateCcw size={11} />
                            <span>Simulate</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                filteredAlerts.map((alert) => {
                  const isRead = readIds.has(alert.id);
                  const isCrit = alert.severity === 'CRITICAL';

                  return (
                    <div
                      key={alert.id}
                      onClick={(e) => handleViewDetails(alert, e)}
                      className={clsx(
                        'group relative rounded-xl p-3 sm:p-3.5 transition-all duration-150 cursor-pointer border',
                        // Visual Priority: CRITICAL vs HIGH
                        isCrit
                          ? 'border-l-4 border-l-red-500 border-t-red-500/20 border-r-red-500/20 border-b-red-500/20 bg-gradient-to-r from-red-500/5 to-transparent hover:from-red-500/10'
                          : 'border-l-4 border-l-amber-500 border-t-[var(--color-border-base)] border-r-[var(--color-border-base)] border-b-[var(--color-border-base)] hover:border-amber-400/40 bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-subtle)]',
                        // Read vs Unread Visual styling
                        isRead ? 'opacity-85' : 'shadow-xs font-semibold'
                      )}
                      role="article"
                      aria-label={`${alert.severity} alert: ${alert.attack_type}`}
                    >
                      {/* Top Row: Severity Badge + Threat Name + Relative Timestamp */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Severity Indicator & Badge */}
                          {isCrit ? (
                            <div className="flex items-center gap-1.5">
                              {/* Pulsing indicator for Critical */}
                              <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-500 text-white font-mono shadow-2xs">
                                CRITICAL
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {/* Static warning indicator for High */}
                              <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />
                              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 font-mono shadow-2xs">
                                HIGH
                              </span>
                            </div>
                          )}

                          {/* Threat Name */}
                          <h4 className="text-xs sm:text-sm font-extrabold text-[var(--color-text-main)] truncate group-hover:text-amber-500 transition-colors">
                            {alert.attack_type || 'Anomaly Detection Alert'}
                          </h4>
                        </div>

                        {/* Relative Timestamp + Unread Status */}
                        <div className="flex items-center gap-1.5 flex-shrink-0 text-[11px] text-[var(--color-text-muted)] font-mono">
                          <Clock size={12} className="flex-shrink-0" />
                          <time dateTime={alert.created_at || alert.first_seen} title={alert.created_at || alert.first_seen}>
                            {formatRelativeTime(alert.created_at || alert.first_seen)}
                          </time>
                          {!isRead && (
                            <span
                              className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0 ml-0.5"
                              title="Unread notification"
                            />
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-[11px] sm:text-xs text-[var(--color-text-body)] mt-1.5 line-clamp-2 leading-relaxed">
                        {alert.detection_reason || 'AI anomalous flow vector triggered high risk severity threshold.'}
                      </p>

                      {/* Affected Asset & System Details */}
                      <div className="mt-2.5 pt-2 border-t border-[var(--color-border-subtle)] flex items-center justify-between gap-2 flex-wrap text-[11px]">
                        <div className="flex items-center gap-3 font-mono text-[var(--color-text-muted)] truncate min-w-0">
                          {/* Affected Asset / System Target */}
                          <div className="flex items-center gap-1 truncate" title={`Destination Asset: ${alert.destination_ip}`}>
                            <Server size={12} className="flex-shrink-0 text-amber-500/80" />
                            <span className="truncate">
                              Asset: <strong className="text-[var(--color-text-main)] font-semibold">{alert.destination_ip}</strong>
                              {alert.destination_port ? `:${alert.destination_port}` : ''}
                            </span>
                          </div>

                          {/* Source Entity */}
                          {alert.source_ip && (
                            <div className="hidden sm:flex items-center gap-1 truncate text-[10.5px]">
                              <span>Src: {alert.source_ip}</span>
                            </div>
                          )}
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {renderStatus(alert.status)}
                        </div>
                      </div>

                      {/* Quick Actions Bar */}
                      <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-dashed border-[var(--color-border-subtle)]">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => handleViewDetails(alert, e)}
                            className="px-2.5 py-1 min-h-[32px] sm:min-h-[28px] rounded-lg text-[11px] font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                            title="View Alert Details"
                          >
                            <span>Details</span>
                            <ChevronRight size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleOpenInvestigation(alert, e)}
                            className="px-2.5 py-1 min-h-[32px] sm:min-h-[28px] rounded-lg text-[11px] font-bold bg-[var(--color-bg-subtle)] text-[var(--color-text-main)] hover:bg-[var(--color-bg-card)] border border-[var(--color-border-base)] transition-colors flex items-center gap-1 cursor-pointer"
                            title="Correlate entity and open investigation"
                          >
                            <Radio size={12} className="text-amber-500 flex-shrink-0" />
                            <span>Investigate</span>
                          </button>
                        </div>

                        {/* Mark as read/unread toggle button */}
                        <button
                          type="button"
                          onClick={(e) => toggleMarkAsRead(alert.id, e)}
                          className={clsx(
                            'p-1.5 min-h-[32px] sm:min-h-[28px] min-w-[32px] sm:min-w-[28px] rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center',
                            isRead
                              ? 'text-[var(--color-text-muted)] hover:text-amber-500 hover:bg-[var(--color-bg-subtle)]'
                              : 'text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                          )}
                          title={isRead ? 'Mark as unread' : 'Mark as read'}
                          aria-label={isRead ? 'Mark as unread' : 'Mark as read'}
                        >
                          {isRead ? <EyeOff size={14} /> : <Check size={14} />}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ─── Panel Footer ─── */}
            <div className="p-3 sm:p-3.5 border-t border-[var(--color-border-base)] bg-[var(--color-bg-subtle)] flex items-center justify-between gap-2 flex-shrink-0">
              <div className="text-[11px] text-[var(--color-text-muted)] font-mono truncate">
                <span>{totalCount} High &amp; Critical Alerts</span>
              </div>

              <button
                type="button"
                onClick={handleViewAllQueue}
                className="inline-flex items-center gap-1.5 text-xs font-extrabold text-amber-500 hover:text-amber-400 transition-colors cursor-pointer min-h-[36px] sm:min-h-[32px] px-2 py-1"
              >
                <span>View Alert Queue</span>
                <ExternalLink size={13} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
