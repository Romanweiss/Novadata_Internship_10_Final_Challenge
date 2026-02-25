import type {
  DuplicateTrendPoint,
  ExportFile,
  IngestionPoint,
  JobAction,
  JobRun,
  KPIItem,
  MartQualityRow,
  PaymentBreakdownItem,
  ServiceConnection,
  ServiceHealthItem,
} from '../types/ui';

export const navItems = [
  { key: 'overview', label: 'Overview', path: '/' },
  { key: 'pipelines', label: 'Pipelines', path: '/pipelines' },
  { key: 'data-quality', label: 'Data Quality', path: '/data-quality' },
  { key: 'exports', label: 'Exports', path: '/exports' },
  { key: 'settings', label: 'Settings', path: '/settings' },
] as const;

export const kpiItems: KPIItem[] = [
  { key: 'stores', title: 'Stores (uniq)', value: '45', change: '+2', icon: 'store' },
  { key: 'purchases', title: 'Purchases (uniq)', value: '2.4M', change: '+15K', icon: 'pulse' },
  { key: 'customers', title: 'Customers (mart)', value: '840K', change: '+3K', icon: 'users' },
  { key: 'items', title: 'Items (mart)', value: '480', change: '0', icon: 'layers' },
];

export const ingestionSeries: IngestionPoint[] = [
  { day: 'Thu', rows: 530000 },
  { day: 'Fri', rows: 545000 },
  { day: 'Sat', rows: 417523 },
  { day: 'Sun', rows: 185000 },
  { day: 'Mon', rows: 592300 },
  { day: 'Tue', rows: 518200 },
  { day: 'Wed', rows: 372900 },
];

export const serviceHealth: ServiceHealthItem[] = [
  { id: 'ch', name: 'ClickHouse', status: 'healthy', checkedAgo: '2s ago' },
  { id: 'kafka', name: 'Kafka', status: 'healthy', checkedAgo: '5s ago' },
  { id: 'mongo', name: 'MongoDB', status: 'healthy', checkedAgo: '1s ago' },
  { id: 'grafana', name: 'Grafana', status: 'warning', checkedAgo: '1m ago' },
  { id: 'airflow', name: 'Airflow', status: 'healthy', checkedAgo: '10s ago' },
  { id: 'minio', name: 'MinIO', status: 'healthy', checkedAgo: '2s ago' },
];

export const paymentBreakdown: PaymentBreakdownItem[] = [
  { id: 'card', method: 'Card', value: 65, color: '#2563eb' },
  { id: 'cash', method: 'Cash', value: 20, color: '#60a5fa' },
  { id: 'sbp', method: 'SBP', value: 10, color: '#3b82f6' },
  { id: 'other', method: 'Other', value: 5, color: '#93c5fd' },
];

const now = Date.now();

export const initialLastRuns: JobRun[] = [
  { id: 'run-1', key: 'generate-data', name: 'generate-data', status: 'success', startedAt: now - 10 * 60_000 },
  { id: 'run-2', key: 'load-nosql', name: 'load-nosql', status: 'success', startedAt: now - 12 * 60_000 },
  { id: 'run-3', key: 'run-producer', name: 'run-producer', status: 'success', startedAt: now - 15 * 60_000 },
  { id: 'run-4', key: 'mart-refresh', name: 'mart-refresh', status: 'failed', startedAt: now - 60 * 60_000 },
  { id: 'run-5', key: 'run-etl', name: 'run-etl', status: 'success', startedAt: now - 2 * 60 * 60_000 },
];

export const pipelineActions: JobAction[] = [
  { key: 'generate-data', title: 'Generate Data', description: 'Synthesizes mock purchases and stores', icon: 'sparkles' },
  { key: 'load-nosql', title: 'Load to MongoDB', description: 'Dumps raw JSON events to MongoDB', icon: 'database' },
  { key: 'run-producer', title: 'Produce to Kafka', description: 'Streams events from Mongo to Kafka topic', icon: 'zap' },
  { key: 'mart-refresh', title: 'Refresh MART', description: 'Materializes ClickHouse views', icon: 'layers' },
  { key: 'run-etl', title: 'Run Features ETL', description: 'Spark job to calculate ML features', icon: 'flask' },
  { key: 'trigger-airflow-dag', title: 'Trigger Airflow DAG', description: 'Runs the nightly orchestration DAG', icon: 'play' },
];

export const pipelineMapSteps = ['JSON', 'MongoDB', 'Kafka', 'ClickHouse RAW', 'ClickHouse MART', 'Spark', 'MinIO'];

export const duplicatesRatio = 5.0;

export const duplicatesTrend: DuplicateTrendPoint[] = [
  { run: 'Run 1', ratio: 10 },
  { run: 'Run 2', ratio: 1.1 },
  { run: 'Run 3', ratio: 0.6 },
  { run: 'Run 4', ratio: 0.8 },
  { run: 'Run 5', ratio: 9.2 },
  { run: 'Run 6', ratio: 7.0 },
  { run: 'Run 7', ratio: 3.0 },
  { run: 'Run 8', ratio: 8.0 },
  { run: 'Run 9', ratio: 4.3 },
  { run: 'Run 10', ratio: 3.2 },
];

export const martQualityRows: MartQualityRow[] = [
  {
    entity: 'Purchases',
    totalRaw: '1 000 000',
    validMart: '950 000',
    duplicates: '40 000',
    invalid: '10 000',
    ratio: '4.0%',
  },
  {
    entity: 'Customers',
    totalRaw: '500 000',
    validMart: '480 000',
    duplicates: '15 000',
    invalid: '5 000',
    ratio: '3.0%',
  },
  {
    entity: 'Stores',
    totalRaw: '50',
    validMart: '45',
    duplicates: '5',
    invalid: '0',
    ratio: '10.0%',
  },
];

export const exportsList: ExportFile[] = [
  {
    id: 'exp-1',
    filename: 'analytic_result_2026_02_25.csv',
    date: '2026-02-25',
    rows: '125 000',
    size: '45 MB',
    status: 'Ready',
  },
  {
    id: 'exp-2',
    filename: 'mart_dump_2026_02_24.csv',
    date: '2026-02-24',
    rows: '450 000',
    size: '120 MB',
    status: 'Ready',
  },
  {
    id: 'exp-3',
    filename: 'features_2026_02_23.parquet',
    date: '2026-02-23',
    rows: '2 000 000',
    size: '350 MB',
    status: 'Ready',
  },
  {
    id: 'exp-4',
    filename: 'daily_report_2026_02_25.pdf',
    date: '2026-02-25',
    rows: '-',
    size: '2 MB',
    status: 'Processing',
  },
];

export const serviceConnections: ServiceConnection[] = [
  { key: 'ch', title: 'ClickHouse JDBC', value: 'jdbc:clickhouse://ch-server:8123/default', icon: 'database' },
  { key: 'minio', title: 'MinIO Endpoint', value: 'http://minio:9000', icon: 'cloud' },
  { key: 'grafana', title: 'Grafana URL', value: 'http://grafana:3000', icon: 'chart' },
  { key: 'airflow', title: 'Airflow URL', value: 'http://airflow:8080', icon: 'workflow' },
];
