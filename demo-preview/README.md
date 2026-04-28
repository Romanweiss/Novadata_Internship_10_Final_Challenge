# ProbablyFresh Demo Preview

Это автономный статический preview-интерфейс ProbablyFresh, который повторяет актуальную картину UI без запуска backend, Docker, Vite или всей инфраструктуры платформы.

## Что внутри

- актуальная верхняя навигация: `Обзор`, `Пайплайны`, `Качество данных`, `Витрина признаков`, `Экспорты`, `Настройки`, `О проекте`;
- отдельная документация, открывающаяся как отдельный экран через `#documentation`;
- светлая и тёмная тема;
- переключение RU/EN;
- overview с KPI, ingestion-графиком, сервисами, платежами и последними запусками;
- pipelines с one-click actions, managed import block, pipeline map и модалкой запуска ETL с optional Parquet warning;
- data quality с duplicate cards, trend chart и таблицей качества MART;
- feature mart с карточками фич, drill-down по текущим признакам, suggested next features и collapsible matrix;
- exports с поиском и действиями preview/download;
- settings и отдельная страница `О проекте`;
- footer с creator branding: `created by + my_glif + 2026`.

## Как открыть

1. Откройте `demo-preview/index.html` двойным кликом.
2. Либо откройте этот же файл через HTML preview / Live Server в IDE.

## Что важно понимать

- это именно standalone demo preview, а не собранный frontend приложения;
- данные в нём статические, но структура экранов и ключевые UX-сценарии приведены к текущему реальному UI;
- preview не подключается к API, ClickHouse, Airflow, S3 и другим сервисам;
- его задача — быстро показать актуальную структуру интерфейса и сценарии навигации.
