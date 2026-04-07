import { AnimatePresence, motion } from 'framer-motion';
import { Info, X } from 'lucide-react';
import { createPortal } from 'react-dom';

import { Card } from '../common/Card';
import type { AppLanguage } from '../../i18n/translations';
import type { LocalizedFeatureDefinition } from '../../constants/featureDefinitions';

interface FeatureDefinitionModalProps {
  open: boolean;
  definition: LocalizedFeatureDefinition | null;
  language: AppLanguage;
  onClose: () => void;
}

function getTexts(language: AppLanguage) {
  return language === 'ru'
    ? {
        current: '\u0422\u0435\u043a\u0443\u0449\u0430\u044f \u0444\u0438\u0447\u0430',
        suggested: '\u041f\u043e\u0442\u0435\u043d\u0446\u0438\u0430\u043b\u044c\u043d\u0430\u044f \u0444\u0438\u0447\u0430',
        implemented: '\u0420\u0435\u0430\u043b\u0438\u0437\u043e\u0432\u0430\u043d\u043e',
        metadataOnly: '\u041c\u0435\u0442\u0430\u0434\u0430\u043d\u043d\u044b\u0435',
        future: '\u0421\u043b\u0435\u0434\u0443\u044e\u0449\u0430\u044f \u0438\u0442\u0435\u0440\u0430\u0446\u0438\u044f',
        technicalKey: '\u0422\u0435\u0445\u043d\u0438\u0447\u0435\u0441\u043a\u0438\u0439 \u043a\u043b\u044e\u0447',
        whyItMatters: '\u0417\u0430\u0447\u0435\u043c \u044d\u0442\u043e \u0432\u0430\u0436\u043d\u043e',
        calculation: '\u041a\u0430\u043a \u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044f',
        sources: '\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0438 \u0438 \u043f\u043e\u043b\u044f',
        tables: '\u0422\u0430\u0431\u043b\u0438\u0446\u044b',
        fields: '\u041f\u043e\u043b\u044f',
        lookback: '\u041e\u043a\u043d\u043e \u0440\u0430\u0441\u0447\u0451\u0442\u0430',
        threshold: '\u041f\u043e\u0440\u043e\u0433 / \u043f\u0440\u0430\u0432\u0438\u043b\u043e',
        interpretation: '\u041a\u0430\u043a \u0447\u0438\u0442\u0430\u0442\u044c 0 \u0438 1',
        caveats: '\u041e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d\u0438\u044f',
        implementationNote: '\u041f\u0440\u0438\u043c\u0435\u0447\u0430\u043d\u0438\u0435',
        proxies: '\u0422\u0435\u043a\u0443\u0449\u0438\u0435 proxy-\u0444\u0438\u0447\u0438',
      }
    : {
        current: 'Current feature',
        suggested: 'Suggested feature',
        implemented: 'Implemented',
        metadataOnly: 'Metadata only',
        future: 'Next iteration',
        technicalKey: 'Technical key',
        whyItMatters: 'Why it matters',
        calculation: 'How it is calculated',
        sources: 'Sources and fields',
        tables: 'Tables',
        fields: 'Fields',
        lookback: 'Lookback window',
        threshold: 'Threshold / rule',
        interpretation: 'How to read 0 and 1',
        caveats: 'Caveats',
        implementationNote: 'Implementation note',
        proxies: 'Current proxy features',
      };
}

function getStatusLabel(status: LocalizedFeatureDefinition['status'], language: AppLanguage) {
  const texts = getTexts(language);
  if (status === 'implemented') return texts.implemented;
  if (status === 'metadata-only') return texts.metadataOnly;
  return texts.future;
}

function getStatusTone(status: LocalizedFeatureDefinition['status']) {
  if (status === 'implemented') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
  if (status === 'metadata-only') return 'bg-sky-500/15 text-sky-700 dark:text-sky-300';
  return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
}

