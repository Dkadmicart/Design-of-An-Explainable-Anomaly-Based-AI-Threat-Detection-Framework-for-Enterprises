import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Radio, Bell, Search, Globe, Shield,
  Target, Brain, BarChart3, Settings, Hexagon, X
} from 'lucide-react';
import clsx from 'clsx';
import { useTheme } from '../../context/ThemeContext';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'MAIN',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/live-monitor', label: 'Live Monitor', icon: Radio },
      { path: '/alerts', label: 'Alerts', icon: Bell },
      { path: '/investigate', label: 'Investigate', icon: Search },
      { path: '/network-events', label: 'Network Events', icon: Globe },
    ],
  },
  {
    title: 'SECURITY',
    items: [
      { path: '/threat-intelligence', label: 'Threat Intelligence', icon: Shield },
      { path: '/mitre', label: 'MITRE ATT&CK', icon: Target },
    ],
  },
  {
    title: 'AI & ANALYTICS',
    items: [
      { path: '/models', label: 'Models', icon: Brain },
      { path: '/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { path: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({
  collapsed,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const { isLight } = useTheme();

  // ESC key listener for mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) {
        onMobileClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onMobileClose]);

  return (
    <>
      {/* Mobile Drawer Overlay Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-200"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container - Fixed on the left, non-scrollable horizontally */}
      <aside
        className={clsx(
          'bg-[var(--color-bg-sidebar)] select-none flex flex-col justify-between transition-all duration-200 ease-in-out',
          // Desktop: fixed viewport height, flex-shrink-0, zero horizontal scroll
          'hidden lg:flex flex-shrink-0 h-screen max-h-screen z-30 border-r border-[var(--color-border-base)] overflow-hidden',
          collapsed ? 'w-[72px]' : 'w-[270px]',
          // Mobile drawer: fixed overlay drawer
          mobileOpen && '!flex fixed inset-y-0 left-0 z-50 w-[280px] shadow-2xl animate-fade-in overflow-hidden'
        )}
      >
        {/* Top Section: Brand Header & Navigation */}
        <div className="flex flex-col min-h-0 h-full flex-1 overflow-hidden">
          {/* Brand Header - Matching Header height exactly (70px) */}
          <div className="flex items-center h-[70px] px-3 border-b border-[var(--color-border-base)] flex-shrink-0 bg-[var(--color-bg-sidebar)] justify-between overflow-hidden">
            <div className="flex items-center min-w-0 flex-1">
              {/* Fixed Logo Anchor Slot (Center locked at X = 36px) */}
              <div className="w-[48px] h-[48px] flex items-center justify-center flex-shrink-0">
                <div className="flex items-center justify-center w-9 h-9 bg-[#F5B700] rounded-xl shadow-2xs flex-shrink-0 ring-1 ring-amber-400/50">
                  <Hexagon size={20} className="text-slate-950" strokeWidth={2.5} />
                </div>
              </div>

              {/* Brand Text: Smoothly reveals/collapses without layout shift */}
              <div
                className={clsx(
                  'flex flex-col min-w-0 transition-all duration-200 ease-in-out overflow-hidden',
                  collapsed && !mobileOpen
                    ? 'w-0 opacity-0 pointer-events-none'
                    : 'w-auto opacity-100 flex-1 ml-2'
                )}
              >
                <span className="text-base font-extrabold text-[var(--color-text-main)] tracking-tight leading-tight truncate whitespace-nowrap">
                  SentinelAI
                </span>
                <span className="text-[10px] font-extrabold text-amber-500 tracking-widest uppercase truncate whitespace-nowrap">
                  Enterprise SOC
                </span>
              </div>
            </div>

            {/* Mobile Drawer Close Button */}
            {mobileOpen && (
              <button
                onClick={onMobileClose}
                className="lg:hidden p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-main)] rounded-lg cursor-pointer transition-colors flex-shrink-0 ml-1"
                aria-label="Close navigation drawer"
              >
                <X size={20} />
              </button>
            )}
          </div>

          {/* Navigation Items Grouped by Section */}
          <nav className="flex-1 py-3 px-3 overflow-y-auto overflow-x-hidden space-y-3.5 min-h-0">
            {navSections.map((section, idx) => (
              <div key={section.title} className={clsx('space-y-1', idx > 0 && 'pt-2.5 border-t border-[var(--color-border-subtle)]')}>
                {/* Section Title Header: Smoothly transitions height without abrupt layout jump */}
                <div
                  className={clsx(
                    'transition-all duration-200 ease-in-out overflow-hidden',
                    collapsed && !mobileOpen
                      ? 'h-0 opacity-0 my-0'
                      : 'h-auto opacity-100 mb-1.5 mt-1'
                  )}
                >
                  <h4 className="px-3 text-[10.5px] font-extrabold text-[var(--color-text-muted)] tracking-wider uppercase truncate whitespace-nowrap">
                    {section.title}
                  </h4>
                </div>

                {section.items.map((item) => (
                  <div key={item.path} className="w-full relative min-w-0">
                    <NavLink
                      to={item.path}
                      onClick={onMobileClose}
                      title={collapsed && !mobileOpen ? item.label : undefined}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center rounded-xl text-sm font-semibold h-[44px] w-full relative select-none min-w-0',
                          'transition-colors duration-150 group overflow-hidden',
                          isActive
                            ? isLight
                              ? 'bg-amber-100/90 text-slate-950 font-extrabold shadow-2xs ring-1 ring-amber-300/60'
                              : 'bg-amber-500/15 text-amber-400 font-extrabold shadow-2xs ring-1 ring-amber-500/30'
                            : isLight
                              ? 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-950'
                              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {/* Active Left Accent Indicator Bar */}
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#F5B700] rounded-r-md shadow-2xs" />
                          )}

                          {/* Fixed Icon Anchor Slot (Width locked at 48px, Center locked at X = 36px) */}
                          <div className="w-[48px] h-[44px] flex items-center justify-center flex-shrink-0">
                            <div
                              className={clsx(
                                'w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0 transition-colors',
                                isActive
                                  ? isLight ? 'text-[#B45309]' : 'text-amber-400'
                                  : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-main)]'
                              )}
                            >
                              <item.icon size={18} strokeWidth={isActive ? 2.3 : 2} />
                            </div>
                          </div>

                          {/* Navigation Label: Horizontally aligned beside icon, no line wrapping */}
                          <div
                            className={clsx(
                              'flex items-center min-w-0 transition-all duration-200 ease-in-out overflow-hidden',
                              collapsed && !mobileOpen
                                ? 'w-0 opacity-0 pointer-events-none'
                                : 'w-auto opacity-100 flex-1 pr-3'
                            )}
                          >
                            <span className="truncate text-xs font-bold tracking-tight whitespace-nowrap">
                              {item.label}
                            </span>
                          </div>
                        </>
                      )}
                    </NavLink>
                  </div>
                ))}
              </div>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}

