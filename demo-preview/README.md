# ProbablyFresh Demo Preview

Это автономная демонстрационная версия интерфейса ProbablyFresh для показа без запуска инфраструктуры.

## Что это

- standalone preview UI;
- полностью на mock-данных;
- не требует backend, Docker, npm, Vite или сборки.

## Как открыть

1. Откройте `demo-preview/index.html` двойным кликом в проводнике.
2. Либо откройте этот же файл через расширение Live Server / HTML Preview в IDE.

## Что внутри

- вкладки: `Overview`, `Pipelines`, `Data Quality`, `Exports`, `Settings`;
- переключение темы (light/dark);
- переключение языка (RU/EN);
- One-click actions + модалка запуска job;
- toast-уведомления (автозакрытие, пауза при hover);
- safe mode с блокировкой destructive action (`Refresh MART`);
- SVG-графики: ingestion line+gradient, payments donut, duplicates trend;
- таблицы quality/exports, services health, last runs.

## Важно

Это только preview-интерфейс для демонстрации UX.  
К данным backend/API/ClickHouse эта версия не подключается.

