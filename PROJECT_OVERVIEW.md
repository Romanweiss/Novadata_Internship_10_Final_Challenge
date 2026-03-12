# PROJECT_OVERVIEW.md

## 1. Назначение проекта

`ProbablyFresh Analytics Platform` — это end-to-end платформа обработки данных от уровня источника до аналитической витрины и ML-ready фичей.

Цель:
- смоделировать production-подход в Data Engineering;
- обеспечить полный путь данных, наблюдаемость и управляемость;
- показать разделение RAW/MART и контроль качества данных.

## 2. Бизнес-контекст

Проект имитирует сценарий «данные заказчика -> аналитическая платформа исполнителя»:
- данные приходят в формате JSON;
- далее проходят ingestion, хранение, нормализацию, дедупликацию;
- формируется витрина признаков для сегментации/кластеризации клиентов;
- выгрузка результата выполняется в S3.

## 3. End-to-end архитектура

```text
JSON -> MongoDB -> Kafka -> ClickHouse RAW -> ClickHouse MART -> PySpark ETL -> S3
                             |                    |
                             |                    +-> backend API -> frontend control panel
                             +-> Grafana dashboards + alerts

Airflow orchestrates daily ETL DAG.
```

## 4. Этапы пайплайна данных

### 4.1 Генерация JSON

Файл: `src/generator/generate_data.py`

Генерируются сущности:
- `stores`
- `products`
- `customers`
- `purchases`

Особенности:
- связность через ID;
- детерминизм через seed;
- данные пишутся в `data/*`.

### 4.2 Загрузка в MongoDB

Файл: `src/loader/load_to_mongo.py`

- загрузка JSON в коллекции `stores/products/customers/purchases`;
- upsert по бизнес-ключам.

### 4.3 Streaming MongoDB -> Kafka

Файл: `src/streaming/produce_from_mongo.py`

Топики:
- `probablyfresh.stores`
- `probablyfresh.products`
- `probablyfresh.customers`
- `probablyfresh.purchases`

PII перед публикацией:
- `email`: trim + lower;
- `phone`: нормализация в E.164-подобный формат;
- one-way anonymization: `SHA-256` с солью `PII_HASH_SALT`.

### 4.4 ClickHouse RAW

Файл инициализации: `docker/clickhouse/init/01_init.sql`

RAW таблицы:
- `probablyfresh_raw.stores_raw`
- `probablyfresh_raw.products_raw`
- `probablyfresh_raw.customers_raw`
- `probablyfresh_raw.purchases_raw`
- `probablyfresh_raw.purchase_items_raw`

Также создаются Kafka Engine таблицы и MV Kafka->RAW.

### 4.5 ClickHouse MART

Файл инициализации: `docker/clickhouse/init/02_mart.sql`

MART таблицы:
- `probablyfresh_mart.stores_mart`
- `probablyfresh_mart.products_mart`
- `probablyfresh_mart.customers_mart`
- `probablyfresh_mart.purchases_mart`
- `probablyfresh_mart.purchase_items_mart`
- `probablyfresh_mart.mart_quality_stats`

Трансформации RAW->MART:
- trim/lower ключей;
- базовые валидации ID/дат;
- фильтрация некорректных строк;
- дедупликация на чтении через `FINAL` (ReplacingMergeTree).

### 4.6 PySpark ETL -> S3

Файл: `jobs/features_etl.py`

- источники: MART таблицы (`customers`, `purchases`, `products`, `purchase_items`);
- расчет 30 бинарных признаков (0/1);
- результат: CSV `analytic_result_YYYY_MM_DD.csv` в S3.

## 5. Data Quality и источники истины метрик

### 5.1 Что такое RAW, MART и quality snapshot

- RAW: события «как пришли», с минимальной обработкой.
- MART: очищенные и валидированные данные для аналитики.
- `mart_quality_stats`: snapshot-метрики качества по состоянию запуска SQL/refresh.

### 5.2 Почему цифры могут отличаться между интерфейсами

- Overview обычно показывает deduped/`FINAL`/uniq метрики MART.
- Data Quality опирается на snapshot `mart_quality_stats` (total/duplicates/invalid).
- Grafana RAW dashboard содержит mix RAW-счетчиков и quality метрик.

