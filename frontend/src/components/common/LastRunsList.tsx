import { Activity, Clock4 } from 'lucide-react';

import type { JobRun } from '../../types/ui';
import { formatRelativeTime } from '../../utils/format';
import { Card } from '../common/Card';
import { StatusPill } from '../common/StatusBadge';

export function LastRunsList({ runs, compact = false }: { runs: JobRun[]; compact?: boolean }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-4 w-4 text-[var(--text-muted)]" />
        <h3 className="text-lg font-bold">Last Runs</h3>
      </div>

      <div className={compact ? 'space-y-3' : 'space-y-2.5'}>
        {runs.map((run) => (
          <div
            key={run.id}
            className="app-transition flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5"
          >
            <div>
              <p className="text-sm font-semibold">{run.name}</p>
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                <Clock4 className="h-3 w-3" />
                {formatRelativeTime(run.startedAt)}
              </p>
            </div>
            <StatusPill status={run.status}>{run.status}</StatusPill>
          </div>
        ))}
      </div>
    </Card>
  );
}
