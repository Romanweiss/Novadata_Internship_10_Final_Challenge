import { motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';

import { useAppState } from '../app/useAppState';
import { apiClient } from '../api/client';
import { mapIngestionSeries, mapKpisToCards, mapPayments, mapServicesHealth } from '../api/mappers';
import { IngestionAreaChart } from '../components/charts/IngestionAreaChart';
import { PaymentDonutChart } from '../components/charts/PaymentDonutChart';
import { Card } from '../components/common/Card';
import { KpiCard } from '../components/common/KpiCard';
import { LastRunsList } from '../components/common/LastRunsList';
import { ServicesHealthList } from '../components/common/ServicesHealthList';
import { kpiItems, paymentBreakdown, serviceHealth } from '../mocks/data';
import type { IngestionPoint, KPIItem, PaymentBreakdownItem, ServiceHealthItem } from '../types/ui';

const OVERVIEW_REFRESH_MS = 45_000;

function areKpisEqual(left: KPIItem[], right: KPIItem[]) {
  return (
    left.length === right.length &&
    left.every(
      (item, idx) =>
        item.key === right[idx]?.key &&
        item.title === right[idx]?.title &&
        item.value === right[idx]?.value &&
        item.change === right[idx]?.change &&
        item.icon === right[idx]?.icon,
    )
  );
}

function areIngestionPointsEqual(left: IngestionPoint[], right: IngestionPoint[]) {
  return (
    left.length === right.length &&
    left.every(
      (point, idx) =>
        point.day === right[idx]?.day &&
        point.rows === right[idx]?.rows &&
        point.dateLabel === right[idx]?.dateLabel &&
        point.yearLabel === right[idx]?.yearLabel,
    )
  );
}

function areServicesEqual(left: ServiceHealthItem[], right: ServiceHealthItem[]) {
  return (
    left.length === right.length &&
    left.every(
      (item, idx) =>
        item.id === right[idx]?.id &&
        item.name === right[idx]?.name &&
        item.status === right[idx]?.status &&
        item.checkedAgo === right[idx]?.checkedAgo,
    )
  );
}

function arePaymentsEqual(left: PaymentBreakdownItem[], right: PaymentBreakdownItem[]) {
  return (
    left.length === right.length &&
    left.every(
      (item, idx) =>
        item.id === right[idx]?.id &&
        item.method === right[idx]?.method &&
        item.count === right[idx]?.count &&
        item.value === right[idx]?.value &&
        item.color === right[idx]?.color,
    )
  );
}

export function OverviewPage() {
  const { language, lastRuns, t } = useAppState();
  const [kpis, setKpis] = useState<KPIItem[]>(kpiItems);
  const [ingestion, setIngestion] = useState<IngestionPoint[] | null>(null);
  const [ingestionLoading, setIngestionLoading] = useState(true);
  const [services, setServices] = useState<ServiceHealthItem[]>(serviceHealth);
  const [payments, setPayments] = useState<PaymentBreakdownItem[]>(paymentBreakdown);

  const fetchOverviewData = useCallback(async (mountedRef?: { current: boolean }) => {
    try {
      const [kpiPayload, ingestionPayload, servicePayload, paymentPayload] = await Promise.all([
        apiClient.fetchOverviewKpis(),
        apiClient.fetchIngestionSeries(7),
        apiClient.fetchServicesHealth(),
        apiClient.fetchPaymentsBreakdown(7),
      ]);

      if (mountedRef && !mountedRef.current) return;

      const nextKpis = mapKpisToCards(kpiPayload);
      const nextIngestion = mapIngestionSeries(ingestionPayload.points);
      const nextServices = mapServicesHealth(servicePayload.services);
      const nextPayments = mapPayments(paymentPayload.items);

      setKpis((current) => (areKpisEqual(current, nextKpis) ? current : nextKpis));
      setIngestion((current) => (current && areIngestionPointsEqual(current, nextIngestion) ? current : nextIngestion));
      setIngestionLoading(false);
      setServices((current) => (areServicesEqual(current, nextServices) ? current : nextServices));
      setPayments((current) => (arePaymentsEqual(current, nextPayments) ? current : nextPayments));
    } catch {
      if (mountedRef?.current) {
        setIngestionLoading(false);
      }
      // Fallback to local mocks if API is unavailable or auth is missing.
    }
  }, []);

  useEffect(() => {
    const mounted = { current: true };
    void fetchOverviewData(mounted);

    const timer = window.setInterval(() => {
      void fetchOverviewData(mounted);
    }, OVERVIEW_REFRESH_MS);

    return () => {
      mounted.current = false;
      window.clearInterval(timer);
    };
  }, [fetchOverviewData]);

  return (
    <motion.div
      key="overview"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item, idx) => (
          <KpiCard key={item.key} item={item} index={idx} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <Card className="p-5">
          <h3 className="mb-2 text-xl font-bold">{t('overview.ingestionTitle')}</h3>
          {ingestion ? (
            <IngestionAreaChart data={ingestion} />
          ) : ingestionLoading ? (
            <div className="space-y-4 pt-2">
              <div className="h-3 w-40 animate-pulse rounded-full bg-[var(--surface-muted)]" />
              <div className="h-[332px] animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/75" />
            </div>
          ) : (
            <div className="flex h-[356px] items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)]/45 px-6 text-center text-sm leading-6 text-[var(--text-muted)]">
              {language === 'ru'
                ? 'Данные по активности загрузки пока недоступны.'
                : 'Ingestion activity data is currently unavailable.'}
            </div>
          )}
        </Card>

        <ServicesHealthList items={services} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <Card className="p-5">
          <h3 className="mb-4 text-xl font-bold">{t('overview.paymentsTitle')}</h3>
          <PaymentDonutChart data={payments} />
        </Card>

        <LastRunsList runs={lastRuns.slice(0, 5)} compact />
      </section>
    </motion.div>
  );
}
