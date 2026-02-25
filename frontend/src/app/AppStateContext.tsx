import { createContext, useCallback, useEffect, useMemo, useReducer } from 'react';

import { initialLastRuns } from '../mocks/data';
import type { JobAction, JobRun, JobRunStatus, ThemeMode, ToastMessage } from '../types/ui';
import { randomFromRange, sleep } from '../utils/format';

interface AppState {
  theme: ThemeMode;
  safeMode: boolean;
  lastRuns: JobRun[];
  toasts: ToastMessage[];
}

type AppAction =
  | { type: 'SET_THEME'; payload: ThemeMode }
  | { type: 'SET_SAFE_MODE'; payload: boolean }
  | { type: 'ADD_RUN'; payload: JobRun }
  | { type: 'UPDATE_RUN_STATUS'; payload: { id: string; status: JobRunStatus } }
  | { type: 'ADD_TOAST'; payload: ToastMessage }
  | { type: 'DISMISS_TOAST'; payload: string };

interface AppContextValue extends AppState {
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setSafeMode: (value: boolean) => void;
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
    case 'ADD_RUN':
      return { ...state, lastRuns: [action.payload, ...state.lastRuns].slice(0, 10) };
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

function shouldFailJob(jobKey: string) {
  if (jobKey === 'mart-refresh') {
    return Math.random() < 0.28;
  }
  return false;
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, state.theme);
    document.documentElement.classList.toggle('dark', state.theme === 'dark');
  }, [state.theme]);

  const setTheme = useCallback((theme: ThemeMode) => {
    dispatch({ type: 'SET_THEME', payload: theme });
  }, []);

  const toggleTheme = useCallback(() => {
    dispatch({ type: 'SET_THEME', payload: state.theme === 'dark' ? 'light' : 'dark' });
  }, [state.theme]);

  const setSafeMode = useCallback((value: boolean) => {
    dispatch({ type: 'SET_SAFE_MODE', payload: value });
  }, []);

  const dismissToast = useCallback((id: string) => {
    dispatch({ type: 'DISMISS_TOAST', payload: id });
  }, []);

  const runJob = useCallback(async (job: JobAction) => {
    const runId = `run-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
    const now = Date.now();

    dispatch({
      type: 'ADD_RUN',
      payload: {
        id: runId,
        key: job.key,
        name: job.key,
        status: 'running',
        startedAt: now,
      },
    });

    dispatch({
      type: 'ADD_TOAST',
      payload: makeToast('Job started', `${job.title} was queued and is running.`, 'info'),
    });

    await sleep(randomFromRange(1200, 2100));

    const finalStatus: JobRunStatus = shouldFailJob(job.key) ? 'failed' : 'success';

    dispatch({
      type: 'UPDATE_RUN_STATUS',
      payload: { id: runId, status: finalStatus },
    });

    dispatch({
      type: 'ADD_TOAST',
      payload:
        finalStatus === 'success'
          ? makeToast('Job completed', `${job.title} finished successfully.`, 'success')
          : makeToast('Job failed', `${job.title} failed. Check logs before retry.`, 'error'),
    });

    return finalStatus;
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
