import { motion } from 'framer-motion';
import { Database, FlaskConical, Layers3, Play, Sparkles, Zap } from 'lucide-react';

import { useAppState } from '../../app/useAppState';
import type { JobAction } from '../../types/ui';
import { cn } from '../../utils/format';
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
  disabled?: boolean;
  disabledReason?: string;
}

export function ActionCard({ action, onClick, selected = false, disabled = false, disabledReason }: ActionCardProps) {
  const Icon = iconByAction[action.icon];
  const { t } = useAppState();

  const title = t(`actions.${action.key}.title`);
  const description = t(`actions.${action.key}.description`);

  return (
    <motion.button
      type="button"
      onClick={() => {
        if (disabled) return;
        onClick(action);
      }}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      whileHover={disabled ? undefined : { y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.99 }}
      className={cn('group text-left app-transition', disabled && 'cursor-not-allowed opacity-65')}
    >
      <Card
        className={cn(
          'flex h-full items-start gap-4 p-4 app-transition',
          'group-hover:border-[var(--border-strong)] group-hover:shadow-[0_16px_36px_-24px_rgba(15,23,42,0.45)]',
          'group-hover:dark:shadow-[0_18px_38px_-24px_rgba(0,0,0,0.82)]',
          selected && 'border-[var(--border-strong)] shadow-card',
        )}
      >
        <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]">
          <Icon className="h-5 w-5" />
        </span>

        <div>
          <h3 className="text-lg font-bold leading-tight">{title === `actions.${action.key}.title` ? action.title : title}</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {description === `actions.${action.key}.description` ? action.description : description}
          </p>
        </div>
      </Card>
    </motion.button>
  );
}
