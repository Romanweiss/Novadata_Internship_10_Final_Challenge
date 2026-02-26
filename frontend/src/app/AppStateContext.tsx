import { createContext, useCallback, useEffect, useMemo, useReducer } from 'react';

import { apiClient } from '../api/client';
import { mapRun, mapRuns } from '../api/mappers';
import { initialLastRuns } from '../mocks/data';
import type { JobAction, JobRun, JobRunStatus, ThemeMode, ToastMessage } from '../types/ui';
import { sleep } from '../utils/format';

interface AppState {
  theme: ThemeMode;
  safeMode: boolean;
  lastRuns: JobRun[];
  toasts: ToastMessage[];
}

type AppAction =
  | { type: 'SET_THEME'; payload: ThemeMode }
  | { type: 'SET_SAFE_MODE'; payload: boolean }
  | { type: 'SET_LAST_RUNS'; payload: JobRun[] }
  | { type: 'UPSERT_RUN'; payload: JobRun }
  | { type: 'UPDATE_RUN_STATUS'; payload: { id: string; status: JobRunStatus } }
  | { type: 'ADD_TOAST'; payload: ToastMessage }
  | { type: 'DISMISS_TOAST'; payload: string };

interface AppContextValue extends AppState {
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setSafeMode: (value: boolean) => Promise<void>;
  runJob: (job: JobAction) => Promise<JobRunStatus>;
  dismissToast: (id: string) => void;
}

const STORAGE_KEY = 'pf-control-theme';

const initialTheme = ((): ThemeMode => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') {
    return saved;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
})();

const initialState: AppState = {
  theme: initialTheme,
  safeMode: true,
  lastRuns: initialLastRuns,
  toasts: [],
};

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    case 'SET_SAFE_MODE':
      return { ...state, safeMode: action.payload };
    case 'SET_LAST_RUNS':
      return { ...state, lastRuns: action.payload.slice(0, 10) };
    case 'UPSERT_RUN': {
      const next = [action.payload, ...state.lastRuns.filter((run) => run.id !== action.payload.id)];
      return { ...state, lastRuns: next.slice(0, 10) };
    }
    case 'UPDATE_RUN_STATUS':
      return {
        ...state,
        lastRuns: state.lastRuns.map((run) =>
          run.id === action.payload.id ? { ...run, status: action.payload.status } : run,
        ),
      };
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.payload] };
    case 'DISMISS_TOAST':
      return { ...state, toasts: state.toasts.filter((item) => item.id !== action.payload) };
    default:
      return state;
  }
}

export const AppStateContext = createContext<AppContextValue | null>(null);

function makeToast(title: string, description: string, tone: ToastMessage['tone']): ToastMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    title,
    description,
    tone,
  };
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, state.theme);
    document.documentElement.classList.toggle('dark', state.theme === 'dark');
  }, [state.theme]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [connections, lastRunsPayload] = await Promise.all([
          apiClient.fetchSettingsConnections(),
          apiClient.fetchLastRuns(10),
        ]);

        if (!mounted) return;

        dispatch({ type: 'SET_SAFE_MODE', payload: connections.safe_mode });
        dispatch({ type: 'SET_LAST_RUNS', payload: mapRuns(lastRunsPayload.runs) });
      } catch {
        // Keep fallback mock state when API is unavailable/unauthorized.
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const setTheme = useCallback((theme: ThemeMode) => {
    dispatch({ type: 'SET_THEME', payload: theme });
  }, []);

  const toggleTheme = useCallback(() => {
    dispatch({ type: 'SET_THEME', payload: state.theme === 'dark' ? 'light' : 'dark' });
  }, [state.theme]);

  const setSafeMode = useCallback(
    async (value: boolean) => {
      const previous = state.safeMode;
      dispatch({ type: 'SET_SAFE_MODE', payload: value });

      try {
        const payload = await apiClient.updateSafeMode(value);
        dispatch({ type: 'SET_SAFE_MODE', payload: payload.enabled });
        dispatch({
          type: 'ADD_TOAST',
          payload: makeToast('Safe mode updated', `Safe mode is now ${payload.enabled ? 'enabled' : 'disabled'}.`, 'success'),
        });
      } catch (error) {
        dispatch({ type: 'SET_SAFE_MODE', payload: previous });
        dispatch({
          type: 'ADD_TOAST',
          payload: makeToast(
            'Safe mode update failed',
            error instanceof Error ? error.message : 'Unable to update safe mode.',
            'error',
          ),
        });
      }
    },
    [state.safeMode],
  );

  const dismissToast = useCallback((id: string) => {
    dispatch({ type: 'DISMISS_TOAST', payload: id });
  }, []);

  const runJob = useCallback(async (job: JobAction) => {
    try {
      const started = await apiClient.triggerAction(job.key, {});
      const runId = started.run_id;

      dispatch({
        type: 'UPSERT_RUN',
        payload: {
          id: runId,
          key: job.key,
          name: job.key,
          status: 'running',
          startedAt: Date.now(),
        },
      });

      dispatch({
        type: 'ADD_TOAST',
        payload: makeToast('Job started', `${job.title} was queued and is running.`, 'info'),
      });

      const maxPollAttempts = 1200; // ~30 minutes with 1.5s polling
      for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
        await sleep(1500);
        const run = await apiClient.fetchRun(runId);
        const mapped = mapRun(run);
        dispatch({ type: 'UPSERT_RUN', payload: mapped });

        if (mapped.status === 'success' || mapped.status === 'failed') {
          dispatch({
            type: 'ADD_TOAST',
            payload:
              mapped.status === 'success'
                ? makeToast('Job completed', `${job.title} finished successfully.`, 'success')
                : makeToast('Job failed', `${job.title} failed. Check logs before retry.`, 'error'),
          });
          return mapped.status;
        }
      }

      dispatch({ type: 'UPDATE_RUN_STATUS', payload: { id: runId, status: 'failed' } });
      dispatch({
        type: 'ADD_TOAST',
        payload: makeToast('Job timeout', `${job.title} exceeded polling timeout.`, 'error'),
      });
      return 'failed';
    } catch (error) {
      dispatch({
        type: 'ADD_TOAST',
        payload: makeToast(
          'Job start failed',
          error instanceof Error ? error.message : 'Failed to trigger backend action.',
          'error',
        ),
      });
      return 'failed';
    }
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      setTheme,
      toggleTheme,
      setSafeMode,
      runJob,
      dismissToast,
    }),
    [state, setTheme, toggleTheme, setSafeMode, runJob, dismissToast],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}
