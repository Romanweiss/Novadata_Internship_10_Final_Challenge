import { BookOpenText, MoonStar, SunMedium } from 'lucide-react';

import { useAppState } from '../../app/useAppState';

export function HeaderBar() {
  const { theme, toggleTheme } = useAppState();

  return (
    <header className="app-transition sticky top-0 z-30 border-b border-[var(--border)] bg-[color:color-mix(in_srgb,var(--bg),transparent_14%)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-6 py-4 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#0f1118] text-sm font-extrabold text-white dark:bg-white dark:text-[#111827]">
            P
          </span>
          <span className="text-[1.72rem] text-xl font-extrabold tracking-tight">ProbablyFresh</span>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <span className="inline-block h-2 w-2 animate-pulse-soft rounded-full bg-emerald-500" />
            All systems nominal
          </span>

          <span className="h-5 w-px bg-[var(--border)]" />

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-[0.85rem] text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/10"
          >
            <BookOpenText className="h-4 w-4" />
            Docs
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="rounded-full p-2 text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/10"
          >
            {theme === 'light' ? <MoonStar className="h-4 w-4" /> : <SunMedium className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
