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
      'feature-mart': 'Feature Mart',
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
      target: 'Target: > {value}%',
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
      alertRuleText: 'Alerts are dispatched when ratio exceeds 50% for 2 consecutive runs.',
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
    featureMart: {
      title: 'Feature Mart',
      subtitle: 'Final customer feature mart calculated by PySpark and exported to S3.',
      loading: 'Loading feature mart data...',
      errorTitle: 'Failed to load feature mart',
      errorFallback: 'Feature mart request failed.',
      emptyTitle: 'Feature export file was not found yet.',
      emptyDescription: 'Run ETL first to generate and upload the feature CSV.',
      tableTitle: 'Customer Feature Matrix',
      showTable: 'Show table',
      hideTable: 'Hide table',
      tableCollapsedHint: 'Table is collapsed to keep the page compact. Click "Show table" to open it.',
      customerId: 'customer_id',
      searchPlaceholder: 'Search by customer_id...',
      pageSize: 'Rows per page',
      noRows: 'No rows matched the current filter.',
      noNonZeroSummary: 'No features with value = 1 for current dataset.',
      rowsLabel: 'Showing {shown} of {total} rows',
      paginationPrev: 'Prev',
      paginationNext: 'Next',
      paginationPage: 'Page {current} / {total}',
      sourceValue: 'S3 / ETL CSV',
      summaryTitle: 'Feature Summary (count of value = 1)',
      featureNames: {
        recurrent_buyer: 'Recurrent buyer',
        delivery_user: 'Delivery user',
        bulk_buyer: 'Bulk buyer',
        low_cost_buyer: 'Low-cost buyer',
        prefers_cash: 'Prefers cash',
        prefers_card: 'Prefers card',
        weekend_shopper: 'Weekend shopper',
        weekday_shopper: 'Weekday shopper',
        night_shopper: 'Shops after 20:00',
        morning_shopper: 'Shops before 10:00',
        no_purchases: 'No purchases',
        has_purchases_last_7d: 'Purchases in last 7d',
        has_purchases_last_14d: 'Purchases in last 14d',
        has_purchases_last_30d: 'Purchases in last 30d',
        has_purchases_last_90d: 'Purchases in last 90d',
        frequent_shopper_last_14d: 'Frequent shopper in last 14d',
        high_ticket_last_90d: 'High ticket in last 90d',
        delivery_last_30d: 'Delivery in last 30d',
        cross_store_shopper_last_90d: 'Cross-store shopper in last 90d',
        mixed_payment_user_last_90d: 'Used mixed payments in last 90d',
        bought_milk_last_7d: 'Bought dairy in last 7d',
        bought_milk_last_30d: 'Bought dairy in last 30d',
        bought_meat_last_7d: 'Bought meat in last 7d',
        bought_meat_last_30d: 'Bought meat in last 30d',
        bought_fruits_last_30d: 'Bought fruits in last 30d',
        bought_vegetables_last_30d: 'Bought vegetables in last 30d',
        bought_bakery_last_30d: 'Bought bakery in last 30d',
        bought_organic_last_90d: 'Bought organic in last 90d',
        high_quantity_buyer_last_30d: 'High quantity buyer in last 30d',
        vegetarian_profile: 'Vegetarian profile',
      },
      kpi: {
        totalCustomers: 'Total customers',
        totalFeatures: 'Total features',
        lastExport: 'Last export',
        source: 'Data source',
      },
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
      version: 'Version: 0.7.0',
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
      'feature-mart': 'Витрина признаков',
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
      target: 'Цель: > {value}%',
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
      alertRuleText: 'Алерт отправляется, когда ratio превышает 50% в 2 последовательных запусках.',
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
    featureMart: {
      title: 'Витрина признаков',
      subtitle: 'Финальная ETL-витрина клиентских признаков, рассчитанная PySpark и выгруженная в S3.',
      loading: 'Загрузка данных витрины...',
      errorTitle: 'Не удалось загрузить витрину признаков',
      errorFallback: 'Ошибка запроса витрины признаков.',
      emptyTitle: 'Файл витрины пока не найден.',
      emptyDescription: 'Сначала запустите ETL, чтобы сформировать и выгрузить CSV.',
      tableTitle: 'Матрица признаков клиентов',
      showTable: 'Показать таблицу',
      hideTable: 'Скрыть таблицу',
      tableCollapsedHint: 'Таблица скрыта, чтобы не занимать экран. Нажмите «Показать таблицу».',
      customerId: 'customer_id',
      searchPlaceholder: 'Поиск по customer_id...',
      pageSize: 'Строк на странице',
      noRows: 'Нет строк по текущему фильтру.',
      noNonZeroSummary: 'Нет признаков со значением 1 для текущего набора данных.',
      rowsLabel: 'Показано {shown} из {total} строк',
      paginationPrev: 'Назад',
      paginationNext: 'Вперёд',
      paginationPage: 'Страница {current} / {total}',
      sourceValue: 'S3 / ETL CSV',
      summaryTitle: 'Сводка по признакам (только ненулевые)',
      featureNames: {
        recurrent_buyer: 'Повторный покупатель',
        delivery_user: 'Пользователь доставки',
        bulk_buyer: 'Покупатель с крупными покупками',
        low_cost_buyer: 'Покупатель с низким средним чеком',
        prefers_cash: 'Предпочитает наличные',
        prefers_card: 'Предпочитает карту',
        weekend_shopper: 'Покупает в выходные',
        weekday_shopper: 'Покупает в будни',
        night_shopper: 'Делал покупки после 20:00',
        morning_shopper: 'Делал покупки до 10:00',
        no_purchases: 'Нет покупок',
        has_purchases_last_7d: 'Есть покупки за 7 дней',
        has_purchases_last_14d: 'Есть покупки за 14 дней',
        has_purchases_last_30d: 'Есть покупки за 30 дней',
        has_purchases_last_90d: 'Есть покупки за 90 дней',
        frequent_shopper_last_14d: 'Частый покупатель за 14 дней',
        high_ticket_last_90d: 'Крупный чек за 90 дней',
        delivery_last_30d: 'Была доставка за 30 дней',
        cross_store_shopper_last_90d: 'Покупал в разных магазинах за 90 дней',
        mixed_payment_user_last_90d: 'Использовал смешанную оплату за 90 дней',
        bought_milk_last_7d: 'Покупал молочные за 7 дней',
        bought_milk_last_30d: 'Покупал молочные за 30 дней',
        bought_meat_last_7d: 'Покупал мясо за 7 дней',
        bought_meat_last_30d: 'Покупал мясо за 30 дней',
        bought_fruits_last_30d: 'Покупал фрукты за 30 дней',
        bought_vegetables_last_30d: 'Покупал овощи за 30 дней',
        bought_bakery_last_30d: 'Покупал выпечку за 30 дней',
        bought_organic_last_90d: 'Покупал органик за 90 дней',
        high_quantity_buyer_last_30d: 'Покупал большими объёмами за 30 дней',
        vegetarian_profile: 'Вегетарианский профиль',
      },
      kpi: {
        totalCustomers: 'Всего клиентов в витрине',
        totalFeatures: 'Всего признаков',
        lastExport: 'Последний экспорт',
        source: 'Источник данных',
      },
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
      version: 'Версия: 0.7.0',
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
