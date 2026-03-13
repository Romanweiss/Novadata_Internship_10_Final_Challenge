export type ThemeMode = 'light' | 'dark';

export type ServiceHealthStatus = 'healthy' | 'warning' | 'offline';
export type JobRunStatus = 'success' | 'failed' | 'running';

export interface KPIItem {
  key: string;
  title: string;
  value: string;
  change: string;
  icon: 'store' | 'pulse' | 'users' | 'layers';
}

export interface IngestionPoint {
  day: string;
  rows: number;
}

export interface ServiceHealthItem {
  id: string;
  name: string;
  status: ServiceHealthStatus;
  checkedAgo: string;
}

export interface PaymentBreakdownItem {
  id: string;
  method: string;
  count: number;
  value: number;
  color: string;
}

export interface JobRun {
  id: string;
  key: string;
  name: string;
  status: JobRunStatus;
  startedAt: number;
}

export interface JobAction {
  key: string;
  title: string;
  description: string;
  icon: 'sparkles' | 'database' | 'zap' | 'layers' | 'flask' | 'play';
}

export interface DuplicateTrendPoint {
  run: string;
  ratio: number;
}

export interface MartQualityRow {
  entity: string;
  totalRaw: string;
  validMart: string;
  duplicates: string;
  invalid: string;
  ratio: string;
}

export interface ExportFile {
  id: string;
  key?: string;
  filename: string;
  date: string;
  rows: string;
  size: string;
  status: 'Ready' | 'Processing';
}

export interface ServiceConnection {
  key: string;
  title: string;
  value: string;
  icon: 'database' | 'cloud' | 'chart' | 'workflow';
}

export interface ToastMessage {
  id: string;
  title: string;
  description: string;
  tone: 'info' | 'success' | 'error';
  durationMs?: number;
}

export interface FeatureMartSummaryItem {
  feature: string;
  onesCount: number;
}

export interface FeatureMartData {
  fileName: string | null;
  source: string;
  generatedAt: string | null;
  rowsCount: number;
  featuresCount: number;
  columns: string[];
  featureColumns: string[];
  rows: Array<Record<string, string | number>>;
  featureSummary: FeatureMartSummaryItem[];
}
