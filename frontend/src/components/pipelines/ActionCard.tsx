import { motion } from 'framer-motion';
import { Database, FlaskConical, Layers3, Play, Sparkles, Zap } from 'lucide-react';

import type { JobAction } from '../../types/ui';
import { Card } from '../common/Card';

const iconByAction = {
  sparkles: Sparkles,
  database: Database,
  zap: Zap,
  layers: Layers3,
  flask: FlaskConical,
  play: Play,
} as const;

interface ActionCardProps {
  action: JobAction;
  onClick: (action: JobAction) => void;
  selected?: boolean;
}

export function ActionCard({ action, onClick, selected = false }: ActionCardProps) {
  const Icon = iconByAction[action.icon];

  return (
    <motion.button
      type="button"
      onClick={() => onClick(action)}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      className="text-left"
    >
      <Card
        className={`flex h-full items-start gap-4 p-4 ${
          selected ? 'border-[var(--border-strong)] shadow-card' : ''
        }`}
      >
        <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]">
          <Icon className="h-5 w-5" />
        </span>

        <div>
          <h3 className="text-lg font-bold leading-tight">{action.title}</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{action.description}</p>
        </div>
      </Card>
    </motion.button>
  );
}
