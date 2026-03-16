import type { AppLanguage } from '../i18n/translations';

interface DocumentationFeature {
  title: string;
  description: string;
}

interface DocumentationSection {
  id: string;
  title: string;
  summary: string;
  features: DocumentationFeature[];
}

interface DocumentationContent {
  title: string;
  subtitle: string;
  noteTitle: string;
  noteDescription: string;
  sections: DocumentationSection[];
}

export const documentationContent: Record<AppLanguage, DocumentationContent> = {
  en: {
    title: 'Platform Documentation',
    subtitle:
      'A concise guide to every screen of the ProbablyFresh control panel: what each section shows, what actions are available, and how to read the results.',
    noteTitle: 'How to use this page',
    noteDescription:
      'Open the section you need and use it as a working guide while navigating the interface. The content follows the same menu structure as the application itself.',
    sections: [
      {
        id: 'global',
        title: 'Global Controls',
        summary: 'Elements available in the header regardless of the active page.',
        features: [
          {
            title: 'System Status',
            description:
              'Shows whether the main platform services are responding normally. This is the fastest visual signal that the control panel is connected to live infrastructure.',
          },
          {
            title: 'Documentation',
            description:
              'Opens this reference page in a separate browser tab so the main workspace remains available while reading the help text.',
          },
          {
            title: 'Language Switch',
            description:
              'Switches the interface language between English and Russian. The selected language is reused by the documentation page as well.',
          },
          {
            title: 'Theme Switch',
            description:
              'Toggles light and dark appearance. The selected theme is stored locally and applied across the whole control panel.',
          },
        ],
      },
      {
        id: 'overview',
        title: 'Overview',
        summary: 'The dashboard screen for quick operational awareness.',
        features: [
          {
            title: 'KPI Cards',
            description:
              'Show the top-level counts used most often during quick health checks: unique stores, unique purchases, MART customers and MART items.',
          },
          {
            title: 'Ingestion Activity',
            description:
              'Displays the ingestion trend for the last 7 days. The Y-axis scale is calculated from the current values, while the X-axis shows weekday, date, and year for easier reading.',
          },
          {
            title: 'Services Health',
            description:
              'Lists the main infrastructure services and their current status so you can spot unavailable or degraded components without leaving the dashboard.',
          },
          {
            title: 'Purchases by Payment Method',
            description:
              'Shows the distribution of purchases by payment method. This helps validate that the source mix looks realistic and stable.',
          },
          {
            title: 'Last Runs',
            description:
              'Summarizes recent task executions and their statuses. Use it to confirm whether pipeline actions finished successfully or require investigation.',
          },
        ],
      },
      {
        id: 'pipelines',
        title: 'Pipelines',
        summary: 'The control center for manual actions and managed data import.',
        features: [
          {
            title: 'One-click Actions',
            description:
              'Buttons for the main operational steps: data generation, MongoDB load, Kafka producer run, MART refresh, feature ETL and Airflow DAG trigger.',
          },
          {
            title: 'Run Confirmation',
            description:
              'A confirmation dialog appears before a task starts. It makes manual runs explicit and reduces accidental execution of resource-consuming jobs.',
          },
          {
            title: 'Managed Data Import',
            description:
              'Lets you upload a file, choose an entity type, start validation, and watch the batch progress. This ingestion path is independent from the main pipeline and does not break backward compatibility.',
          },
          {
            title: 'Batch Status, Errors and Replay',
            description:
              'Shows the latest batch status, counters, validation errors, staging rows, and replay history. Replay allows reprocessing the same uploaded file without resubmitting it.',
          },
          {
            title: 'Pipeline Map',
            description:
              'A compact architecture map of the current data flow from JSON through MongoDB, Kafka, ClickHouse RAW/MART, Spark and S3.',
          },
        ],
      },
      {
        id: 'quality',
        title: 'Data Quality',
        summary: 'The screen for duplicate monitoring and MART quality tracking.',
        features: [
          {
            title: 'Overall Duplicates Ratio',
            description:
              'Displays the current duplicate ratio and the target threshold. It is the quickest indicator of whether the pipeline is still within acceptable quality bounds.',
          },
          {
            title: 'Quality Status',
            description:
              'Explains whether the current ratio is acceptable, close to the limit, or already problematic so the screen is readable without manual interpretation.',
          },
          {
            title: 'Alert Status',
            description:
              'Shows whether alerts are enabled and when the last alert was triggered. This helps verify that monitoring is not silently disabled.',
          },
          {
            title: 'Duplicates Trend',
            description:
              'Tracks duplicate ratio across the latest runs. Use it to see whether the problem is persistent, improving, or getting worse.',
          },
          {
            title: 'MART Quality Stats',
            description:
              'Compares RAW totals, valid MART rows, duplicates and invalid rows per entity. This is the main detailed table for quality diagnostics.',
          },
        ],
      },
      {
        id: 'feature-mart',
        title: 'Feature Mart',
        summary: 'The UI for the final customer feature mart built by PySpark and exported to S3.',
        features: [
          {
            title: 'Feature KPI Cards',
            description:
              'Show the number of customers in the exported mart, the number of features, the latest export file and the current data source.',
          },
          {
            title: 'Feature Summary',
            description:
              'Highlights only the features with non-zero counts. This keeps the screen compact while still showing which customer traits are present in the current export.',
          },
          {
            title: 'Collapsible Feature Table',
            description:
              'The full customer-by-feature matrix can be opened on demand. This keeps the page readable when you only need the summary.',
          },
          {
            title: 'Search and Pagination',
            description:
              'Help you inspect the export by customer_id without loading the entire table into view at once.',
          },
        ],
      },
      {
        id: 'exports',
        title: 'Exports',
        summary: 'The catalog of analytical files prepared for downstream use.',
        features: [
          {
            title: 'Search',
            description:
              'Filters export files by filename or date so it is easier to locate a specific result without scanning the full list.',
          },
          {
            title: 'Export List',
            description:
              'Shows file name, generation date, row count, size and readiness state. This is the main operational view of available outputs.',
          },
          {
            title: 'Open and Download',
            description:
              'Provides direct actions for reviewing or downloading a prepared export once it is available.',
          },
        ],
      },
      {
        id: 'settings',
        title: 'Settings',
        summary: 'Operational safety and connection overview for the control panel.',
        features: [
          {
            title: 'Safe Mode',
            description:
              'Blocks potentially destructive actions. This is the main safety switch used during demos, reviews and cautious operational work.',
          },
          {
            title: 'Service Connections',
            description:
              'Lists the key service endpoints used by the platform so you can confirm target systems and integration points.',
          },
          {
            title: 'About Platform',
            description:
              'Explains the role of the control panel and shows the current UI version for reference.',
          },
        ],
      },
    ],
  },
  ru: {
    title: 'Документация по платформе',
    subtitle:
      'Понятное описание всех экранов ProbablyFresh control panel: что показывает каждое подменю, какие действия доступны и как интерпретировать результат.',
    noteTitle: 'Как пользоваться этой страницей',
    noteDescription:
      'Откройте нужный раздел и используйте его как рабочую подсказку во время навигации по интерфейсу. Структура документа повторяет структуру меню приложения.',
    sections: [
      {
        id: 'global',
        title: 'Общие элементы интерфейса',
        summary: 'Элементы шапки, доступные вне зависимости от того, какая страница сейчас открыта.',
        features: [
          {
            title: 'Статус системы',
            description:
              'Показывает, что ключевые сервисы платформы отвечают штатно. Это самый быстрый визуальный индикатор того, что control panel подключён к живой инфраструктуре.',
          },
          {
            title: 'Документация',
            description:
              'Открывает эту справочную страницу в отдельной вкладке браузера, чтобы можно было читать описание и одновременно работать в основном интерфейсе.',
          },
          {
            title: 'Переключение языка',
            description:
              'Меняет язык интерфейса между русским и английским. Документация открывается в том же языке, который сейчас выбран в приложении.',
          },
          {
            title: 'Переключение темы',
            description:
              'Переключает светлую и тёмную тему. Выбранная тема сохраняется локально и применяется ко всему control panel.',
          },
        ],
      },
      {
        id: 'overview',
        title: 'Обзор',
        summary: 'Главный дашборд для быстрого понимания текущего состояния платформы.',
        features: [
          {
            title: 'KPI-карточки',
            description:
              'Показывают основные счётчики, которые чаще всего нужны при быстрой проверке состояния: уникальные магазины, уникальные покупки, клиенты MART и позиции MART.',
          },
          {
            title: 'Активность загрузки',
            description:
              'Показывает тренд ingestion за последние 7 дней. Масштаб по оси Y подбирается автоматически по текущим значениям, а по оси X видны день недели, дата и год.',
          },
          {
            title: 'Состояние сервисов',
            description:
              'Список ключевых инфраструктурных сервисов с их текущим статусом. Нужен, чтобы сразу увидеть недоступные или деградировавшие компоненты.',
          },
          {
            title: 'Покупки по способу оплаты',
            description:
              'Показывает распределение покупок по типу оплаты. Это помогает быстро понять, выглядит ли поток данных правдоподобно и стабильно.',
          },
          {
            title: 'Последние запуски',
            description:
              'Сводка последних задач и их статусов. Используется, чтобы быстро подтвердить успешность ручных запусков или заметить проблему.',
          },
        ],
      },
      {
        id: 'pipelines',
        title: 'Пайплайны',
        summary: 'Экран для ручного управления задачами и управляемой загрузки данных.',
        features: [
          {
            title: 'One-click действия',
            description:
              'Набор основных операционных запусков: генерация данных, загрузка в MongoDB, producer в Kafka, refresh MART, запуск feature ETL и запуск Airflow DAG.',
          },
          {
            title: 'Подтверждение запуска',
            description:
              'Перед стартом задачи открывается модальное подтверждение. Это делает ручной запуск осознанным и уменьшает риск случайного выполнения ресурсоёмкой операции.',
          },
          {
            title: 'Загрузка данных',
            description:
              'Позволяет выбрать файл, указать тип сущности, запустить валидацию и наблюдать за progress batch. Этот путь ingestion изолирован от основного pipeline и не ломает backward compatibility.',
          },
          {
            title: 'Статус batch, ошибки и replay',
            description:
              'Показывает статус последнего batch, счётчики строк, ошибки валидации, данные staging-слоя и историю повторных запусков. Replay позволяет заново обработать тот же файл без повторной загрузки.',
          },
          {
            title: 'Карта пайплайна',
            description:
              'Компактная схема текущего потока данных: от JSON через MongoDB, Kafka, ClickHouse RAW/MART, Spark и до S3.',
          },
        ],
      },
      {
        id: 'quality',
        title: 'Качество данных',
        summary: 'Экран для контроля дубликатов и качества загрузки в MART.',
        features: [
          {
            title: 'Общий коэффициент дубликатов',
            description:
              'Показывает текущую долю дубликатов и целевой порог. Это самый быстрый индикатор того, укладывается ли pipeline в допустимые границы качества.',
          },
          {
            title: 'Статус качества',
            description:
              'Текстом объясняет, находится ли текущее качество в норме, близко к порогу или уже требует действий. Это избавляет от необходимости интерпретировать цифру вручную.',
          },
          {
            title: 'Статус алертов',
            description:
              'Показывает, включены ли алерты и когда был последний алерт. Нужен, чтобы убедиться, что мониторинг не отключён незаметно.',
          },
          {
            title: 'Тренд дубликатов',
            description:
              'Показывает динамику ratio по последним запускам. Помогает понять, проблема временная, стабильная или усиливается.',
          },
          {
            title: 'Статистика качества MART',
            description:
              'Сравнивает объём RAW, валидный MART, дубликаты и невалидные строки по каждой сущности. Это основная детализация для диагностики качества.',
          },
        ],
      },
      {
        id: 'feature-mart',
        title: 'Витрина признаков',
        summary: 'Экран финальной клиентской feature-витрины, рассчитанной PySpark и выгруженной в S3.',
        features: [
          {
            title: 'KPI витрины',
            description:
              'Показывают число клиентов в выгрузке, количество признаков, имя последнего экспортного файла и источник данных.',
          },
          {
            title: 'Сводка по признакам',
            description:
              'Показывает только ненулевые признаки, чтобы экран оставался компактным, но при этом было видно, какие клиентские характеристики реально присутствуют в текущем экспорте.',
          },
          {
            title: 'Сворачиваемая таблица признаков',
            description:
              'Полная матрица клиент-признаки открывается только по требованию. Так страница не перегружается, если нужен только summary-уровень.',
          },
          {
            title: 'Поиск и пагинация',
            description:
              'Позволяют анализировать экспорт по `customer_id`, не раскрывая всю таблицу целиком.',
          },
        ],
      },
      {
        id: 'exports',
        title: 'Экспорты',
        summary: 'Каталог аналитических файлов, подготовленных для downstream-использования.',
        features: [
          {
            title: 'Поиск',
            description:
              'Фильтрует экспорты по имени файла или дате, чтобы можно было быстро найти нужный результат без ручного просмотра всего списка.',
          },
          {
            title: 'Список экспортов',
            description:
              'Показывает имя файла, дату генерации, число строк, размер и статус готовности. Это основное операционное представление доступных результатов.',
          },
          {
            title: 'Открыть и скачать',
            description:
              'Даёт прямые действия для просмотра или скачивания готового экспорта, когда он уже доступен.',
          },
        ],
      },
      {
        id: 'settings',
        title: 'Настройки',
        summary: 'Экран операционной безопасности и обзора сервисных подключений.',
        features: [
          {
            title: 'Safe Mode',
            description:
              'Блокирует потенциально разрушительные действия. Это основной защитный переключатель для демонстраций, проверок и осторожной работы с системой.',
          },
          {
            title: 'Подключения сервисов',
            description:
              'Показывает ключевые адреса и точки интеграции платформы, чтобы можно было быстро проверить, к каким системам подключён control panel.',
          },
          {
            title: 'О платформе',
            description:
              'Кратко объясняет роль control panel и показывает текущую версию интерфейса.',
          },
        ],
      },
    ],
  },
};
