import type { JobRunStatus, ServiceHealthStatus } from '../../types/ui';
import { cn } from '../../utils/format';

const jobStyles: Record<JobRunStatus, string> = {
  success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  failed: 'bg-red-500/15 text-red-600 dark:text-red-300',
  running: 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
};

const serviceDot: Record<ServiceHealthStatus, string> = {
  healthy: 'bg-emerald-500',
  warning: 'bg-amber-500',
  offline: 'bg-red-500',
};

interface StatusPillProps {
  status: JobRunStatus;
  children?: React.ReactNode;
}

export function StatusPill({ status, children }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide app-transition',
        jobStyles[status],
      )}
    >
      {children ?? status}
    </span>
  );
}

export function ServiceDot({ status }: { status: ServiceHealthStatus }) {
  return <span className={cn('inline-block h-2.5 w-2.5 rounded-full', serviceDot[status])} />;
}
