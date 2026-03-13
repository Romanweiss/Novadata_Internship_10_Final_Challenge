import { AlertTriangle, ChartSpline, Cloud, Database, Info, Workflow } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

import { useAppState } from '../app/useAppState';
import { apiClient } from '../api/client';
import { mapConnections } from '../api/mappers';
import { Card } from '../components/common/Card';
import { serviceConnections } from '../mocks/data';
import type { ServiceConnection } from '../types/ui';

const iconByConnection = {
  database: Database,
  cloud: Cloud,
  chart: ChartSpline,
  workflow: Workflow,
} as const;

export function SettingsPage() {
  const { safeMode, setSafeMode, t } = useAppState();
  const [connections, setConnections] = useState<ServiceConnection[]>(serviceConnections);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const payload = await apiClient.fetchSettingsConnections();
        if (!mounted) return;
        setConnections(mapConnections(payload));
      } catch {
        // Keep mock connections if backend is unavailable.
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <motion.div
      key="settings"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      <section>
        <h1 className="text-4xl text-[2.1rem] font-extrabold tracking-tight">{t('settings.title')}</h1>
        <p className="mt-1 text-[0.98rem] text-[var(--text-muted)]">{t('settings.subtitle')}</p>
      </section>

      <Card className="border-orange-500/35 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 text-2xl text-[1.8rem] font-bold">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              {t('settings.safeMode')}
            </p>
            <p className="mt-2 text-[0.98rem] text-[var(--text-muted)]">{t('settings.safeModeDescription')}</p>
          </div>

          <button
            type="button"
            onClick={() => setSafeMode(!safeMode)}
            aria-pressed={safeMode}
            aria-label={t('settings.safeMode')}
            className={`app-transition relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border ${
              safeMode
                ? 'border-orange-500/45 bg-orange-500/25'
                : 'border-[var(--border-strong)] bg-[var(--surface-muted)]'
            }`}
          >
            <span
              className={`app-transition pointer-events-none inline-block h-6 w-6 rounded-full shadow ${
                safeMode
                  ? 'translate-x-7 bg-orange-500 shadow-orange-500/35'
                  : 'translate-x-1 bg-slate-400 shadow-slate-500/30 dark:bg-slate-500'
              }`}
            />
          </button>
        </div>
      </Card>

      <section>
        <h2 className="mb-3 text-3xl text-[1.9rem] font-extrabold tracking-tight">{t('settings.serviceConnections')}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {connections.map((item) => {
            const Icon = iconByConnection[item.icon];
            return (
              <Card key={item.key} className="p-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]">
                    <Icon className="h-5 w-5" />
                  </span>

                  <div className="w-full">
                    <p className="text-lg font-bold">{item.title}</p>
                    <div className="mt-1 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-sm text-[var(--text-muted)]">
                      {item.value}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="border-t border-[var(--border)] pt-4">
        <h2 className="inline-flex items-center gap-2 text-[1.8rem] text-3xl font-extrabold tracking-tight">
          <Info className="h-5 w-5" />
          {t('settings.about')}
        </h2>

        <Card className="mt-3 p-0">
          <p className="border-b border-[var(--border)] px-4 py-4 text-[0.98rem] leading-relaxed text-[var(--text-muted)]">
            {t('settings.aboutDescription')}
          </p>

          <div className="flex flex-wrap gap-2 px-4 py-3 text-xs font-semibold text-[var(--text-muted)]">
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1">{t('settings.version')}</span>
          </div>
        </Card>
      </section>
    </motion.div>
  );
}
