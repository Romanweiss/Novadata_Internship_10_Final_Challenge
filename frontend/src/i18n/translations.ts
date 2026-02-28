export type AppLanguage = 'en' | 'ru';

type TranslationParams = Record<string, string | number>;

type DictionaryNode = string | { [key: string]: DictionaryNode };

const translations: Record<AppLanguage, DictionaryNode> = {
  en: {
    header: {
      allSystemsNominal: 'All systems nominal',
      docs: 'Docs',
      toggleLanguage: 'Switch language',
      toggleTheme: 'Toggle theme',
    },
    nav: {
      overview: 'Overview',
      pipelines: 'Pipelines',
      'data-quality': 'Data Quality',
      exports: 'Exports',
      settings: 'Settings',
    },
    kpi: {
      stores: 'Stores (uniq)',
      purchases: 'Purchases (uniq)',
      customers: 'Customers (mart)',
      items: 'Items (mart)',
    },
    overview: {
      ingestionTitle: 'Ingestion Activity (Last 7 Days)',
      paymentsTitle: 'Purchases by Payment Method',
      servicesHealthTitle: 'Services Health',
      lastRunsTitle: 'Last Runs',
    },
    pipelines: {
      title: 'One-click actions',
      subtitle: 'Manually trigger data pipeline jobs and transformations.',
      mapTitle: 'Pipeline Map',
      mapSubtitle: 'Data flow architecture across services.',
      safeModeBlocked: 'Safe Mode is enabled, action is blocked.',
    },
    actions: {
      'generate-data': {
        title: 'Generate Data',
        description: 'Synthesizes mock purchases and stores',
      },
      'load-nosql': {
        title: 'Load to MongoDB',
        description: 'Dumps raw JSON events to MongoDB',
      },
      'run-producer': {
        title: 'Produce to Kafka',
        description: 'Streams events from Mongo to Kafka topic',
      },
      'mart-refresh': {
        title: 'Refresh MART',
        description: 'Materializes ClickHouse views',
      },
      'run-etl': {
        title: 'Run Features ETL',
        description: 'Spark job to calculate ML features',
      },
      'trigger-airflow-dag': {
        title: 'Trigger Airflow DAG',
        description: 'Runs the nightly orchestration DAG',
      },
    },
    jobs: {
      'generate-data': 'Generate Data',
      'load-nosql': 'Load to MongoDB',
      'run-producer': 'Produce to Kafka',
      'mart-refresh': 'Refresh MART',
      'run-etl': 'Run Features ETL',
      'trigger-airflow-dag': 'Trigger Airflow DAG',
    },
    modal: {
      runAction: 'Run {title}',
      warning:
        'Are you sure you want to trigger this action manually? This will interact with configured services and may consume resources.',
      cancel: 'Cancel',
      runJob: 'Run Job',
    },
    toast: {
      safeModeUpdatedTitle: 'Safe mode updated',
      safeModeUpdatedDescription: 'Safe mode is now {state}.',
      safeModeUpdateLocalOnlyTitle: 'Safe mode updated locally',
      safeModeUpdateLocalOnlyDescription:
        'Backend settings endpoint is unavailable, local state is still applied.',
      safeModeStateEnabled: 'enabled',
      safeModeStateDisabled: 'disabled',
      jobStartedTitle: 'Job started',
      jobStartedDescription: '{job} was queued and is running.',
      jobCompletedTitle: 'Job completed',
      jobCompletedDescription: '{job} finished successfully.',
      jobFailedTitle: 'Job failed',
      jobFailedDescription: '{job} failed. Check logs before retry.',
      jobTimeoutTitle: 'Job timeout',
      jobTimeoutDescription: '{job} exceeded polling timeout.',
      jobStartFailedTitle: 'Job start failed',
      jobStartFailedDescription: 'Failed to trigger backend action.',
      actionBlockedTitle: 'Action blocked',
      actionBlockedDescription: 'Disable Safe Mode to run this action.',
    },
    dataQuality: {
      overallDuplicatesRatio: 'Overall Duplicates Ratio',
      target: 'Target: < {value}%',
      qualityGood: 'Quality is Good',
      qualityWarn: 'Quality Needs Attention',
      qualityBad: 'Quality is Bad',
      qualityGoodDescription: 'The current duplication ratio is within acceptable limits.',
      qualityWarnDescription: 'Duplicates ratio is close to the target threshold.',
      qualityBadDescription: 'Duplicates ratio is above the allowed threshold and needs action.',
      alertStatus: 'Alert Status',
      telegramAlerts: 'Telegram Alerts',
      enabled: 'ENABLED',
      disabled: 'DISABLED',
      lastAlertTriggered: 'Last Alert Triggered',
      noAlerts: 'No alerts',
      alertRuleText: 'Alerts are dispatched when ratio exceeds 10% for 2 consecutive runs.',
      duplicatesTrend: 'Duplicates Trend (Last 10 runs)',
      martQualityStats: 'MART Quality Stats',
      entity: 'Entity',
      totalRaw: 'Total Raw',
      validMart: 'Valid MART',
      duplicates: 'Duplicates',
      invalid: 'Invalid',
      ratio: 'Ratio',
    },
    exports: {
      title: 'S3 Exports',
      searchPlaceholder: 'Search files or dates...',
      filename: 'Filename',
      date: 'Date',
      rows: 'Rows',
      size: 'Size',
      status: 'Status',
      actions: 'Actions',
      ready: 'Ready',
      processing: 'Processing',
      noExports: 'No exports found.',
      view: 'View',
      download: 'Download',
    },
    settings: {
      title: 'System Settings',
      subtitle: 'Configure connections and security preferences.',
      safeMode: 'Safe Mode',
      safeModeDescription:
        'When enabled, destructive actions (like dropping tables or force-refreshing MART) are blocked.',
      serviceConnections: 'Service Connections',
      about: 'About ProbablyFresh',
      aboutDescription:
        'ProbablyFresh Control Panel is the centralized management dashboard for observing and operating the data platform. It provides real-time visibility into ingestion pipelines, data quality metrics in the MART layer, and easy access to analytical exports.',
      version: 'Version: 2.1.0-mock',
      environment: 'Environment: Staging',
    },
    status: {
      success: 'success',
      failed: 'failed',
      running: 'running',
    },
  },
  ru: {
    header: {
      allSystemsNominal: 'Все системы в норме',
      docs: 'Документация',
      toggleLanguage: 'Сменить язык',
      toggleTheme: 'Сменить тему',
    },
    nav: {
      overview: 'Обзор',
      pipelines: 'Пайплайны',
      'data-quality': 'Качество данных',
      exports: 'Экспорты',
      settings: 'Настройки',
    },
    kpi: {
      stores: 'Магазины (uniq)',
      purchases: 'Покупки (uniq)',
      customers: 'Клиенты (mart)',
      items: 'Позиции (mart)',
    },
    overview: {
      ingestionTitle: 'Активность загрузки (последние 7 дней)',
      paymentsTitle: 'Покупки по способу оплаты',
      servicesHealthTitle: 'Состояние сервисов',
      lastRunsTitle: 'Последние запуски',
    },
    pipelines: {
      title: 'One-click действия',
      subtitle: 'Ручной запуск задач пайплайна и трансформаций.',
      mapTitle: 'Карта пайплайна',
      mapSubtitle: 'Архитектура потока данных между сервисами.',
      safeModeBlocked: 'Включен Safe Mode, действие заблокировано.',
    },
    actions: {
      'generate-data': {
        title: 'Сгенерировать данные',
        description: 'Создает тестовые покупки и магазины',
      },
      'load-nosql': {
        title: 'Загрузить в MongoDB',
        description: 'Загружает сырые JSON-события в MongoDB',
      },
      'run-producer': {
        title: 'Отправить в Kafka',
        description: 'Потоково отправляет события из Mongo в Kafka топик',
      },
      'mart-refresh': {
        title: 'Обновить MART',
        description: 'Материализует представления ClickHouse',
      },
      'run-etl': {
        title: 'Запустить Features ETL',
        description: 'Spark-задача расчета ML-признаков',
      },
      'trigger-airflow-dag': {
        title: 'Запустить Airflow DAG',
        description: 'Запускает ночной orchestration DAG',
      },
    },
    jobs: {
      'generate-data': 'Сгенерировать данные',
      'load-nosql': 'Загрузить в MongoDB',
      'run-producer': 'Отправить в Kafka',
      'mart-refresh': 'Обновить MART',
      'run-etl': 'Запустить Features ETL',
      'trigger-airflow-dag': 'Запустить Airflow DAG',
    },
    modal: {
      runAction: 'Запустить {title}',
      warning:
        'Вы уверены, что хотите запустить это действие вручную? Будут задействованы настроенные сервисы и ресурсы.',
      cancel: 'Отмена',
      runJob: 'Запустить задачу',
    },
    toast: {
      safeModeUpdatedTitle: 'Safe Mode обновлен',
      safeModeUpdatedDescription: 'Safe Mode сейчас {state}.',
      safeModeUpdateLocalOnlyTitle: 'Safe Mode обновлен локально',
      safeModeUpdateLocalOnlyDescription:
        'Настройки backend недоступны, локальное состояние все равно применено.',
      safeModeStateEnabled: 'включен',
      safeModeStateDisabled: 'выключен',
      jobStartedTitle: 'Задача запущена',
      jobStartedDescription: 'Задача "{job}" поставлена в очередь и выполняется.',
      jobCompletedTitle: 'Задача завершена',
      jobCompletedDescription: 'Задача "{job}" выполнена успешно.',
      jobFailedTitle: 'Ошибка задачи',
      jobFailedDescription: 'Задача "{job}" завершилась ошибкой. Проверьте логи.',
      jobTimeoutTitle: 'Таймаут задачи',
      jobTimeoutDescription: 'Задача "{job}" превысила лимит ожидания.',
      jobStartFailedTitle: 'Не удалось запустить задачу',
      jobStartFailedDescription: 'Не удалось вызвать backend action.',
      actionBlockedTitle: 'Действие заблокировано',
      actionBlockedDescription: 'Отключите Safe Mode для выполнения этого действия.',
    },
    dataQuality: {
      overallDuplicatesRatio: 'Общий коэффициент дубликатов',
      target: 'Цель: < {value}%',
      qualityGood: 'Качество хорошее',
      qualityWarn: 'Качество требует внимания',
      qualityBad: 'Качество плохое',
      qualityGoodDescription: 'Текущая доля дубликатов находится в допустимых пределах.',
      qualityWarnDescription: 'Доля дубликатов близка к целевому порогу.',
      qualityBadDescription: 'Доля дубликатов выше допустимого порога и требует действий.',
      alertStatus: 'Статус алертов',
      telegramAlerts: 'Telegram-алерты',
      enabled: 'ВКЛЮЧЕНЫ',
      disabled: 'ВЫКЛЮЧЕНЫ',
      lastAlertTriggered: 'Последний алерт',
      noAlerts: 'Алертов нет',
      alertRuleText: 'Алерт отправляется, когда ratio превышает 10% в 2 последовательных запусках.',
      duplicatesTrend: 'Тренд дубликатов (последние 10 запусков)',
      martQualityStats: 'Статистика качества MART',
      entity: 'Сущность',
      totalRaw: 'Всего RAW',
      validMart: 'Валидный MART',
      duplicates: 'Дубликаты',
      invalid: 'Невалидные',
      ratio: 'Доля',
    },
    exports: {
      title: 'Экспорты S3',
      searchPlaceholder: 'Поиск по файлам или датам...',
      filename: 'Файл',
      date: 'Дата',
      rows: 'Строки',
      size: 'Размер',
      status: 'Статус',
      actions: 'Действия',
      ready: 'Готово',
      processing: 'В обработке',
      noExports: 'Экспорты не найдены.',
      view: 'Открыть',
      download: 'Скачать',
    },
    settings: {
      title: 'Настройки системы',
      subtitle: 'Управление подключениями и параметрами безопасности.',
      safeMode: 'Safe Mode',
      safeModeDescription:
        'Когда включен, потенциально разрушительные действия (например drop таблиц или force-refresh MART) блокируются.',
      serviceConnections: 'Подключения сервисов',
      about: 'О ProbablyFresh',
      aboutDescription:
        'ProbablyFresh Control Panel — централизованный дашборд для наблюдения и управления data-платформой. Он показывает состояние ingestion-пайплайнов, метрики качества в MART-слое и быстрый доступ к аналитическим экспортам.',
      version: 'Версия: 2.1.0-mock',
      environment: 'Окружение: Staging',
    },
    status: {
      success: 'успешно',
      failed: 'ошибка',
      running: 'выполняется',
    },
  },
};

function resolvePath(source: DictionaryNode, path: string): string | undefined {
  const chunks = path.split('.');
  let current: DictionaryNode | undefined = source;

  for (const chunk of chunks) {
    if (typeof current !== 'object' || current === null || !(chunk in current)) {
      return undefined;
    }
    current = current[chunk];
  }

  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

export function translate(language: AppLanguage, key: string, params?: TranslationParams): string {
  const localized = resolvePath(translations[language], key);
  if (localized) return interpolate(localized, params);

  const fallback = resolvePath(translations.en, key);
  if (fallback) return interpolate(fallback, params);

  return key;
}
