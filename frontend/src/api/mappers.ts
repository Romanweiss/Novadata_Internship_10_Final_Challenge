import type {
  ApiConnections,
  ApiExportItem,
  ApiIngestionPoint,
  ApiMartStatsRow,
  ApiOverviewKpis,
  ApiPaymentItem,
  ApiQualityTrendPoint,
  ApiRun,
  ApiServiceHealth,
} from './client';
import type {
  DuplicateTrendPoint,
  ExportFile,
  IngestionPoint,
  JobRun,
  KPIItem,
  MartQualityRow,
  PaymentBreakdownItem,
  ServiceConnection,
  ServiceHealthItem,
} from '../types/ui';

function formatCompactDelta(value: number | undefined): string {
  const number = value ?? 0;
  const abs = Math.abs(number);
  if (abs >= 1_000_000) return `${number > 0 ? '+' : ''}${(number / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${number > 0 ? '+' : ''}${Math.round(number / 1000)}K`;
  return `${number > 0 ? '+' : ''}${number}`;
}

function formatDisplayNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return String(value);
}

function toWeekdayLabel(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  return date.toLocaleDateString(undefined, { weekday: 'short' });
}

function toRelativeCheckedAgo(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return 'n/a';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function mapServiceStatus(status: ApiServiceHealth['status']): ServiceHealthItem['status'] {
  if (status === 'ok') return 'healthy';
  if (status === 'warn') return 'warning';
  return 'offline';
}

function mapJobStatus(status: ApiRun['status']): JobRun['status'] {
  if (status === 'failed') return 'failed';
  if (status === 'success') return 'success';
  return 'running';
}

function formatSpacedInt(value: number): string {
  return value.toLocaleString('ru-RU').replace(/\u00A0/g, ' ');
}

function formatSize(sizeBytes: number): string {
  if (sizeBytes >= 1024 * 1024 * 1024) return `${(sizeBytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (sizeBytes >= 1024 * 1024) return `${Math.round(sizeBytes / 1024 / 1024)} MB`;
  if (sizeBytes >= 1024) return `${Math.round(sizeBytes / 1024)} KB`;
  return `${sizeBytes} B`;
}

export function mapKpisToCards(kpis: ApiOverviewKpis): KPIItem[] {
  return [
    {
      key: 'stores',
      title: 'Stores (uniq)',
      value: formatDisplayNumber(kpis.stores_uniq),
      change: formatCompactDelta(kpis.deltas?.stores_uniq),
      icon: 'store',
    },
    {
      key: 'purchases',
      title: 'Purchases (uniq)',
      value: formatDisplayNumber(kpis.purchases_uniq),
      change: formatCompactDelta(kpis.deltas?.purchases_uniq),
      icon: 'pulse',
    },
    {
      key: 'customers',
      title: 'Customers (mart)',
      value: formatDisplayNumber(kpis.customers_mart),
      change: formatCompactDelta(kpis.deltas?.customers_mart),
      icon: 'users',
    },
    {
      key: 'items',
      title: 'Items (mart)',
      value: formatDisplayNumber(kpis.items_mart),
      change: formatCompactDelta(kpis.deltas?.items_mart),
      icon: 'layers',
    },
  ];
}

export function mapIngestionSeries(points: ApiIngestionPoint[]): IngestionPoint[] {
  return points.map((point) => ({
    day: toWeekdayLabel(point.day),
    rows: point.rows,
  }));
}

export function mapServicesHealth(items: ApiServiceHealth[]): ServiceHealthItem[] {
  return items.map((item) => ({
    id: item.name.toLowerCase().replace(/\s+/g, '-'),
    name: item.name,
    status: mapServiceStatus(item.status),
    checkedAgo: toRelativeCheckedAgo(item.checked_at),
  }));
}

const paymentColors = {
  card: '#2563eb',
  cash: '#60a5fa',
  sbp: '#3b82f6',
  other: '#93c5fd',
} as const;

export function mapPayments(items: ApiPaymentItem[]): PaymentBreakdownItem[] {
  return items.map((item) => {
    const method = (item.method || 'other').toLowerCase();
    return {
      id: method,
      method: method.toUpperCase() === 'SBP' ? 'SBP' : method.charAt(0).toUpperCase() + method.slice(1),
      value: Math.round((item.share || 0) * 100),
      color: paymentColors[method as keyof typeof paymentColors] ?? paymentColors.other,
    };
  });
}

export function mapRun(run: ApiRun): JobRun {
  return {
    id: run.id,
    key: run.job_name,
    name: run.job_name,
    status: mapJobStatus(run.status),
    startedAt: new Date(run.started_at || run.created_at).getTime(),
  };
}

export function mapRuns(runs: ApiRun[]): JobRun[] {
  return runs.map(mapRun);
}

export function mapDuplicatesTrend(points: ApiQualityTrendPoint[]): DuplicateTrendPoint[] {
  return points.map((point) => ({ run: `Run ${point.run}`, ratio: Number((point.ratio * 100).toFixed(2)) }));
}

export function mapMartStats(rows: ApiMartStatsRow[]): MartQualityRow[] {
  return rows.map((row) => ({
    entity: row.entity,
    totalRaw: formatSpacedInt(row.total_raw),
    validMart: formatSpacedInt(row.valid_mart),
    duplicates: formatSpacedInt(row.duplicates),
    invalid: formatSpacedInt(row.invalid),
    ratio: `${(row.ratio * 100).toFixed(1)}%`,
  }));
}

export function mapExports(items: ApiExportItem[]): ExportFile[] {
  return items.map((item) => ({
    id: item.key,
    filename: item.filename,
    date: item.date ?? '-',
    rows: item.rows === null ? '-' : formatSpacedInt(item.rows),
    size: formatSize(item.size_bytes),
    status: item.status === 'ready' ? 'Ready' : 'Processing',
    key: item.key,
  }));
}

export function mapConnections(payload: ApiConnections): ServiceConnection[] {
  return [
    { key: 'ch', title: 'ClickHouse JDBC', value: payload.clickhouse_jdbc, icon: 'database' },
    { key: 'minio', title: 'S3 / MinIO Endpoint', value: payload.minio_endpoint, icon: 'cloud' },
    { key: 'grafana', title: 'Grafana URL', value: payload.grafana_url, icon: 'chart' },
    { key: 'airflow', title: 'Airflow URL', value: payload.airflow_url, icon: 'workflow' },
  ];
}
