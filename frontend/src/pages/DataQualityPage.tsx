import { BellRing, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

import { Card } from '../components/common/Card';
import { DuplicatesTrendChart } from '../components/charts/DuplicatesTrendChart';
import { duplicatesRatio, duplicatesTrend, martQualityRows } from '../mocks/data';

export function DataQualityPage() {
  return (
    <motion.div
      key="data-quality"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-5"
    >
      <section className="grid gap-5 xl:grid-cols-[1fr_330px]">
        <Card className="border-l-4 border-l-emerald-500 p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_240px] lg:items-center">
            <div>
              <h3 className="text-[1.75rem] text-2xl font-bold">Overall Duplicates Ratio</h3>
              <p className="mt-2 text-[3.1rem] text-5xl font-extrabold leading-none">{duplicatesRatio.toFixed(1)}%</p>

              <div className="mt-4 flex items-center gap-4">
                <div className="h-3 w-full max-w-[380px] overflow-hidden rounded-full bg-[var(--surface-muted)]">
                  <div className="h-full rounded-full bg-[#111827] dark:bg-white" style={{ width: `${duplicatesRatio}%` }} />
                </div>
                <span className="text-sm text-[var(--text-muted)]">Target: &lt; 10%</span>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4">
              <p className="inline-flex items-center gap-2 text-lg font-bold">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                Quality is Good
              </p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">The current duplication ratio is within acceptable limits.</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-5 flex items-center gap-2">
            <BellRing className="h-4 w-4 text-[var(--text-muted)]" />
            <h3 className="text-xl font-bold">Alert Status</h3>
          </div>

          <div className="mb-4 flex items-center justify-between border-b border-[var(--border)] pb-4">
            <p className="font-semibold">Telegram Alerts</p>
            <span className="inline-flex rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-300">
              ENABLED
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm text-[var(--text-muted)]">Last Alert Triggered</p>
              <p className="mt-1 font-semibold">2026-02-24 14:30:00</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-muted)]">
              Alerts are dispatched when ratio exceeds 10% for 2 consecutive runs.
            </div>
          </div>
        </Card>
      </section>

      <Card className="p-5">
        <h3 className="mb-3 text-xl font-bold">Duplicates Trend (Last 10 runs)</h3>
        <DuplicatesTrendChart data={duplicatesTrend} />
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h3 className="text-xl font-bold">MART Quality Stats</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--surface-muted)] text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Entity</th>
                <th className="px-4 py-3 text-right font-semibold">Total Raw</th>
                <th className="px-4 py-3 text-right font-semibold">Valid MART</th>
                <th className="px-4 py-3 text-right font-semibold">Duplicates</th>
                <th className="px-4 py-3 text-right font-semibold">Invalid</th>
                <th className="px-4 py-3 text-right font-semibold">Ratio</th>
              </tr>
            </thead>
            <tbody>
              {martQualityRows.map((row) => (
                <tr key={row.entity} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-semibold">{row.entity}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.totalRaw}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-300">{row.validMart}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-orange-600 dark:text-orange-300">{row.duplicates}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-600 dark:text-red-300">{row.invalid}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 font-semibold text-emerald-700 dark:text-emerald-300">
                      {row.ratio}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </motion.div>
  );
}
