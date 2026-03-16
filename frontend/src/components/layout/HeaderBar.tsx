import { BookOpenText, Languages, MoonStar, SunMedium } from 'lucide-react';

import { useAppState } from '../../app/useAppState';
import { cn } from '../../utils/format';

export function HeaderBar() {
  const { theme, toggleTheme, language, setLanguage, t } = useAppState();

  return (
    <header className="app-transition sticky top-0 z-30 border-b border-[var(--border)] bg-[color:color-mix(in_srgb,var(--bg),transparent_14%)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-6 py-4 lg:px-8">
        <div className="flex items-center">
          <img src="/assets/system_logo_new.svg" alt="ProbablyFresh logo" className="h-10 w-auto object-contain md:h-11" />
        </div>

        <div className="flex items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <span className="inline-block h-2 w-2 animate-pulse-soft rounded-full bg-emerald-500" />
            {t('header.allSystemsNominal')}
          </span>

          <span className="h-5 w-px bg-[var(--border)]" />

          <a
            href="/documentation"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-[0.85rem] text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/10"
          >
            <BookOpenText className="h-4 w-4" />
            {t('header.docs')}
          </a>

          <div className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5">
            <Languages className="ml-1 h-3.5 w-3.5 text-[var(--text-muted)]" />
            {(['en', 'ru'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setLanguage(value)}
                aria-label={t('header.toggleLanguage')}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[0.68rem] font-bold uppercase app-transition',
                  language === value
                    ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'
                    : 'text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/10',
                )}
              >
                {value}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={t('header.toggleTheme')}
            className="rounded-full p-2 text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/10"
          >
            {theme === 'light' ? <MoonStar className="h-4 w-4" /> : <SunMedium className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
