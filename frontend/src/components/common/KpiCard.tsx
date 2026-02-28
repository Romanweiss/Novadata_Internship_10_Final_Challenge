import { motion } from 'framer-motion';
import { Layers3, ShoppingCart, Stethoscope, UsersRound } from 'lucide-react';

import { useAppState } from '../../app/useAppState';
import type { KPIItem } from '../../types/ui';
import { Card } from './Card';

const iconByKey = {
  store: ShoppingCart,
  pulse: Stethoscope,
  users: UsersRound,
  layers: Layers3,
} as const;

export function KpiCard({ item, index }: { item: KPIItem; index: number }) {
  const Icon = iconByKey[item.icon];
  const { t } = useAppState();
  const translatedTitle = t(`kpi.${item.key}`);

  return (
    <motion.div
      className="group"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.22 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
    >
      <Card className="p-5 group-hover:border-[var(--border-strong)] group-hover:shadow-[0_16px_34px_-24px_rgba(15,23,42,0.42)] group-hover:dark:shadow-[0_18px_36px_-24px_rgba(0,0,0,0.82)]">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-medium text-[var(--text-muted)]">
            {translatedTitle === `kpi.${item.key}` ? item.title : translatedTitle}
          </p>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]">
            <Icon className="h-4 w-4" />
          </span>
        </div>

        <div className="flex items-end justify-between gap-2">
          <p className="text-4xl text-[2.2rem] font-extrabold leading-none">{item.value}</p>

          <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-300">
            ? {item.change}
          </span>
        </div>
      </Card>
    </motion.div>
  );
}
