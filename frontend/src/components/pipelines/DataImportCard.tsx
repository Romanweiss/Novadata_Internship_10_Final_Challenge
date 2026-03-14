import { Database, FileWarning, RotateCcw, UploadCloud } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  apiClient,
  type ApiImportBatch,
  type ApiImportRowError,
  type ApiImportStagingRecord,
} from '../../api/client';
import { useAppState } from '../../app/useAppState';
import { cn } from '../../utils/format';
import { Card } from '../common/Card';
import { ImportErrorsModal } from './ImportErrorsModal';
import { ImportStagingModal } from './ImportStagingModal';

const ENTITY_OPTIONS: ApiImportBatch['entity_type'][] = ['stores', 'products', 'customers', 'purchases'];
const LAST_IMPORT_BATCH_STORAGE_KEY = 'pf-last-import-batch-id';

function formatDateTime(value: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function isImportInProgress(status: ApiImportBatch['status'] | undefined): boolean {
  return status === 'queued' || status === 'running';
}

function statusClassName(status: ApiImportBatch['status'] | undefined): string {
  switch (status) {
    case 'success':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
    case 'failed':
      return 'bg-red-500/15 text-red-700 dark:text-red-300';
    case 'partial':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
    case 'running':
      return 'bg-sky-500/15 text-sky-700 dark:text-sky-300';
    case 'queued':
    default:
      return 'bg-slate-500/15 text-slate-700 dark:text-slate-300';
  }
}

export function DataImportCard() {
  const { t } = useAppState();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [entityType, setEntityType] = useState<ApiImportBatch['entity_type']>('stores');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [batch, setBatch] = useState<ApiImportBatch | null>(null);
  const [inlineError, setInlineError] = useState('');
  const [errorsOpen, setErrorsOpen] = useState(false);
  const [errorsLoading, setErrorsLoading] = useState(false);
  const [errorsLoadMessage, setErrorsLoadMessage] = useState('');
  const [errors, setErrors] = useState<ApiImportRowError[]>([]);
  const [errorsTotal, setErrorsTotal] = useState(0);
  const [stagingOpen, setStagingOpen] = useState(false);
  const [stagingLoading, setStagingLoading] = useState(false);
  const [stagingLoadMessage, setStagingLoadMessage] = useState('');
  const [stagingItems, setStagingItems] = useState<ApiImportStagingRecord[]>([]);
  const [stagingTotal, setStagingTotal] = useState(0);

  useEffect(() => {
    let mounted = true;
    const savedBatchId = localStorage.getItem(LAST_IMPORT_BATCH_STORAGE_KEY);
    if (!savedBatchId) return undefined;

    (async () => {
      try {
        const payload = await apiClient.fetchImportBatch(savedBatchId);
        if (!mounted) return;
        setBatch(payload);
      } catch {
        localStorage.removeItem(LAST_IMPORT_BATCH_STORAGE_KEY);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!batch || !isImportInProgress(batch.status)) {
      return undefined;
    }

    const timerId = window.setTimeout(async () => {
      try {
        const payload = await apiClient.fetchImportBatch(batch.id);
        setBatch(payload);
      } catch (error) {
        setInlineError(error instanceof Error ? error.message : t('pipelines.import.loadErrorsFailed'));
      }
    }, 1500);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [batch, t]);

  const hasErrors = (batch?.invalid_rows ?? 0) > 0;
  const hasStaging = (batch?.staged_rows ?? 0) > 0;
  const batchStatusLabel = batch ? t(`pipelines.import.status.${batch.status}`) : '-';

  const summaryItems = useMemo(
    () =>
      batch
        ? [
            { key: 'fileName', label: t('pipelines.import.fileName'), value: batch.file_name },
            { key: 'totalRows', label: t('pipelines.import.totalRows'), value: String(batch.total_rows) },
            { key: 'validRows', label: t('pipelines.import.validRows'), value: String(batch.valid_rows) },
            { key: 'invalidRows', label: t('pipelines.import.invalidRows'), value: String(batch.invalid_rows) },
            { key: 'stagedRows', label: t('pipelines.import.stagedRows'), value: String(batch.staged_rows) },
            { key: 'replayCount', label: t('pipelines.import.replayCount'), value: String(batch.replay_count) },
            { key: 'createdAt', label: t('pipelines.import.createdAt'), value: formatDateTime(batch.created_at) },
            { key: 'startedAt', label: t('pipelines.import.startedAt'), value: formatDateTime(batch.started_at) },
            { key: 'finishedAt', label: t('pipelines.import.finishedAt'), value: formatDateTime(batch.finished_at) },
            {
              key: 'lastReplayedAt',
              label: t('pipelines.import.lastReplayedAt'),
              value: formatDateTime(batch.last_replayed_at),
            },
          ]
        : [],
    [batch, t],
  );

  async function handleUpload() {
    if (!file) {
      setInlineError(t('pipelines.import.selectEntityFirst'));
      return;
    }

    setUploading(true);
    setInlineError('');

    try {
      const payload = await apiClient.createImport(entityType, file);
      setBatch(payload);
      setErrors([]);
      setErrorsTotal(0);
      localStorage.setItem(LAST_IMPORT_BATCH_STORAGE_KEY, payload.id);
      setFile(null);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    } catch (error) {
      setInlineError(error instanceof Error ? error.message : t('pipelines.import.loadErrorsFailed'));
    } finally {
      setUploading(false);
    }
  }

  async function handleOpenErrors() {
    if (!batch) return;
    setErrorsOpen(true);
    setErrorsLoading(true);
    setErrorsLoadMessage('');

    try {
      const payload = await apiClient.fetchImportErrors(batch.id, 500);
      setErrors(payload.items);
      setErrorsTotal(payload.total);
    } catch (error) {
      setErrors([]);
      setErrorsTotal(0);
      setErrorsLoadMessage(error instanceof Error ? error.message : t('pipelines.import.loadErrorsFailed'));
    } finally {
      setErrorsLoading(false);
    }
  }

  async function handleOpenStaging() {
    if (!batch) return;
    setStagingOpen(true);
    setStagingLoading(true);
    setStagingLoadMessage('');

    try {
      const payload = await apiClient.fetchImportStaging(batch.id, 200);
      setStagingItems(payload.items);
      setStagingTotal(payload.total);
    } catch (error) {
      setStagingItems([]);
      setStagingTotal(0);
      setStagingLoadMessage(error instanceof Error ? error.message : t('pipelines.import.loadStagingFailed'));
    } finally {
      setStagingLoading(false);
    }
  }

  async function handleReplay() {
    if (!batch) return;
    setReplaying(true);
    setInlineError('');

    try {
      const payload = await apiClient.replayImportBatch(batch.id);
      setBatch(payload);
      setErrors([]);
      setErrorsTotal(0);
      setStagingItems([]);
      setStagingTotal(0);
    } catch (error) {
      setInlineError(error instanceof Error ? error.message : t('pipelines.import.replayFailed'));
    } finally {
      setReplaying(false);
    }
  }

  return (
    <>
      <Card className="p-5">
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight">{t('pipelines.import.title')}</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{t('pipelines.import.subtitle')}</p>
              </div>
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]">
                <UploadCloud className="h-5 w-5" />
              </span>
            </div>

            <p className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-muted)]">
              {t('pipelines.import.validationOnly')}
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-[180px_1fr_auto] md:items-end">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-[var(--text-muted)]">{t('pipelines.import.entityLabel')}</span>
                <select
                  value={entityType}
                  onChange={(event) => setEntityType(event.target.value as ApiImportBatch['entity_type'])}
                  className="app-transition w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none focus:border-[var(--border-strong)]"
                >
                  {ENTITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {t(`pipelines.import.entity.${option}`)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-2">
                <span className="text-sm font-semibold text-[var(--text-muted)]">{t('pipelines.import.fileLabel')}</span>
                <label className="app-transition flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm hover:border-[var(--border-strong)] hover:bg-black/5 dark:hover:bg-white/5">
                  <Database className="h-4 w-4 text-[var(--text-muted)]" />
                  <span className="truncate text-[var(--text)]">{file?.name || t('pipelines.import.noFileChosen')}</span>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".json,.jsonl,.ndjson,.csv"
                    className="hidden"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="inline-flex h-[50px] items-center justify-center rounded-2xl bg-[#111827] px-5 font-semibold text-white hover:bg-[#0b1220] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-[#111827]"
              >
                {uploading ? t('pipelines.import.uploading') : t('pipelines.import.upload')}
              </button>
            </div>

            {inlineError ? (
              <div className="mt-4 rounded-2xl border border-red-500/35 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {inlineError}
              </div>
            ) : null}
          </div>

          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--text-muted)]">{t('pipelines.import.lastBatch')}</p>
                <h3 className="mt-1 text-lg font-bold">{t('pipelines.import.batchStatus')}</h3>
              </div>
              <span className={cn('rounded-full px-3 py-1 text-xs font-bold', statusClassName(batch?.status))}>
                {batchStatusLabel}
              </span>
            </div>

            {batch ? (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {summaryItems.map((item) => (
                    <div key={item.key} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{item.label}</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--text)]">{item.value}</p>
                    </div>
                  ))}
                </div>

                {batch.error_message ? (
                  <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                    <p className="font-semibold">{t('pipelines.import.errorMessage')}</p>
                    <p className="mt-1">{batch.error_message}</p>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {hasErrors ? (
                    <button
                      type="button"
                      onClick={handleOpenErrors}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      <FileWarning className="h-4 w-4" />
                      {t('pipelines.import.viewErrors')}
                    </button>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-emerald-500/12 px-4 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      {t('pipelines.import.noErrors')}
                    </span>
                  )}

                  {hasStaging ? (
                    <button
                      type="button"
                      onClick={handleOpenStaging}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      <Database className="h-4 w-4" />
                      {t('pipelines.import.viewStaging')}
                    </button>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-slate-500/12 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {t('pipelines.import.noStaging')}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={handleReplay}
                    disabled={replaying || isImportInProgress(batch.status)}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-white/10"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {replaying ? t('pipelines.import.replaying') : t('pipelines.import.replay')}
                  </button>
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-[var(--text-muted)]">{t('pipelines.import.emptyState')}</p>
            )}
          </div>
        </div>
      </Card>

      <ImportErrorsModal
        open={errorsOpen}
        loading={errorsLoading}
        errorMessage={errorsLoadMessage}
        total={errorsTotal}
        items={errors}
        onClose={() => setErrorsOpen(false)}
      />
      <ImportStagingModal
        open={stagingOpen}
        loading={stagingLoading}
        errorMessage={stagingLoadMessage}
        total={stagingTotal}
        items={stagingItems}
        onClose={() => setStagingOpen(false)}
      />
    </>
  );
}
