import { Activity, Clock4 } from 'lucide-react';

import { useAppState } from '../../app/useAppState';
import type { JobRun } from '../../types/ui';
import { formatRelativeTime } from '../../utils/format';
import { Card } from '../common/Card';
import { StatusPill } from '../common/StatusBadge';

export function LastRunsList({ runs, compact = false }: { runs: JobRun[]; compact?: boolean }) {
  const { t } = useAppState();

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-4 w-4 text-[var(--text-muted)]" />
        <h3 className="text-lg font-bold">{t('overview.lastRunsTitle')}</h3>
      </div>

      <div className={compact ? 'space-y-3' : 'space-y-2.5'}>
        {runs.map((run) => {
          const localizedName = t(`jobs.${run.key}`);
          const localizedStatus = t(`status.${run.status}`);
          return (
            <div
              key={run.id}
              className="app-transition flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-semibold">
                  {localizedName === `jobs.${run.key}` ? run.name : localizedName}
                </p>
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                  <Clock4 className="h-3 w-3" />
                  {formatRelativeTime(run.startedAt)}
                </p>
              </div>
              <StatusPill status={run.status}>
                {localizedStatus === `status.${run.status}` ? run.status : localizedStatus}
              </StatusPill>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
