type ApiEnvelope<T> = {
  ok: boolean;
  data: T;
  meta?: Record<string, unknown>;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

export type ApiRun = {
  id: string;
  job_name: string;
  status: 'queued' | 'running' | 'success' | 'failed';
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  stdout_tail?: string | null;
  stderr_tail?: string | null;
  error_message?: string | null;
};

export type ApiOverviewKpis = {
  stores_uniq: number;
  purchases_uniq: number;
  customers_mart: number;
  items_mart: number;
  deltas?: {
    stores_uniq?: number;
    purchases_uniq?: number;
    customers_mart?: number;
    items_mart?: number;
  };
};

export type ApiIngestionPoint = {
  day: string;
  rows: number;
};

export type ApiServiceHealth = {
  name: string;
  status: 'ok' | 'warn' | 'down';
  checked_at: string;
  latency_ms: number;
};

export type ApiPaymentItem = {
  method: string;
  share: number;
};

export type ApiQualityOverall = {
  duplicates_ratio: number;
  target_ratio: number;
  status: 'good' | 'warn' | 'bad';
  last_alert_at: string | null;
  telegram_enabled: boolean;
};

export type ApiQualityTrendPoint = {
  run: number;
  ratio: number;
};

export type ApiMartStatsRow = {
  entity: string;
  total_raw: number;
  valid_mart: number;
  duplicates: number;
  invalid: number;
  ratio: number;
};

export type ApiExportItem = {
  key: string;
  filename: string;
  date: string | null;
  rows: number | null;
  size_bytes: number;
  status: 'ready' | 'processing';
};

export type ApiConnections = {
  clickhouse_jdbc: string;
  s3_endpoint: string;
  grafana_url: string;
  airflow_url: string;
  safe_mode: boolean;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8001/api').replace(/\/$/, '');
const API_TOKEN = import.meta.env.VITE_API_TOKEN ?? '';

function buildHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init || {});
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (API_TOKEN && !headers.has('Authorization')) {
    headers.set('Authorization', `Token ${API_TOKEN}`);
  }
  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: buildHeaders(init?.headers),
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = (isJson ? await response.json() : null) as ApiEnvelope<T> | null;

  if (!response.ok) {
    const message = payload?.error?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }

  if (!payload?.ok) {
    throw new Error(payload?.error?.message || 'API responded with ok=false');
  }

  return payload.data;
}

export const apiClient = {
  fetchOverviewKpis() {
    return request<ApiOverviewKpis>('/overview/kpis');
  },
  fetchIngestionSeries(days = 7) {
    return request<{ points: ApiIngestionPoint[] }>(`/overview/ingestion-series?days=${days}`);
  },
  fetchPaymentsBreakdown(days = 7) {
    return request<{ items: ApiPaymentItem[] }>(`/overview/payments-breakdown?days=${days}`);
  },
  fetchServicesHealth() {
    return request<{ services: ApiServiceHealth[] }>('/overview/services-health');
  },
  fetchLastRuns(limit = 10) {
    return request<{ runs: ApiRun[] }>(`/overview/last-runs?limit=${limit}`);
  },
  fetchQualityOverall() {
    return request<ApiQualityOverall>('/quality/overall');
  },
  fetchQualityTrend(runs = 10) {
    return request<{ points: ApiQualityTrendPoint[] }>(`/quality/duplicates-trend?runs=${runs}`);
  },
  fetchMartStats() {
    return request<{ rows: ApiMartStatsRow[] }>('/quality/mart-stats');
  },
  fetchExports(query = '', limit = 50, offset = 0) {
    const params = new URLSearchParams({
      query,
      limit: String(limit),
      offset: String(offset),
    });
    return request<{ items: ApiExportItem[]; total: number }>(`/exports?${params.toString()}`);
  },
  fetchExportPresign(key: string) {
    const params = new URLSearchParams({ key });
    return request<{ url: string }>(`/exports/presign?${params.toString()}`);
  },
  fetchSettingsConnections() {
    return request<ApiConnections>('/settings/connections');
  },
  updateSafeMode(enabled: boolean) {
    return request<{ enabled: boolean }>('/settings/safe-mode', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
  },
  triggerAction(actionKey: string, payload?: Record<string, unknown>) {
    return request<{ run_id: string; status: 'queued' | 'running' }>('/actions/' + actionKey, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    });
  },
  fetchRun(runId: string) {
    return request<ApiRun>(`/runs/${runId}`);
  },
};
