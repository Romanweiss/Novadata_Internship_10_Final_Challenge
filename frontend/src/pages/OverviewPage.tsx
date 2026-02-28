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
import { ingestionSeries, kpiItems, paymentBreakdown, serviceHealth } from '../mocks/data';
import type { IngestionPoint, KPIItem, PaymentBreakdownItem, ServiceHealthItem } from '../types/ui';

export function OverviewPage() {
  const { lastRuns, t } = useAppState();
  const [kpis, setKpis] = useState<KPIItem[]>(kpiItems);
  const [ingestion, setIngestion] = useState<IngestionPoint[]>(ingestionSeries);
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

      setKpis(mapKpisToCards(kpiPayload));
      setIngestion(mapIngestionSeries(ingestionPayload.points));
      setServices(mapServicesHealth(servicePayload.services));
      setPayments(mapPayments(paymentPayload.items));
    } catch {
      // Fallback to local mocks if API is unavailable or auth is missing.
    }
  }, []);

  useEffect(() => {
    const mounted = { current: true };
    void fetchOverviewData(mounted);

    const timer = window.setInterval(() => {
      void fetchOverviewData(mounted);
    }, 10_000);

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
          <IngestionAreaChart data={ingestion} />
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
