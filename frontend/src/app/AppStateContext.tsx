/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useEffect, useMemo, useReducer } from 'react';

import { apiClient } from '../api/client';
import { mapRun, mapRuns } from '../api/mappers';
import type { AppLanguage } from '../i18n/translations';
import { translate } from '../i18n/translations';
import { initialLastRuns } from '../mocks/data';
import type { JobAction, JobRun, JobRunStatus, ThemeMode, ToastMessage } from '../types/ui';
import { sleep } from '../utils/format';

interface AppState {
  theme: ThemeMode;
  language: AppLanguage;
  safeMode: boolean;
  lastRuns: JobRun[];
  toasts: ToastMessage[];
}

type AppAction =
  | { type: 'SET_THEME'; payload: ThemeMode }
  | { type: 'SET_LANGUAGE'; payload: AppLanguage }
  | { type: 'SET_SAFE_MODE'; payload: boolean }
  | { type: 'SET_LAST_RUNS'; payload: JobRun[] }
  | { type: 'UPSERT_RUN'; payload: JobRun }
  | { type: 'UPDATE_RUN_STATUS'; payload: { id: string; status: JobRunStatus } }
  | { type: 'ADD_TOAST'; payload: ToastMessage }
  | { type: 'DISMISS_TOAST'; payload: string };

interface AppContextValue extends AppState {
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setLanguage: (language: AppLanguage) => void;
  toggleLanguage: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  setSafeMode: (value: boolean) => Promise<void>;
  runJob: (job: JobAction) => Promise<JobRunStatus>;
  dismissToast: (id: string) => void;
}

const THEME_STORAGE_KEY = 'pf-control-theme';
const LANGUAGE_STORAGE_KEY = 'pf-control-language';
const SAFE_MODE_STORAGE_KEY = 'pf-control-safe-mode';

const initialTheme = ((): ThemeMode => {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') {
    return saved;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
})();

const initialLanguage = ((): AppLanguage => {
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (saved === 'en' || saved === 'ru') {
    return saved;
  }
  return 'en';
})();

const initialSafeMode = ((): boolean => {
  const saved = localStorage.getItem(SAFE_MODE_STORAGE_KEY);
  if (saved === 'true') return true;
  if (saved === 'false') return false;
  return true;
})();

const initialState: AppState = {
  theme: initialTheme,
  language: initialLanguage,
  safeMode: initialSafeMode,
  lastRuns: initialLastRuns,
  toasts: [],
};

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    case 'SET_LANGUAGE':
      return { ...state, language: action.payload };
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

function makeToast(title: string, description: string, tone: ToastMessage['tone'], durationMs = 3000): ToastMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    title,
    description,
    tone,
    durationMs,
  };
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, state.theme);
    document.documentElement.classList.toggle('dark', state.theme === 'dark');
  }, [state.theme]);

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, state.language);
  }, [state.language]);

  useEffect(() => {
    localStorage.setItem(SAFE_MODE_STORAGE_KEY, String(state.safeMode));
  }, [state.safeMode]);

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

  const setLanguage = useCallback((language: AppLanguage) => {
    dispatch({ type: 'SET_LANGUAGE', payload: language });
  }, []);

  const toggleLanguage = useCallback(() => {
    dispatch({ type: 'SET_LANGUAGE', payload: state.language === 'en' ? 'ru' : 'en' });
  }, [state.language]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(state.language, key, params),
    [state.language],
  );

  const setSafeMode = useCallback(
    async (value: boolean) => {
      dispatch({ type: 'SET_SAFE_MODE', payload: value });

      try {
        const payload = await apiClient.updateSafeMode(value);
        dispatch({ type: 'SET_SAFE_MODE', payload: payload.enabled });
        dispatch({
          type: 'ADD_TOAST',
          payload: makeToast(
            translate(state.language, 'toast.safeModeUpdatedTitle'),
            translate(state.language, 'toast.safeModeUpdatedDescription', {
              state: translate(
                state.language,
                payload.enabled ? 'toast.safeModeStateEnabled' : 'toast.safeModeStateDisabled',
              ),
            }),
            'success',
          ),
        });
      } catch (error) {
        dispatch({
          type: 'ADD_TOAST',
          payload: makeToast(
            translate(state.language, 'toast.safeModeUpdateLocalOnlyTitle'),
            error instanceof Error && error.message
              ? error.message
              : translate(state.language, 'toast.safeModeUpdateLocalOnlyDescription'),
            'info',
          ),
        });
      }
    },
    [state.language],
  );

  const dismissToast = useCallback((id: string) => {
    dispatch({ type: 'DISMISS_TOAST', payload: id });
  }, []);

  const runJob = useCallback(async (job: JobAction) => {
    const translatedJobTitleRaw = translate(state.language, `jobs.${job.key}`);
    const translatedJobTitle =
      translatedJobTitleRaw === `jobs.${job.key}` ? job.title : translatedJobTitleRaw;

    if (state.safeMode && job.key === 'mart-refresh') {
      dispatch({
        type: 'ADD_TOAST',
        payload: makeToast(
          translate(state.language, 'toast.actionBlockedTitle'),
          translate(state.language, 'toast.actionBlockedDescription'),
          'error',
        ),
      });
      return 'failed';
    }

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
        payload: makeToast(
          translate(state.language, 'toast.jobStartedTitle'),
          translate(state.language, 'toast.jobStartedDescription', { job: translatedJobTitle }),
          'info',
        ),
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
                ? makeToast(
                    translate(state.language, 'toast.jobCompletedTitle'),
                    translate(state.language, 'toast.jobCompletedDescription', {
                      job: translatedJobTitle,
                    }),
                    'success',
                  )
                : makeToast(
                    translate(state.language, 'toast.jobFailedTitle'),
                    translate(state.language, 'toast.jobFailedDescription', { job: translatedJobTitle }),
                    'error',
                  ),
          });
          return mapped.status;
        }
      }

      dispatch({ type: 'UPDATE_RUN_STATUS', payload: { id: runId, status: 'failed' } });
      dispatch({
        type: 'ADD_TOAST',
        payload: makeToast(
          translate(state.language, 'toast.jobTimeoutTitle'),
          translate(state.language, 'toast.jobTimeoutDescription', { job: translatedJobTitle }),
          'error',
        ),
      });
      return 'failed';
    } catch (error) {
      dispatch({
        type: 'ADD_TOAST',
        payload: makeToast(
          translate(state.language, 'toast.jobStartFailedTitle'),
          error instanceof Error ? error.message : translate(state.language, 'toast.jobStartFailedDescription'),
          'error',
        ),
      });
      return 'failed';
    }
  }, [state.language, state.safeMode]);

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      setTheme,
      toggleTheme,
      setLanguage,
      toggleLanguage,
      t,
      setSafeMode,
      runJob,
      dismissToast,
    }),
    [state, setTheme, toggleTheme, setLanguage, toggleLanguage, t, setSafeMode, runJob, dismissToast],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}
