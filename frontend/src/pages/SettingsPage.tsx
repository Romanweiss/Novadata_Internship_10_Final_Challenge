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
  const { safeMode, setSafeMode } = useAppState();
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
        <h1 className="text-4xl text-[2.1rem] font-extrabold tracking-tight">System Settings</h1>
        <p className="mt-1 text-[0.98rem] text-[var(--text-muted)]">Configure connections and security preferences.</p>
      </section>

      <Card className="border-orange-500/35 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 text-2xl text-[1.8rem] font-bold">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Safe Mode
            </p>
            <p className="mt-2 text-[0.98rem] text-[var(--text-muted)]">
              When enabled, destructive actions (like dropping tables or force-refreshing MART) are blocked.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSafeMode(!safeMode)}
            className={`app-transition relative h-7 w-14 rounded-full border ${
              safeMode ? 'border-orange-500/40 bg-orange-500/25' : 'border-[var(--border)] bg-[var(--surface-muted)]'
            }`}
          >
            <span
              className={`app-transition absolute top-0.5 h-5.5 w-5.5 rounded-full bg-orange-500 shadow ${
                safeMode ? 'left-7' : 'left-1 bg-slate-400'
              }`}
            />
          </button>
        </div>
      </Card>

      <section>
        <h2 className="mb-3 text-3xl text-[1.9rem] font-extrabold tracking-tight">Service Connections</h2>
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
          About ProbablyFresh
        </h2>

        <Card className="mt-3 p-0">
          <p className="border-b border-[var(--border)] px-4 py-4 text-[0.98rem] leading-relaxed text-[var(--text-muted)]">
            ProbablyFresh Control Panel is the centralized management dashboard for observing and operating the data
            platform. It provides real-time visibility into ingestion pipelines, data quality metrics in the MART
            layer, and easy access to analytical exports.
          </p>

          <div className="flex flex-wrap gap-2 px-4 py-3 text-xs font-semibold text-[var(--text-muted)]">
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1">Version: 2.1.0-mock</span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1">Environment: Staging</span>
          </div>
        </Card>
      </section>
    </motion.div>
  );
}
