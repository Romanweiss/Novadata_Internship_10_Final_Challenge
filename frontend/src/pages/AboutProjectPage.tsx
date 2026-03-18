import { Blocks, Database, GraduationCap, Layers3, Workflow } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

import { useAppState } from '../app/useAppState';
import { Card } from '../components/common/Card';

const iconClassName = 'h-5 w-5 text-[var(--text-muted)]';

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-2.5">{icon}</div>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-extrabold tracking-tight">{title}</h2>
          <div className="mt-3 text-[0.98rem] leading-7 text-[var(--text-muted)]">{children}</div>
        </div>
      </div>
    </Card>
  );
}

export function AboutProjectPage() {
  const { t } = useAppState();

  const pipelineSteps = [
    t('aboutProject.pipelineSteps.step1'),
    t('aboutProject.pipelineSteps.step2'),
    t('aboutProject.pipelineSteps.step3'),
    t('aboutProject.pipelineSteps.step4'),
    t('aboutProject.pipelineSteps.step5'),
    t('aboutProject.pipelineSteps.step6'),
  ];

  const technologies = [
    t('aboutProject.technologies.mongo'),
    t('aboutProject.technologies.kafka'),
    t('aboutProject.technologies.clickhouse'),
    t('aboutProject.technologies.pyspark'),
    t('aboutProject.technologies.airflow'),
    t('aboutProject.technologies.s3'),
    t('aboutProject.technologies.grafana'),
    t('aboutProject.technologies.backend'),
    t('aboutProject.technologies.frontend'),
  ];

  const projectFeatures = [
    t('aboutProject.features.endToEnd'),
    t('aboutProject.features.docker'),
    t('aboutProject.features.marts'),
    t('aboutProject.features.quality'),
    t('aboutProject.features.scalability'),
    t('aboutProject.features.pii'),
  ];

  return (
    <motion.div
      key="about-project"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      <section>
        <h1 className="text-4xl text-[2.1rem] font-extrabold tracking-tight">{t('aboutProject.title')}</h1>
        <p className="mt-1 max-w-[860px] text-[0.98rem] text-[var(--text-muted)]">{t('aboutProject.subtitle')}</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard icon={<Blocks className={iconClassName} />} title={t('aboutProject.overviewTitle')}>
          <p>{t('aboutProject.overviewText')}</p>
        </SectionCard>

        <SectionCard icon={<Workflow className={iconClassName} />} title={t('aboutProject.pipelineTitle')}>
          <ul className="space-y-2">
            {pipelineSteps.map((step) => (
              <li key={step} className="flex items-start gap-2">
                <span className="mt-[0.6rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--text-muted)]" />
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard icon={<Database className={iconClassName} />} title={t('aboutProject.technologiesTitle')}>
          <ul className="space-y-2">
            {technologies.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-[0.6rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--text-muted)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard icon={<Layers3 className={iconClassName} />} title={t('aboutProject.featuresTitle')}>
          <ul className="space-y-2">
            {projectFeatures.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-[0.6rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--text-muted)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard icon={<GraduationCap className={iconClassName} />} title={t('aboutProject.purposeTitle')}>
        <p>{t('aboutProject.purposeText')}</p>
      </SectionCard>
    </motion.div>
  );
}
