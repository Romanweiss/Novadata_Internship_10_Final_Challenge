import { AnimatePresence, motion } from 'framer-motion';
import { Play, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

import { useAppState } from '../../app/useAppState';
import { PageLoader } from '../common/PageLoader';
import type { JobAction } from '../../types/ui';

interface JobConfirmModalProps {
  action: JobAction | null;
  open: boolean;
  running: boolean;
  onClose: () => void;
  onConfirm: (action: JobAction, options?: { exportParquet?: boolean }) => Promise<void>;
}

export function JobConfirmModal({ action, open, running, onClose, onConfirm }: JobConfirmModalProps) {
  const { t } = useAppState();
  const [exportParquet, setExportParquet] = useState(false);

  const titleKey = action ? t(`actions.${action.key}.title`) : '';
  const descriptionKey = action ? t(`actions.${action.key}.description`) : '';
  const isRunEtl = action?.key === 'run-etl';
  const actionTitle = action
    ? titleKey === `actions.${action.key}.title`
      ? action.title
      : titleKey
    : '';
  const actionDescription = action
    ? descriptionKey === `actions.${action.key}.description`
      ? action.description
      : descriptionKey
    : '';

  useEffect(() => {
    if (!open || action?.key !== 'run-etl') {
      setExportParquet(false);
    }
  }, [action?.key, open]);

  const modal = (
    <AnimatePresence>
      {open && action ? (
        <motion.div
          className="fixed inset-0 z-40 grid place-items-center bg-black/55 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className="w-full max-w-[460px] rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-extrabold leading-tight">{t('modal.runAction', { title: actionTitle })}</h3>
                <p className="mt-1 text-[0.95rem] text-[var(--text-muted)]">{actionDescription}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={running}
                className="rounded-full p-1.5 text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {running ? (
              <div className="space-y-3">
                <PageLoader className="min-h-[220px]" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-[var(--text)]">{t('modal.runningTitle')}</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{t('modal.runningDescription')}</p>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-muted)]">
                  {t('modal.warning')}
                </div>

                {isRunEtl ? (
                  <div className="mb-5 space-y-3">
                    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
                      <input
                        type="checkbox"
                        checked={exportParquet}
                        disabled={running}
                        onChange={(event) => setExportParquet(event.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-[var(--border-strong)] text-[#111827] focus:ring-[#111827]"
                      />
                      <div>
                        <p className="font-semibold text-[var(--text)]">{t('modal.parquetOptionTitle')}</p>
                        <p className="mt-1 text-[var(--text-muted)]">{t('modal.parquetOptionDescription')}</p>
                      </div>
                    </label>

                    {exportParquet ? (
                      <div className="rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                        {t('modal.parquetWarning')}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full border border-[var(--border-strong)] px-4 py-2 font-semibold text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    {t('modal.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onConfirm(action, isRunEtl ? { exportParquet } : undefined)}
                    className="inline-flex items-center gap-2 rounded-full bg-[#111827] px-4 py-2 font-semibold text-white hover:bg-[#0b1220] dark:bg-white dark:text-[#111827]"
                  >
                    <Play className="h-4 w-4" />
                    {t('modal.runJob')}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') {
    return modal;
  }

  return createPortal(modal, document.body);
}
