import { Outlet } from 'react-router-dom';

import { HeaderBar } from '../components/layout/HeaderBar';
import { NavTabs } from '../components/layout/NavTabs';
import { ToastStack } from '../components/ToastStack';

export function AppLayout() {
  return (
    <div className="min-h-screen pb-12 text-[var(--text)] app-transition">
      <HeaderBar />

      <main className="mx-auto w-full max-w-[1180px] px-6 lg:px-8">
        <NavTabs />
        <Outlet />
      </main>

      <ToastStack />
    </div>
  );
}
