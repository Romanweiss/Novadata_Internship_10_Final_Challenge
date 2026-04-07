import { motion } from 'framer-motion';
import { Database, FileSpreadsheet, Layers3, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useAppState } from '../app/useAppState';
import { apiClient } from '../api/client';
import { mapFeatureMart } from '../api/mappers';
import { Card } from '../components/common/Card';
import { PageLoader } from '../components/common/PageLoader';
import { FeatureDefinitionModal } from '../components/feature-mart/FeatureDefinitionModal';
import {
  SUGGESTED_FEATURE_REGISTRY,
  getFeatureLabel as getMetadataFeatureLabel,
  getLocalizedFeatureDefinition,
} from '../constants/featureDefinitions';
import type { FeatureMartData } from '../types/ui';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

function formatNumber(value: number): string {
  return value.toLocaleString('ru-RU').replace(/\u00A0/g, ' ');
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

function toFlag(value: unknown): number {
  const parsed = Number(value);
  return parsed === 1 ? 1 : 0;
}

function getTranslatedFeatureLabel(feature: string, t: (key: string) => string): string {
  const key = `featureMart.featureNames.${feature}`;
  const translated = t(key);
  return translated === key ? feature : translated;
}

export function FeatureMartPage() {
  const { language, t } = useAppState();
  const [data, setData] = useState<FeatureMartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [selectedFeatureKey, setSelectedFeatureKey] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setErrorMessage('');
      try {
        const payload = await apiClient.fetchFeatureMart();
        if (!mounted) return;
        setData(mapFeatureMart(payload));
      } catch (error) {
        if (!mounted) return;
        setData(null);
        setErrorMessage(error instanceof Error && error.message ? error.message : t('featureMart.errorFallback'));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [t]);

  const featureColumns = data?.featureColumns ?? [];
  const rows = data?.rows ?? [];

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => String(row.customer_id ?? '').toLowerCase().includes(query));
  }, [rows, search]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pagedRows = filteredRows.slice(pageStart, pageStart + pageSize);

  const featureSummary = useMemo(
    () =>
      [...(data?.featureSummary ?? [])]
        .filter((item) => item.onesCount > 0)
        .sort((a, b) => b.onesCount - a.onesCount),
    [data?.featureSummary],
  );

  const currentFeatureDefinitions = useMemo(
    () =>
      featureColumns
        .map((feature) => getLocalizedFeatureDefinition(feature, language))
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [featureColumns, language],
  );

  const suggestedFeatureDefinitions = useMemo(
    () =>
      SUGGESTED_FEATURE_REGISTRY.map((item) => getLocalizedFeatureDefinition(item.key, language)).filter(
        (item): item is NonNullable<typeof item> => Boolean(item),
      ),
    [language],
  );

  const selectedDefinition = selectedFeatureKey ? getLocalizedFeatureDefinition(selectedFeatureKey, language) : null;

  const uiText =
    language === 'ru'
      ? {
          summaryHint:
            '\u041d\u0430\u0436\u043c\u0438\u0442\u0435 \u043d\u0430 \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0443 \u0444\u0438\u0447\u0438, \u0447\u0442\u043e\u0431\u044b \u043e\u0442\u043a\u0440\u044b\u0442\u044c \u0442\u043e\u0447\u043d\u043e\u0435 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435, \u043f\u0440\u0430\u0432\u0438\u043b\u043e \u0440\u0430\u0441\u0447\u0451\u0442\u0430 \u0438 \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0438 \u0434\u0430\u043d\u043d\u044b\u0445.',
          summaryKnownHint:
            '\u041f\u043e\u0434\u0440\u043e\u0431\u043d\u044b\u0435 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u044f \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b \u0434\u043b\u044f \u0442\u0435\u043a\u0443\u0449\u0438\u0445 \u0431\u0438\u043d\u0430\u0440\u043d\u044b\u0445 \u0444\u0438\u0447 \u0438 \u0434\u043b\u044f \u043e\u043a\u043e\u043d\u043d\u044b\u0445 category / activity-\u0444\u043b\u0430\u0433\u043e\u0432.',
          detailsTitle: '\u0420\u0435\u0435\u0441\u0442\u0440 \u0442\u0435\u043a\u0443\u0449\u0438\u0445 \u0444\u0438\u0447',
          detailsSubtitle:
            '\u0415\u0434\u0438\u043d\u044b\u0439 \u0441\u043b\u043e\u0439 \u043c\u0435\u0442\u0430\u0434\u0430\u043d\u043d\u044b\u0445, \u0441\u043e\u0433\u043b\u0430\u0441\u043e\u0432\u0430\u043d\u043d\u044b\u0439 \u0441 \u0442\u0435\u043a\u0443\u0449\u0435\u0439 \u043b\u043e\u0433\u0438\u043a\u043e\u0439 ETL.',
          suggestedTitle: '\u0421\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0435 \u043f\u043e\u043b\u0435\u0437\u043d\u044b\u0435 \u0444\u0438\u0447\u0438',
          suggestedSubtitle:
            '\u0418\u0434\u0435\u0438 \u0434\u043b\u044f \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0435\u0439 \u0438\u0442\u0435\u0440\u0430\u0446\u0438\u0438 \u0432\u0438\u0442\u0440\u0438\u043d\u044b. \u041d\u0435\u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u0443\u0436\u0435 \u0447\u0430\u0441\u0442\u0438\u0447\u043d\u043e \u043f\u043e\u043a\u0440\u044b\u0432\u0430\u044e\u0442\u0441\u044f \u0442\u0435\u043a\u0443\u0449\u0438\u043c\u0438 proxy-\u0444\u0438\u0447\u0430\u043c\u0438.',
          openDetails: '\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435',
          implemented: '\u0420\u0435\u0430\u043b\u0438\u0437\u043e\u0432\u0430\u043d\u043e',
          metadataOnly: '\u041c\u0435\u0442\u0430\u0434\u0430\u043d\u043d\u044b\u0435',
          future: '\u0421\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0439 ETL \u0448\u0430\u0433',
        }
      : {
          summaryHint: 'Click a feature card to open the exact definition, calculation rule, and source fields.',
          summaryKnownHint: 'Detailed definitions are available for the current binary features and for window-based category / activity flags.',
          detailsTitle: 'Current feature registry',
          detailsSubtitle: 'A single metadata layer aligned with the current ETL logic.',
          suggestedTitle: 'Suggested next features',
          suggestedSubtitle: 'Ideas for the next mart iteration. Some are already partially covered by current proxy features.',
          openDetails: 'Open details',
          implemented: 'Implemented',
          metadataOnly: 'Metadata only',
          future: 'Next ETL step',
        };
  function getStatusLabel(status: 'implemented' | 'metadata-only' | 'future-recommendation') {
    if (status === 'implemented') return uiText.implemented;
    if (status === 'metadata-only') return uiText.metadataOnly;
    return uiText.future;
  }

  const showEmpty = !loading && !errorMessage && (!data?.fileName || rows.length === 0);

  return (
    <motion.div
      key="feature-mart"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-5"
    >
      <section>
        <h1 className="text-4xl text-[2.1rem] font-extrabold tracking-tight">{t('featureMart.title')}</h1>
        <p className="mt-1 text-[0.98rem] text-[var(--text-muted)]">{t('featureMart.subtitle')}</p>
      </section>

      {loading ? (
        <Card className="p-6">
          <PageLoader className="min-h-[320px]" />
        </Card>
      ) : null}

      {!loading && errorMessage ? (
        <Card className="border-red-500/35 p-6">
          <h3 className="text-xl font-bold text-red-600 dark:text-red-300">{t('featureMart.errorTitle')}</h3>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{errorMessage}</p>
        </Card>
      ) : null}

      {showEmpty ? (
        <Card className="p-6">
          <h3 className="text-xl font-bold">{t('featureMart.emptyTitle')}</h3>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{t('featureMart.emptyDescription')}</p>
        </Card>
      ) : null}

      {!loading && !errorMessage && !showEmpty && data ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--text-muted)]">{t('featureMart.kpi.totalCustomers')}</p>
                <UsersRound className="h-4 w-4 text-[var(--text-muted)]" />
              </div>
              <p className="text-4xl font-extrabold leading-none">{formatNumber(data.rowsCount)}</p>
            </Card>

            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--text-muted)]">{t('featureMart.kpi.totalFeatures')}</p>
                <Layers3 className="h-4 w-4 text-[var(--text-muted)]" />
              </div>
              <p className="text-4xl font-extrabold leading-none">{formatNumber(data.featuresCount)}</p>
            </Card>

            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--text-muted)]">{t('featureMart.kpi.lastExport')}</p>
                <FileSpreadsheet className="h-4 w-4 text-[var(--text-muted)]" />
              </div>
              <p className="truncate text-lg font-bold">{data.fileName ?? '-'}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{formatDate(data.generatedAt)}</p>
            </Card>

            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--text-muted)]">{t('featureMart.kpi.source')}</p>
                <Database className="h-4 w-4 text-[var(--text-muted)]" />
              </div>
              <p className="text-lg font-bold">{t('featureMart.sourceValue')}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-[var(--text-muted)]">{data.source}</p>
            </Card>
          </section>

          <Card className="p-5">
            <h3 className="mb-4 text-xl font-bold">{t('featureMart.summaryTitle')}</h3>
            <p className="mb-1 text-sm text-[var(--text-muted)]">{uiText.summaryHint}</p>
            <p className="mb-4 text-xs text-[var(--text-muted)]">{uiText.summaryKnownHint}</p>
            {featureSummary.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">{t('featureMart.noNonZeroSummary')}</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {featureSummary.map((item) => {
                  const percent = data.rowsCount > 0 ? (item.onesCount / data.rowsCount) * 100 : 0;
                  const isKnown = Boolean(getLocalizedFeatureDefinition(item.feature, language));
                  return (
                    <button
                      type="button"
                      key={item.feature}
                      onClick={() => setSelectedFeatureKey(item.feature)}
                      className="app-transition rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-left hover:border-[var(--border-strong)] hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">
                          {isKnown ? getMetadataFeatureLabel(item.feature, language) : getTranslatedFeatureLabel(item.feature, t)}
                        </p>
                        <span className="text-sm font-bold tabular-nums">{formatNumber(item.onesCount)}</span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                        <div className="h-full rounded-full bg-[var(--accent-blue)]" style={{ width: `${Math.min(percent, 100)}%` }} />
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="text-xs text-[var(--text-muted)]">{percent.toFixed(1)}%</p>
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{uiText.openDetails}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="text-xl font-bold">{uiText.detailsTitle}</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{uiText.detailsSubtitle}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {currentFeatureDefinitions.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSelectedFeatureKey(item.key)}
                  className="app-transition rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left hover:border-[var(--border-strong)] hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{item.key}</p>
                    </div>
                    <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)]">
                      {item.category}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{item.shortDescription}</p>
                </button>
              ))}
              {!currentFeatureDefinitions.length ? (
                <p className="text-sm text-[var(--text-muted)]">{t('featureMart.noNonZeroSummary')}</p>
              ) : null}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-xl font-bold">{uiText.suggestedTitle}</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{uiText.suggestedSubtitle}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {suggestedFeatureDefinitions.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSelectedFeatureKey(item.key)}
                  className="app-transition rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left hover:border-[var(--border-strong)] hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{item.category}</p>
                    </div>
                    <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)]">
                      {getStatusLabel(item.status)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{item.shortDescription}</p>
                  {item.currentProxyFeatureKeys?.length ? (
                    <p className="mt-3 text-xs text-[var(--text-muted)]">{item.currentProxyFeatureKeys.join(', ')}</p>
                  ) : null}
                </button>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <h3 className="text-xl font-bold">{t('featureMart.tableTitle')}</h3>
              <button
                type="button"
                onClick={() => setIsTableOpen((value) => !value)}
                className="app-transition inline-flex w-fit rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-1.5 text-sm font-semibold hover:border-[var(--border-strong)] hover:bg-black/5 dark:hover:bg-white/10"
              >
                {isTableOpen ? t('featureMart.hideTable') : t('featureMart.showTable')}
              </button>
            </div>

            {isTableOpen ? (
              <>
                <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={t('featureMart.searchPlaceholder')}
                      className="app-transition min-w-[220px] rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm outline-none focus:border-[var(--border-strong)]"
                    />

                    <label className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)]">
                      {t('featureMart.pageSize')}
                      <select
                        value={pageSize}
                        onChange={(event) => setPageSize(Number(event.target.value))}
                        className="app-transition rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--border-strong)]"
                      >
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="max-h-[560px] overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-[var(--surface-muted)] text-[var(--text-muted)]">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">{t('featureMart.customerId')}</th>
                        {featureColumns.map((column) => (
                          <th key={column} className="whitespace-nowrap px-3 py-2 text-center font-semibold">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRows.map((row) => (
                        <tr key={String(row.customer_id)} className="border-t border-[var(--border)]">
                          <td className="whitespace-nowrap px-3 py-2 font-semibold">{String(row.customer_id)}</td>
                          {featureColumns.map((column) => {
                            const flag = toFlag(row[column]);
                            return (
                              <td key={`${String(row.customer_id)}-${column}`} className="px-3 py-2 text-center">
                                <span
                                  className={
                                    flag === 1
                                      ? 'inline-flex min-w-7 justify-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300'
                                      : 'inline-flex min-w-7 justify-center rounded-full bg-slate-500/15 px-2 py-0.5 text-xs font-bold text-slate-600 dark:text-slate-300'
                                  }
                                >
                                  {flag}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {pagedRows.length === 0 ? (
                        <tr>
                          <td colSpan={featureColumns.length + 1} className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">
                            {t('featureMart.noRows')}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-3 border-t border-[var(--border)] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-[var(--text-muted)]">
                    {t('featureMart.rowsLabel', { shown: pagedRows.length, total: filteredRows.length })}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={currentPage <= 1}
                      className="app-transition rounded-full border border-[var(--border)] px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t('featureMart.paginationPrev')}
                    </button>
                    <span className="text-sm text-[var(--text-muted)]">
                      {t('featureMart.paginationPage', { current: currentPage, total: totalPages })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      disabled={currentPage >= totalPages}
                      className="app-transition rounded-full border border-[var(--border)] px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t('featureMart.paginationNext')}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <p className="px-5 py-4 text-sm text-[var(--text-muted)]">{t('featureMart.tableCollapsedHint')}</p>
            )}
          </Card>
        </>
      ) : null}

      <FeatureDefinitionModal
        open={Boolean(selectedFeatureKey)}
        definition={selectedDefinition}
        language={language}
        onClose={() => setSelectedFeatureKey(null)}
      />
    </motion.div>
  );
}

