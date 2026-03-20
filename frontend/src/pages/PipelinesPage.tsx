import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useAppState } from '../app/useAppState';
import { Card } from '../components/common/Card';
import { ActionCard } from '../components/pipelines/ActionCard';
import { DataImportCard } from '../components/pipelines/DataImportCard';
import { JobConfirmModal } from '../components/pipelines/JobConfirmModal';
import { pipelineActions, pipelineMapSteps } from '../mocks/data';
import type { JobAction } from '../types/ui';

export function PipelinesPage() {
  const { runJob, safeMode, t } = useAppState();
  const [selectedAction, setSelectedAction] = useState<JobAction | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const selectedKey = useMemo(() => selectedAction?.key, [selectedAction]);

  const closeModal = () => {
    if (isRunning) return;
    setSelectedAction(null);
  };

  const handleRun = async (action: JobAction) => {
    if (safeMode && action.key === 'mart-refresh') {
      setSelectedAction(null);
      return;
    }
    setIsRunning(true);
    try {
      await runJob(action);
      setSelectedAction(null);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <motion.div
      key="pipelines"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-7"
    >
      <section>
        <h1 className="text-4xl text-[2.1rem] font-extrabold tracking-tight">{t('pipelines.title')}</h1>
        <p className="mt-1 text-[0.98rem] text-[var(--text-muted)]">{t('pipelines.subtitle')}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pipelineActions.map((action) => {
          const disabled = safeMode && action.key === 'mart-refresh';
          return (
            <ActionCard
              key={action.key}
              action={action}
              selected={selectedKey === action.key}
              disabled={disabled}
              disabledReason={disabled ? t('pipelines.safeModeBlocked') : undefined}
              onClick={(item) => setSelectedAction(item)}
            />
          );
        })}
      </section>

      <section>
        <DataImportCard />
      </section>

      <section>
        <h2 className="text-3xl text-[2rem] font-extrabold tracking-tight">{t('pipelines.mapTitle')}</h2>
        <p className="mt-1 text-[0.98rem] text-[var(--text-muted)]">{t('pipelines.mapSubtitle')}</p>

        <Card className="subtle-grid mt-4 border-dashed p-6">
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
            {pipelineMapSteps.map((step, index) => (
              <div key={step} className="inline-flex items-center gap-2">
                <span
                  className="pill app-transition inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-[var(--text)]
                  transition-transform duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--border-strong)]
                  hover:shadow-[0_16px_36px_-24px_rgba(15,23,42,0.45)] dark:hover:shadow-[0_18px_38px_-24px_rgba(0,0,0,0.82)]"
                >
                  {step}
                </span>
                {index < pipelineMapSteps.length - 1 ? <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" /> : null}
              </div>
            ))}
          </div>
        </Card>
      </section>

      <JobConfirmModal
        open={Boolean(selectedAction)}
        action={selectedAction}
        running={isRunning}
        onClose={closeModal}
        onConfirm={handleRun}
      />
    </motion.div>
  );
}
