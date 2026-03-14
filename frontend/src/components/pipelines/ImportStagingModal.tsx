import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

import { useAppState } from '../../app/useAppState';
import type { ApiImportStagingRecord } from '../../api/client';

interface ImportStagingModalProps {
  open: boolean;
  loading: boolean;
  errorMessage: string;
  total: number;
  items: ApiImportStagingRecord[];
  onClose: () => void;
}

export function ImportStagingModal({
  open,
  loading,
  errorMessage,
  total,
  items,
  onClose,
}: ImportStagingModalProps) {
  const { t } = useAppState();

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-40 grid place-items-center bg-black/55 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className="w-full max-w-5xl rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-extrabold leading-tight">{t('pipelines.import.stagingModal.title')}</h3>
                <p className="mt-1 text-[0.95rem] text-[var(--text-muted)]">
                  {t('pipelines.import.stagingModal.subtitle')}
                </p>
                {total > 0 ? (
                  <p className="mt-2 text-sm text-[var(--text-muted)]">{`${items.length} / ${total}`}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {loading ? <p className="text-sm text-[var(--text-muted)]">{t('pipelines.import.status.running')}</p> : null}

            {!loading && errorMessage ? (
              <div className="rounded-2xl border border-red-500/35 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {errorMessage}
              </div>
            ) : null}

            {!loading && !errorMessage && items.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">{t('pipelines.import.stagingModal.empty')}</p>
            ) : null}

            {!loading && !errorMessage && items.length > 0 ? (
              <div className="max-h-[60vh] overflow-auto rounded-2xl border border-[var(--border)]">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-[var(--surface-muted)] text-[var(--text-muted)]">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">{t('pipelines.import.stagingModal.row')}</th>
                      <th className="px-3 py-2 text-left font-semibold">{t('pipelines.import.stagingModal.key')}</th>
                      <th className="px-3 py-2 text-left font-semibold">{t('pipelines.import.stagingModal.payload')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-t border-[var(--border)] align-top">
                        <td className="whitespace-nowrap px-3 py-2">{item.row_number || '-'}</td>
                        <td className="whitespace-nowrap px-3 py-2 font-medium">{item.business_key || '-'}</td>
                        <td className="max-w-[640px] px-3 py-2">
                          <pre className="overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[var(--surface-muted)] p-2 text-xs">
                            {JSON.stringify(item.payload_json, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-[var(--border-strong)] px-4 py-2 font-semibold text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/10"
              >
                {t('pipelines.import.stagingModal.close')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
