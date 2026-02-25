import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

import { useAppState } from '../app/useAppState';
import { cn } from '../utils/format';

const iconByTone = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
} as const;

const toneStyles = {
  info: 'border-slate-300/80 dark:border-slate-700 text-slate-700 dark:text-slate-200',
  success: 'border-emerald-500/30 text-emerald-700 dark:text-emerald-200',
  error: 'border-red-500/30 text-red-700 dark:text-red-200',
} as const;

export function ToastStack() {
  const { toasts, dismissToast } = useAppState();

  return (
    <div className="pointer-events-none fixed right-6 top-6 z-50 flex w-full max-w-sm flex-col gap-3">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = iconByTone[toast.tone];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'pointer-events-auto rounded-2xl border bg-[var(--surface)] px-4 py-3 shadow-soft',
                toneStyles[toast.tone],
              )}
            >
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 h-4 w-4" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{toast.title}</p>
                  <p className="text-xs text-[var(--text-muted)]">{toast.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="rounded-full p-1 text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