Это нормальное поведение, если определения метрик разные.

## 6. PII anonymization (актуальное состояние)

PII приведен к ТЗ: one-way hash, не обратимое шифрование.

Алгоритм:
- `hash = sha256((salt + ":" + normalized_value).encode("utf-8")).hexdigest()`
- `salt` = `PII_HASH_SALT`
- результат — hex-строка длины 64
- для пустых значений используется `""`

Важно:
- в payload/таблицах сохраняются поля `email_enc` и `phone_enc`;
- структура событий и DDL не меняются.

## 7. Monitoring и alerting

### Grafana

- datasource ClickHouse через provisioning;
- dashboard `ProbablyFresh RAW Overview`;
- панели по объемам и quality.

### Alerting

- алерты на метрики качества;
- отправка уведомлений в Telegram через provisioning-конфиги.

## 8. Airflow orchestration

DAG: `airflow/dags/etl_to_s3_daily.py`

Сценарий:
- проверка ClickHouse;
- запуск ETL в `app` контейнере;
- проверка наличия объекта выгрузки в S3.

Параметры:
- ежедневный запуск;
- `catchup=False`, `max_active_runs=1`.

## 9. Backend API (Django + DRF)

Backend дает:
- API для вкладок UI (`overview`, `pipelines`, `quality`, `exports`, `settings`);
- action-endpoints для ручного запуска job;
- polling статуса запусков (`runs/{id}`);
- токен-аутентификацию, OpenAPI, админку.

Основной адрес:
- `http://localhost:8001/api`

## 10. Frontend control panel (React)

Frontend предоставляет:
- 5 вкладок: Overview / Pipelines / Data Quality / Exports / Settings;
- запуск job из UI и отображение статусов;
- визуализацию метрик и health сервисов;
- настройки Safe Mode и системных подключений.

## 11. 30 признаков ETL (feature flags)

Текущий список:
1. `recurrent_buyer`
2. `delivery_user`
3. `bulk_buyer`
4. `low_cost_buyer`
5. `prefers_cash`
6. `prefers_card`
7. `weekend_shopper`
8. `weekday_shopper`
9. `night_shopper`
10. `morning_shopper`
11. `no_purchases`
12. `has_purchases_last_7d`
13. `has_purchases_last_14d`
14. `has_purchases_last_30d`
15. `has_purchases_last_90d`
16. `frequent_shopper_last_14d`
17. `high_ticket_last_90d`
18. `delivery_last_30d`
19. `cross_store_shopper_last_90d`
20. `mixed_payment_user_last_90d`
21. `bought_milk_last_7d`
22. `bought_milk_last_30d`
23. `bought_meat_last_7d`
24. `bought_meat_last_30d`
25. `bought_fruits_last_30d`
26. `bought_vegetables_last_30d`
27. `bought_bakery_last_30d`
28. `bought_organic_last_90d`
29. `high_quantity_buyer_last_30d`
30. `vegetarian_profile`

## 12. Ключевые файлы проекта

- Pipeline core: `src/generator/`, `src/loader/`, `src/streaming/`, `src/probablyfresh/core/`
- SQL init: `docker/clickhouse/init/01_init.sql`, `docker/clickhouse/init/02_mart.sql`
- ETL: `jobs/features_etl.py`
- Проверки: `scripts/smoke_check.py`, `scripts/pii_hash_selfcheck.py`
- Airflow: `airflow/dags/etl_to_s3_daily.py`
- Backend: `backend/`
- Frontend: `frontend/`
- Grafana provisioning: `grafana/`, `docker/grafana/`

## 13. Важные эксплуатационные замечания

- Порядок init критичен: сначала `01_init.sql`, потом `02_mart.sql`.
- Перед SQL init обязательно дождаться `SELECT 1` от ClickHouse.
- `.env` нельзя перезаписывать автоматически скриптами runbook.
- ETL запускать через `app` контейнер.
- При изменениях SQL init-файлов нужен полный re-init (`down -v` + повтор init).
