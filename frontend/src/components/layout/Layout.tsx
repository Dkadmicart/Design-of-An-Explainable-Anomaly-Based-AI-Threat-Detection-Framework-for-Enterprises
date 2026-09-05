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
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100/80 text-slate-900 font-sans antialiased">
      {/* Sidebar Component (flex item with flex-shrink-0) */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* MainArea: occupies 100% of remaining available width with subtle left border separation */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-50 border-l border-slate-200/80">
        <Header
          mode={mode}
          onModeChange={setMode}
          onMobileMenuOpen={() => setMobileOpen(true)}
          sidebarCollapsed={sidebarCollapsed}
          onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Main Content Area with guaranteed 32px-48px left/right gutters via main-content-area */}
        <main className="flex-1 main-content-area overflow-y-auto min-w-0 scroll-smooth">
          <div className="max-w-[1600px] mx-auto space-y-6 lg:space-y-8">
            <Outlet context={{ mode }} />
          </div>
        </main>
      </div>
    </div>
  );
}


