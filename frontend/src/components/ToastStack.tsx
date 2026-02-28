import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';

import { useAppState } from '../app/useAppState';
import type { ToastMessage } from '../types/ui';
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

function ToastItem({ toast, dismissToast }: { toast: ToastMessage; dismissToast: (id: string) => void }) {
  const Icon = iconByTone[toast.tone];
  const timeoutRef = useRef<number | null>(null);
  const remainingRef = useRef<number>(toast.durationMs ?? 3000);
  const timerStartedAtRef = useRef<number>(0);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    timerStartedAtRef.current = Date.now();
    timeoutRef.current = window.setTimeout(() => {
      dismissToast(toast.id);
    }, remainingRef.current);
  }, [clearTimer, dismissToast, toast.id]);

  const pauseTimer = useCallback(() => {
    if (timeoutRef.current === null) return;
    const elapsed = Date.now() - timerStartedAtRef.current;
    remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    clearTimer();
  }, [clearTimer]);

  const resumeTimer = useCallback(() => {
    if (timeoutRef.current !== null || remainingRef.current <= 0) return;
    startTimer();
  }, [startTimer]);

  useEffect(() => {
    startTimer();
    return clearTimer;
  }, [clearTimer, startTimer]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.96 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      onMouseEnter={pauseTimer}
      onMouseLeave={resumeTimer}
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
}

export function ToastStack() {
  const { toasts, dismissToast } = useAppState();

  return (
    <div className="pointer-events-none fixed right-6 top-6 z-50 flex w-full max-w-sm flex-col gap-3">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} dismissToast={dismissToast} />
        ))}
      </AnimatePresence>
    </div>
  );
}
