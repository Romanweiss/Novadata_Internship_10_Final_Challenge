import { Outlet, useLocation } from 'react-router-dom';

import { HeaderBar } from '../components/layout/HeaderBar';
import { NavTabs } from '../components/layout/NavTabs';
import { ToastStack } from '../components/ToastStack';

export function AppLayout() {
  const location = useLocation();
  const isDocumentationPage = location.pathname === '/documentation';

  return (
    <div className="min-h-screen pb-6 text-[var(--text)] app-transition">
      <HeaderBar />

      <main className="mx-auto w-full max-w-[1180px] px-6 lg:px-8">
        {!isDocumentationPage && <NavTabs />}
        <Outlet />
      </main>

      <footer className="mx-auto mt-10 w-full max-w-[1180px] px-6 lg:px-8">
        <div className="flex items-center gap-3 pb-4 text-[var(--text-muted)]">
          <span className="text-[0.72rem] font-semibold uppercase tracking-[0.22em]">created by</span>
          <img
            src="/assets/my_glif.png"
            alt="Creator logo"
            className="h-[52px] w-auto rounded-xl object-contain md:h-[58px]"
          />
          <span className="text-sm font-semibold">2026</span>
        </div>
      </footer>

      <ToastStack />
    </div>
  );
}
