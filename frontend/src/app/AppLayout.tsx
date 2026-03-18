import { Outlet, useLocation } from 'react-router-dom';

import { HeaderBar } from '../components/layout/HeaderBar';
import { NavTabs } from '../components/layout/NavTabs';
import { ToastStack } from '../components/ToastStack';

export function AppLayout() {
  const location = useLocation();
  const isDocumentationPage = location.pathname === '/documentation';

  return (
    <div className="min-h-screen pb-12 text-[var(--text)] app-transition">
      <HeaderBar />

      <main className="mx-auto w-full max-w-[1180px] px-6 lg:px-8">
        {!isDocumentationPage && <NavTabs />}
        <Outlet />
      </main>

      <ToastStack />
    </div>
  );
}
