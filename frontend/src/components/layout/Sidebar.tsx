import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Radio, Bell, Search, Globe, Shield,
  Target, Brain, BarChart3, Settings, Hexagon, X
} from 'lucide-react';
import clsx from 'clsx';

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
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-200"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container - Relative Flex item in desktop layout */}
      <aside
        className={clsx(
          'bg-white select-none flex flex-col justify-between transition-all duration-200 ease-in-out',
          // Desktop: flex-shrink-0 flex item so collapsing/expanding dynamically repositions MainArea
          'hidden lg:flex relative flex-shrink-0 h-full z-30',
          collapsed ? 'w-[70px]' : 'w-[248px]',
          // Mobile drawer: fixed overlay drawer
          mobileOpen && '!flex fixed inset-y-0 left-0 z-50 w-[260px] shadow-2xl animate-fade-in'
        )}
      >
        {/* Top Section: Brand Header & Navigation */}
        <div className="flex flex-col min-h-0 flex-1">
          {/* Brand Header - Matching Header height exactly (68px) */}
          <div
            className={clsx(
              'flex items-center h-[68px] px-4 border-b border-slate-200/80 flex-shrink-0 bg-white',
              collapsed && !mobileOpen ? 'justify-center' : 'justify-between'
            )}
          >
            <div className="flex items-center gap-3 min-w-0 overflow-hidden">
              <div className="flex items-center justify-center w-9 h-9 bg-[#F5B700] rounded-xl shadow-2xs flex-shrink-0 ring-1 ring-amber-400/50">
                <Hexagon size={20} className="text-slate-950" strokeWidth={2.5} />
              </div>
              {(!collapsed || mobileOpen) && (
                <div className="flex flex-col min-w-0">
                  <span className="text-base font-extrabold text-slate-900 tracking-tight leading-tight truncate">
                    SentinelAI
                  </span>
                  <span className="text-[10px] font-extrabold text-amber-700 tracking-widest uppercase truncate">
                    Enterprise SOC
                  </span>
                </div>
              )}
            </div>

            {/* Mobile Drawer Close Button */}
            <button
              onClick={onMobileClose}
              className="lg:hidden p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-lg cursor-pointer transition-colors"
              aria-label="Close navigation drawer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation Items Grouped by Section */}
          <nav className={clsx('flex-1 py-4 overflow-y-auto space-y-4', collapsed && !mobileOpen ? 'px-3' : 'px-4')}>
            {navSections.map((section, idx) => (
              <div key={section.title} className={clsx('space-y-1', idx > 0 && 'pt-2 border-t border-slate-100')}>
                {/* Section Title Header */}
                {(!collapsed || mobileOpen) && (
                  <h4 className="px-2 text-[10.5px] font-extrabold text-slate-400 tracking-wider uppercase mb-1.5">
                    {section.title}
                  </h4>
                )}

                {section.items.map((item) => (
                  <div key={item.path} className={clsx(collapsed && !mobileOpen && 'tooltip-wrapper')}>
                    <NavLink
                      to={item.path}
                      onClick={onMobileClose}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center gap-3 px-3 rounded-xl text-sm font-semibold h-[40px]',
                          'transition-all duration-150 group w-full relative',
                          collapsed && !mobileOpen ? 'justify-center px-0' : '',
                          isActive
                            ? 'bg-amber-100/70 text-slate-950 font-extrabold shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {/* Active Left Accent Indicator Bar */}
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-5 bg-[#F5B700] rounded-r-md shadow-2xs" />
                          )}

                          {/* Icon Container */}
                          <div className={clsx(
                            'w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0 transition-colors',
                            isActive ? 'text-[#B45309]' : 'text-slate-500 group-hover:text-slate-900'
                          )}>
                            <item.icon size={18} strokeWidth={isActive ? 2.3 : 2} />
                          </div>

                          {/* Navigation Label */}
                          {(!collapsed || mobileOpen) && (
                            <span className="truncate text-xs font-bold tracking-tight">{item.label}</span>
                          )}
                        </>
                      )}
                    </NavLink>

                    {/* Tooltip on Hover when Sidebar Collapsed */}
                    {collapsed && !mobileOpen && (
                      <div className="tooltip-content">
                        {item.label}
                      </div>
                    )}
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

