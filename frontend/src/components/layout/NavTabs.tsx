import { Download, Gauge, Settings, ShieldAlert, Table2, Workflow } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { useAppState } from '../../app/useAppState';
import { navItems } from '../../mocks/data';
import { cn } from '../../utils/format';

const iconByKey = {
  overview: Gauge,
  pipelines: Workflow,
  'data-quality': ShieldAlert,
  'feature-mart': Table2,
  exports: Download,
  settings: Settings,
} as const;

export function NavTabs() {
  const { t } = useAppState();

  return (
    <nav className="mb-8 mt-8 inline-flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-card app-transition">
      {navItems.map((item) => {
        const Icon = iconByKey[item.key];
        return (
          <NavLink
            key={item.key}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              cn(
                'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold app-transition',
                isActive
                  ? 'bg-[#111827] text-white shadow-md dark:bg-white dark:text-[#0f172a]'
                  : 'text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/10',
              )
            }
          >
            <Icon className="h-4 w-4" />
            {t(`nav.${item.key}`)}
          </NavLink>
        );
      })}
    </nav>
  );
}
