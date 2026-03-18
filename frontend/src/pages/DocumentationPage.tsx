import { motion } from 'framer-motion';
import { BookOpenText, FileCog, Gauge, Settings, ShieldCheck, Table2, UploadCloud, Workflow } from 'lucide-react';

import { useAppState } from '../app/useAppState';
import { Card } from '../components/common/Card';
import { documentationContent } from '../constants/documentation';
import { cn } from '../utils/format';

const sectionIconClassName = 'h-5 w-5 text-[var(--text-muted)]';

const sectionIconById = {
  global: BookOpenText,
  overview: Gauge,
  pipelines: Workflow,
  quality: ShieldCheck,
  'feature-mart': Table2,
  exports: UploadCloud,
  settings: Settings,
} as const;

export function DocumentationPage() {
  const { language } = useAppState();
  const content = documentationContent[language];

  return (
    <motion.div
      key="documentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="space-y-7"
    >
      <section className="sticky top-24 z-20 mt-8">
        <nav className="flex w-full flex-nowrap items-center gap-2 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-card app-transition">
          {content.sections.map((section) => {
            const Icon = sectionIconById[section.id as keyof typeof sectionIconById] ?? BookOpenText;
            const navTitle =
              section.id === 'global'
                ? language === 'ru'
                  ? 'Интерфейс'
                  : 'Interface'
                : section.title;

            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-[var(--text-muted)] app-transition hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/10"
              >
                <Icon className="h-4 w-4" />
                {navTitle}
              </a>
            );
          })}
        </nav>
      </section>

      <section className="space-y-3">
        <div>
          <h1 className="text-4xl text-[2.1rem] font-extrabold tracking-tight">{content.title}</h1>
          <p className="mt-2 max-w-[860px] text-[1rem] leading-7 text-[var(--text-muted)]">{content.subtitle}</p>
        </div>
      </section>

      <Card className="p-5 md:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-2.5">
            <FileCog className="h-5 w-5 text-[var(--text-muted)]" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{content.noteTitle}</h2>
            <p className="mt-1 max-w-[900px] text-sm leading-6 text-[var(--text-muted)]">{content.noteDescription}</p>
          </div>
        </div>
      </Card>

      <section className="space-y-5">
        {content.sections.map((section, index) => {
          const Icon = sectionIconById[section.id as keyof typeof sectionIconById] ?? BookOpenText;
          return (
            <Card
              key={section.id}
              className={cn(
                'scroll-mt-24 p-5 md:p-6',
                index === 0 ? 'border-[var(--border-strong)]' : '',
              )}
            >
              <div id={section.id} className="space-y-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-2.5">
                    <Icon className={sectionIconClassName} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-extrabold tracking-tight">{section.title}</h2>
                    <p className="mt-1 max-w-[900px] text-sm leading-6 text-[var(--text-muted)]">{section.summary}</p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {section.features.map((feature) => (
                    <div
                      key={feature.title}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/85 p-4"
                    >
                      <p className="text-[0.98rem] leading-7 text-[var(--text)]">
                        <strong className="font-extrabold">{feature.title}</strong>
                        {': '}
                        <span className="text-[var(--text-muted)]">{feature.description}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}
      </section>
    </motion.div>
  );
}
