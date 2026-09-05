import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Menu, PanelLeftClose, PanelLeftOpen, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import type { EnvironmentMode } from '../../types';

interface HeaderProps {
  mode: EnvironmentMode;
  onModeChange: (mode: EnvironmentMode) => void;
  onMobileMenuOpen: () => void;
  sidebarCollapsed: boolean;
  onSidebarToggle: () => void;
}

export default function Header({
  mode,
  onModeChange,
  onMobileMenuOpen,
  sidebarCollapsed,
  onSidebarToggle,
}: HeaderProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="h-[68px] bg-white border-b border-slate-200/80 flex items-center justify-between header-container flex-shrink-0 z-20 shadow-2xs select-none">
      {/* Left Section: Sidebar Toggle + Global Search Bar */}
      <div className="flex items-center gap-3 lg:gap-4 flex-1 min-w-0 mr-4">
        {/* Mobile Hamburger Drawer Button */}
        <button
          onClick={onMobileMenuOpen}
          className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer flex-shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu size={19} />
        </button>

        {/* Desktop Sidebar Collapse / Expand Toggle Button */}
        <button
          onClick={onSidebarToggle}
          className="hidden lg:flex w-10 h-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer flex-shrink-0"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
        </button>

        {/* Global Search Bar */}
        <div className="relative w-full max-w-[480px] min-w-[200px]">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search events, IPs, alerts, domains, or techniques..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input input-has-icon pr-3 py-2 h-[40px] text-xs md:text-sm bg-slate-50 border-slate-200 focus:bg-white focus:border-amber-400 rounded-xl font-medium"
          />
        </div>
      </div>

      {/* Right Controls: Telemetry Switch + System Health + Notifications + User Profile */}
      <div className="flex items-center gap-3 lg:gap-3.5 flex-shrink-0">
        {/* Segmented Telemetry Mode Control */}
        <div className="hidden sm:inline-flex items-center bg-slate-100/90 rounded-xl p-1 border border-slate-200/80 gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => onModeChange('replay')}
            className={clsx(
              'px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer select-none whitespace-nowrap flex items-center justify-center',
              mode === 'replay'
                ? 'bg-[#F5B700] text-slate-950 shadow-xs ring-1 ring-amber-400/40'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            )}
          >
            Dataset Replay
          </button>
          <button
            type="button"
            onClick={() => onModeChange('live')}
            className={clsx(
              'px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer select-none whitespace-nowrap flex items-center justify-center',
              mode === 'live'
                ? 'bg-[#F5B700] text-slate-950 shadow-xs ring-1 ring-amber-400/40'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            )}
          >
            Live Telemetry
          </button>
        </div>

        {/* System Health Status Button */}
        <button
          onClick={() => navigate('/system-health')}
          className="hidden xl:flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 px-3.5 py-2 rounded-xl border border-slate-200/80 transition-colors cursor-pointer shadow-2xs"
          title="View System Infrastructure Status"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>System Healthy</span>
        </button>

        {/* Notifications Button */}
        <button
          className="relative w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer flex-shrink-0 shadow-2xs"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell size={18} />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
        </button>

        {/* User Profile Pill */}
        <div className="flex items-center gap-3 pl-3.5 border-l border-slate-200/80">
          <div className="w-9 h-9 rounded-xl bg-amber-100/80 border border-amber-200/90 flex items-center justify-center font-extrabold text-xs text-amber-900 shadow-2xs flex-shrink-0">
            SA
          </div>
          <div className="hidden lg:flex flex-col text-left">
            <span className="text-xs font-extrabold text-slate-900 leading-tight">SecOps Analyst</span>
            <span className="text-[10.5px] font-semibold text-slate-500 leading-tight">SOC Tier-2</span>
          </div>
          <ChevronDown size={14} className="hidden lg:block text-slate-400 ml-0.5" />
        </div>
      </div>
    </header>
  );
}

