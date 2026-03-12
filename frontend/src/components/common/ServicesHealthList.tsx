import { Clock4, ServerCog } from 'lucide-react';

import { useAppState } from '../../app/useAppState';
import type { ServiceHealthItem } from '../../types/ui';
import { Card } from '../common/Card';
import { ServiceDot } from '../common/StatusBadge';

export function ServicesHealthList({ items }: { items: ServiceHealthItem[] }) {
  const { t } = useAppState();

  return (
    <Card className="p-5">
      <div className="mb-5 flex items-center gap-2">
        <ServerCog className="h-4 w-4 text-[var(--text-muted)]" />
        <h3 className="text-lg font-bold">{t('overview.servicesHealthTitle')}</h3>
      </div>

      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-2.5 font-medium">
              <ServiceDot status={item.status} />
              {item.name}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
              <Clock4 className="h-3.5 w-3.5" />
              {item.checkedAgo}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
