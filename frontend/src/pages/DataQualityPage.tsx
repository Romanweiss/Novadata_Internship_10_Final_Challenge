import { BellRing, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';

import { useAppState } from '../app/useAppState';
import { apiClient } from '../api/client';
import { mapDuplicatesTrend, mapMartStats } from '../api/mappers';
import { DuplicatesTrendChart } from '../components/charts/DuplicatesTrendChart';
import { Card } from '../components/common/Card';
import { duplicatesRatio, duplicatesTrend, martQualityRows } from '../mocks/data';
import type { DuplicateTrendPoint, MartQualityRow } from '../types/ui';

function formatDateTime(value: string | null, fallbackText: string): string {
  if (!value) return fallbackText;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function parsePercent(value: string): number {
  return Number(value.replace('%', '').replace(',', '.'));
}

export function DataQualityPage() {
  const { t } = useAppState();
  const [ratioPercent, setRatioPercent] = useState<number>(duplicatesRatio);
  const [targetPercent, setTargetPercent] = useState<number>(10);
  const [qualityStatus, setQualityStatus] = useState<'good' | 'warn' | 'bad'>('good');
  const [lastAlertAt, setLastAlertAt] = useState<string | null>('2026-02-24T14:30:00Z');
  const [telegramEnabled, setTelegramEnabled] = useState<boolean>(true);
  const [trend, setTrend] = useState<DuplicateTrendPoint[]>(duplicatesTrend);
  const [tableRows, setTableRows] = useState<MartQualityRow[]>(martQualityRows);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [overall, trendPayload, martStatsPayload] = await Promise.all([
          apiClient.fetchQualityOverall(),
          apiClient.fetchQualityTrend(10),
          apiClient.fetchMartStats(),
        ]);

        if (!mounted) return;

        setRatioPercent(Number((overall.duplicates_ratio * 100).toFixed(2)));
        setTargetPercent(Number((overall.target_ratio * 100).toFixed(2)));
        setQualityStatus(overall.status);
        setLastAlertAt(overall.last_alert_at);
        setTelegramEnabled(overall.telegram_enabled);
        setTrend(mapDuplicatesTrend(trendPayload.points));
        setTableRows(mapMartStats(martStatsPayload.rows));
      } catch {
        // Keep mock values if backend is unavailable.
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const statusInfo = useMemo(() => {
    if (qualityStatus === 'bad') {
      return {
        title: t('dataQuality.qualityBad'),
        description: t('dataQuality.qualityBadDescription'),
        icon: ShieldX,
      };
    }
    if (qualityStatus === 'warn') {
      return {
        title: t('dataQuality.qualityWarn'),
        description: t('dataQuality.qualityWarnDescription'),
        icon: ShieldAlert,
      };
    }
    return {
      title: t('dataQuality.qualityGood'),
      description: t('dataQuality.qualityGoodDescription'),
      icon: ShieldCheck,
    };
  }, [qualityStatus, t]);

  const progressWidth = Math.min(Math.max(ratioPercent, 0), 100);
  const StatusIcon = statusInfo.icon;

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
              <h3 className="text-[1.75rem] text-2xl font-bold">{t('dataQuality.overallDuplicatesRatio')}</h3>
              <p className="mt-2 text-[3.1rem] text-5xl font-extrabold leading-none">{ratioPercent.toFixed(1)}%</p>

              <div className="mt-4 flex items-center gap-4">
                <div className="h-3 w-full max-w-[380px] overflow-hidden rounded-full bg-[var(--surface-muted)]">
                  <div className="h-full rounded-full bg-[#111827] dark:bg-white" style={{ width: `${progressWidth}%` }} />
                </div>
                <span className="text-sm text-[var(--text-muted)]">{t('dataQuality.target', { value: targetPercent.toFixed(1) })}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4">
              <p className="inline-flex items-center gap-2 text-lg font-bold">
                <StatusIcon className="h-6 w-6 text-emerald-500" />
                {statusInfo.title}
              </p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{statusInfo.description}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-5 flex items-center gap-2">
            <BellRing className="h-4 w-4 text-[var(--text-muted)]" />
            <h3 className="text-xl font-bold">{t('dataQuality.alertStatus')}</h3>
          </div>

          <div className="mb-4 flex items-center justify-between border-b border-[var(--border)] pb-4">
            <p className="font-semibold">{t('dataQuality.telegramAlerts')}</p>
            <span className="inline-flex rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-300">
              {telegramEnabled ? t('dataQuality.enabled') : t('dataQuality.disabled')}
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm text-[var(--text-muted)]">{t('dataQuality.lastAlertTriggered')}</p>
              <p className="mt-1 font-semibold">{formatDateTime(lastAlertAt, t('dataQuality.noAlerts'))}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-muted)]">
              {t('dataQuality.alertRuleText')}
            </div>
          </div>
        </Card>
      </section>

      <Card className="p-5">
        <h3 className="mb-3 text-xl font-bold">{t('dataQuality.duplicatesTrend')}</h3>
        <DuplicatesTrendChart data={trend} />
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h3 className="text-xl font-bold">{t('dataQuality.martQualityStats')}</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--surface-muted)] text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">{t('dataQuality.entity')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('dataQuality.totalRaw')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('dataQuality.validMart')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('dataQuality.duplicates')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('dataQuality.invalid')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('dataQuality.ratio')}</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => {
                const ratioValue = parsePercent(row.ratio);
                const ratioClass =
                  ratioValue >= 10
                    ? 'bg-red-500/15 text-red-700 dark:text-red-300'
                    : ratioValue >= 5
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';

                return (
                  <tr key={row.entity} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3 font-semibold">{row.entity}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.totalRaw}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-300">{row.validMart}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-orange-600 dark:text-orange-300">{row.duplicates}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-600 dark:text-red-300">{row.invalid}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex rounded-full px-2.5 py-1 font-semibold ${ratioClass}`}>{row.ratio}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </motion.div>
  );
}
