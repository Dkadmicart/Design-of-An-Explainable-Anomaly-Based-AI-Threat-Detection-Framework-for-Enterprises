import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Bell, Menu, PanelLeftClose, PanelLeftOpen,
  ChevronDown, LogOut, Shield, User as UserIcon, X
} from 'lucide-react';
import clsx from 'clsx';
import type { EnvironmentMode } from '../../types';
import { useAuth } from '../../context/AuthContext';

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
  const { user, logout } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        setProfileModalOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSignOut = async () => {
    setDropdownOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  // Initials generator
  const getInitials = (name?: string) => {
    if (!name) return 'SA';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const displayName = user?.display_name || 'SecOps Analyst';
  const roleLabel = user?.role ? user.role.replace('_', ' ') : 'SOC Tier-2';

  return (
    <>
      <header className="h-[70px] bg-white border-b border-slate-200/80 flex items-center justify-between header-container flex-shrink-0 z-20 shadow-2xs select-none">
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
          <div className="relative w-full max-w-[520px] min-w-0 flex-shrink">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search events, IPs, alerts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input input-has-icon pr-3 py-2 h-[46px] text-sm bg-slate-50 border-slate-200 focus:bg-white focus:border-amber-400 rounded-xl font-medium w-full min-w-0"
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

          {/* Authenticated User Profile Pill & Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-3 pl-3.5 border-l border-slate-200/80 cursor-pointer hover:bg-slate-50/80 py-1.5 px-2 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-amber-400/30"
              aria-expanded={dropdownOpen}
              aria-label="User profile and settings menu"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-100/90 border border-amber-300/80 flex items-center justify-center font-black text-xs text-amber-900 shadow-2xs flex-shrink-0">
                {getInitials(user?.display_name)}
              </div>
              <div className="hidden lg:flex flex-col text-left">
                <span className="text-xs font-extrabold text-slate-900 leading-tight">
                  {displayName}
                </span>
                <span className="text-[10px] font-bold text-amber-700 uppercase leading-tight tracking-wider">
                  {roleLabel}
                </span>
              </div>
              <ChevronDown
                size={14}
                className={clsx(
                  'hidden lg:block text-slate-400 ml-0.5 transition-transform duration-150',
                  dropdownOpen && 'rotate-180 text-slate-700'
                )}
              />
            </button>

            {/* Profile Dropdown Menu */}
            {dropdownOpen && (
              <div className="profile-dropdown-menu animate-fade-in" role="menu">
                {/* Header info card */}
                <div className="profile-dropdown-header">
                  <div className="profile-dropdown-name truncate">
                    {user?.display_name || 'SecOps Analyst'}
                  </div>
                  <div className="profile-dropdown-email">
                    {user?.email || 'analyst@sentinelai.internal'}
                  </div>
                  <div className="profile-dropdown-badge">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 flex-shrink-0" />
                    <span>Role: {user?.role || 'ANALYST'}</span>
                  </div>
                </div>

                {/* Navigation items */}
                <div className="py-1 space-y-0.5">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      setProfileModalOpen(true);
                    }}
                    className="profile-dropdown-item"
                    role="menuitem"
                  >
                    <UserIcon size={16} className="text-slate-400 flex-shrink-0" />
                    <span>Profile Information</span>
                  </button>

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate('/settings');
                    }}
                    className="profile-dropdown-item"
                    role="menuitem"
                  >
                    <Shield size={16} className="text-slate-400 flex-shrink-0" />
                    <span>Security Settings</span>
                  </button>
                </div>

                {/* Subtle Divider */}
                <div className="border-t border-slate-100 my-1" />

                {/* Sign out */}
                <div>
                  <button
                    onClick={handleSignOut}
                    className="profile-dropdown-item profile-dropdown-signout"
                    role="menuitem"
                  >
                    <LogOut size={16} className="flex-shrink-0" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Profile Details Modal */}
      {profileModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 font-extrabold text-xs flex items-center justify-center">
                  {getInitials(user?.display_name)}
                </div>
                <h3 className="text-sm font-extrabold text-slate-900">User Identity Profile</h3>
              </div>
              <button
                onClick={() => setProfileModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block mb-0.5">
                  Full Name
                </span>
                <span className="font-extrabold text-slate-900">{user?.display_name}</span>
              </div>

              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block mb-0.5">
                  Enterprise Email
                </span>
                <span className="font-mono text-slate-700">{user?.email}</span>
              </div>

              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block mb-0.5">
                  Security Clearance / Role
                </span>
                <span className="font-bold text-slate-800 px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                  {user?.role}
                </span>
              </div>

              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block mb-0.5">
                  Account Status
                </span>
                <span className="font-bold text-emerald-700 px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">
                  Active Enterprise Account
                </span>
              </div>

              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block mb-0.5">
                  Authentication Providers
                </span>
                <div className="flex gap-1.5 mt-1">
                  {user?.auth_providers?.map((p) => (
                    <span key={p} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10.5px] font-mono">
                      {p}
                    </span>
                  )) || <span className="text-slate-500">PASSWORD</span>}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setProfileModalOpen(false)}
                className="btn btn-secondary text-xs px-4 py-2 font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