export function FeatureDefinitionModal({ open, definition, language, onClose }: FeatureDefinitionModalProps) {
  const texts = getTexts(language);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && definition ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-8 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-4xl"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onClick={(event) => event.stopPropagation()}
          >
            <Card className="max-h-[88vh] overflow-auto p-6 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)]">
                      {definition.section === 'current' ? texts.current : texts.suggested}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusTone(definition.status)}`}>
                      {getStatusLabel(definition.status, language)}
                    </span>
                    <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)]">
                      {definition.category}
                    </span>
                  </div>
                  <h3 className="text-3xl font-extrabold tracking-tight">{definition.label}</h3>
                  <p className="mt-2 text-sm text-[var(--text-muted)]">{definition.shortDescription}</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="app-transition inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:bg-black/5 dark:hover:bg-white/10"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm">
                <span className="font-semibold text-[var(--text-muted)]">{texts.technicalKey}: </span>
                <code className="font-semibold text-[var(--text)]">{definition.key}</code>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <h4 className="text-lg font-bold">{texts.whyItMatters}</h4>
                  <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{definition.whyItMatters}</p>
                </div>
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <h4 className="text-lg font-bold">{texts.calculation}</h4>
                  <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{definition.calculation}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <h4 className="text-base font-bold">{texts.sources}</h4>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{texts.tables}</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{definition.sourceTables.join(', ')}</p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{texts.fields}</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{definition.sourceFields.join(', ')}</p>
                </div>
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <h4 className="text-base font-bold">{texts.lookback}</h4>
                  <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{definition.lookbackWindow}</p>
                </div>
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <h4 className="text-base font-bold">{texts.threshold}</h4>
                  <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{definition.thresholdDescription}</p>
                </div>
              </div>

              <div className="mt-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <h4 className="text-base font-bold">{texts.interpretation}</h4>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-[var(--surface-muted)] px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">0</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">{definition.interpretationZero}</p>
                  </div>
                  <div className="rounded-2xl bg-[var(--surface-muted)] px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">1</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">{definition.interpretationOne}</p>
                  </div>
                </div>
              </div>

              {definition.caveats ? (
                <div className="mt-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <h4 className="text-base font-bold">{texts.caveats}</h4>
                  <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{definition.caveats}</p>
                </div>
              ) : null}

              {definition.implementationNote || definition.currentProxyFeatureKeys?.length ? (
                <div className="mt-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <h4 className="text-base font-bold">{texts.implementationNote}</h4>
                  {definition.implementationNote ? (
                    <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{definition.implementationNote}</p>
                  ) : null}
                  {definition.currentProxyFeatureKeys?.length ? (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{texts.proxies}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {definition.currentProxyFeatureKeys.map((item) => (
                          <span key={item} className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)]">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 flex items-start gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-muted)]">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  {language === 'ru'
                    ? '\u041e\u043f\u0440\u0435\u0434\u0435\u043b\u0435\u043d\u0438\u044f \u0432\u044b\u0440\u043e\u0432\u043d\u0435\u043d\u044b \u043f\u043e \u0442\u0435\u043a\u0443\u0449\u0435\u0439 \u043b\u043e\u0433\u0438\u043a\u0435 ETL \u0438 UI-label mapping. \u0415\u0441\u043b\u0438 \u0444\u0438\u0447\u0430 \u043f\u043e\u043a\u0430 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442 \u0442\u043e\u043b\u044c\u043a\u043e \u043a\u0430\u043a \u0438\u0434\u0435\u044f, \u044d\u0442\u043e \u044f\u0432\u043d\u043e \u043e\u0442\u043c\u0435\u0447\u0435\u043d\u043e \u0432 \u0441\u0442\u0430\u0442\u0443\u0441\u0435.'
                    : 'Definitions are aligned with the current ETL logic and UI label mapping. If a feature is only a proposal for now, that is stated explicitly in its status.'}
                </p>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}


