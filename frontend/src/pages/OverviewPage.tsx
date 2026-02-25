import { motion } from 'framer-motion';

import { IngestionAreaChart } from '../components/charts/IngestionAreaChart';
import { PaymentDonutChart } from '../components/charts/PaymentDonutChart';
import { Card } from '../components/common/Card';
import { KpiCard } from '../components/common/KpiCard';
import { LastRunsList } from '../components/common/LastRunsList';
import { ServicesHealthList } from '../components/common/ServicesHealthList';
import { useAppState } from '../app/useAppState';
import { ingestionSeries, kpiItems, paymentBreakdown, serviceHealth } from '../mocks/data';

export function OverviewPage() {
  const { lastRuns } = useAppState();

  return (
    <motion.div
      key="overview"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpiItems.map((item, idx) => (
          <KpiCard key={item.key} item={item} index={idx} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <Card className="p-5">
          <h3 className="mb-2 text-xl font-bold">Ingestion Activity (Last 7 Days)</h3>
          <IngestionAreaChart data={ingestionSeries} />
        </Card>

        <ServicesHealthList items={serviceHealth} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <Card className="p-5">
          <h3 className="mb-4 text-xl font-bold">Purchases by Payment Method</h3>
          <PaymentDonutChart data={paymentBreakdown} />
        </Card>

        <LastRunsList runs={lastRuns.slice(0, 5)} compact />
      </section>
    </motion.div>
  );
}
