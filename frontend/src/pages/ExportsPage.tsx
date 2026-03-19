import { motion } from 'framer-motion';
import { Download, Eye, File, Filter, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAppState } from '../app/useAppState';
import { apiClient } from '../api/client';
import { mapExports } from '../api/mappers';
import { Card } from '../components/common/Card';
import type { ExportFile } from '../types/ui';
import { cn } from '../utils/format';

export function ExportsPage() {
  const { t } = useAppState();
  const [query, setQuery] = useState('');
  const [exportsData, setExportsData] = useState<ExportFile[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        const payload = await apiClient.fetchExports(query, 50, 0);
        if (!mounted) return;
        setExportsData(mapExports(payload.items));
      } catch {
        if (!mounted) return;
        setExportsData((current) => current ?? []);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [query]);

  const filtered = exportsData ?? [];

  const handleView = async (row: ExportFile) => {
    if (!row.key) return;
    try {
      const { url } = await apiClient.fetchExportPresign(row.key);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      window.alert(error instanceof Error ? error.message : `Cannot open ${row.filename}`);
    }
  };

  const handleDownload = async (row: ExportFile) => {
    if (!row.key) return;
    try {
      const { url } = await apiClient.fetchExportPresign(row.key);
      const link = document.createElement('a');
      link.href = url;
      link.download = row.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : `Cannot download ${row.filename}`);
    }
  };

  return (
    <motion.div
      key="exports"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-5"
    >
      <section className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-4xl text-[2.1rem] font-extrabold tracking-tight">{t('exports.title')}</h1>
        </div>

        <div className="flex w-full items-center gap-2 md:w-auto">
          <label className="relative w-full md:w-[270px]">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--text-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('exports.searchPlaceholder')}
              className="app-transition w-full rounded-full border border-[var(--border)] bg-[var(--surface)] px-9 py-2.5 text-sm outline-none focus:border-[var(--border-strong)]"
            />
          </label>
          <button
            type="button"
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] p-2.5 text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/10"
          >
            <Filter className="h-4 w-4" />
          </button>
        </div>
      </section>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--surface-muted)] text-[var(--text-muted)]">
              <tr>
                <th className="px-3 py-3 text-left font-semibold">{t('exports.filename')}</th>
                <th className="px-3 py-3 text-left font-semibold">{t('exports.date')}</th>
                <th className="px-3 py-3 text-right font-semibold">{t('exports.rows')}</th>
                <th className="px-3 py-3 text-right font-semibold">{t('exports.size')}</th>
                <th className="px-3 py-3 text-left font-semibold">{t('exports.status')}</th>
                <th className="px-3 py-3 text-right font-semibold">{t('exports.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && exportsData === null
                ? Array.from({ length: 4 }, (_, index) => (
                    <tr key={`exports-skeleton-${index}`} className="border-t border-[var(--border)]">
                      <td className="px-3 py-3" colSpan={6}>
                        <div className="flex animate-pulse items-center gap-3">
                          <div className="h-4 w-4 rounded bg-[var(--surface-muted)]" />
                          <div className="h-4 w-full rounded bg-[var(--surface-muted)]/80" />
                        </div>
                      </td>
                    </tr>
                  ))
                : filtered.map((row) => {
                const localizedStatus = row.status === 'Ready' ? t('exports.ready') : t('exports.processing');
                return (
                  <tr key={row.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-3 font-semibold">
                      <span className="inline-flex items-center gap-2">
                        <File className="h-4 w-4 text-[var(--text-muted)]" />
                        {row.filename}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[var(--text-muted)]">{row.date}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.rows}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-[var(--text-muted)]">{row.size}</td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-1 text-xs font-bold',
                          row.status === 'Ready'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
                        )}
                      >
                        {localizedStatus}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleView(row)}
                          className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/10"
                          title={t('exports.view')}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownload(row)}
                          className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/10"
                          title={t('exports.download')}
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">
                    {t('exports.noExports')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </motion.div>
  );
}
