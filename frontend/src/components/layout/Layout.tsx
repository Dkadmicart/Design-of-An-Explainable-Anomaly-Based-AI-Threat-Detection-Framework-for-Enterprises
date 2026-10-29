import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import type { EnvironmentMode } from '../../types';

const STORAGE_KEY = 'sentinelai_sidebar_collapsed';

export default function Layout() {
  // Read initial collapsed state from localStorage
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const [mobileOpen, setMobileOpen] = useState(false);
  const [mode, setMode] = useState<EnvironmentMode>('replay');

  // Persist sidebar state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sidebarCollapsed));
    } catch {
      // Ignore storage errors
    }
  }, [sidebarCollapsed]);

  return (
    <div className="flex w-full h-screen max-h-screen overflow-hidden overflow-x-hidden bg-[var(--color-bg-base)] text-[var(--color-text-main)] font-sans antialiased selection:bg-amber-400 selection:text-slate-950">
      {/* Sidebar Component (Fixed in viewport, non-scrollable horizontally) */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* MainArea: occupies 100% of remaining available width, header stays fixed, only content scrolls */}
      <div className="flex-1 flex flex-col min-w-0 h-screen max-h-screen overflow-hidden overflow-x-hidden bg-[var(--color-bg-content)]">
        <Header
          mode={mode}
          onModeChange={setMode}
          onMobileMenuOpen={() => setMobileOpen(true)}
          sidebarCollapsed={sidebarCollapsed}
          onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Main Content Area - ONLY this panel scrolls vertically */}
        <main className="flex-1 min-w-0 h-full main-content-area overflow-y-auto overflow-x-hidden scroll-smooth">
          <div className="w-full max-w-[1600px] mx-auto space-y-6 lg:space-y-8 min-w-0">
            <Outlet context={{ mode }} />
          </div>
        </main>
      </div>
    </div>
  );
}


