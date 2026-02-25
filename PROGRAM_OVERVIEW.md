# PROGRAM OVERVIEW — ProbablyFresh Analytics Platform

## 1. Назначение проекта

`probablyfresh-analytics-platform` — это end-to-end демо-пайплайн Data Engineering:

1. Генерация тестовых JSON данных.
2. Загрузка JSON в MongoDB.
3. Публикация событий из MongoDB в Kafka.
4. Запись событий в ClickHouse RAW.
5. Очистка и дедупликация в ClickHouse MART.
6. Мониторинг в Grafana + alerting.
7. Ежедневный запуск ETL в S3/MinIO через Airflow.
8. Smoke-проверка целостности всего контура.

Проект ориентирован на запуск в Docker и проверку всего тракта «от источника до витрины и выгрузки признаков».

---

## 2. Текущий функционал

### 2.1 Data generation

- Генерирует JSON в `data/stores`, `data/products`, `data/customers`, `data/purchases`.
- Объемы:
  - stores: 45
  - products: 100
  - customers: >=45 (обычно 175)
  - purchases: >=200 (обычно 200)
- Детерминизм через `SEED`.

### 2.2 Mongo loader

- Загрузка файлов в коллекции `stores`, `products`, `customers`, `purchases`.
- Upsert по бизнес-ключам.

### 2.3 Streaming Mongo -> Kafka

- Топики:
  - `probablyfresh.stores`
  - `probablyfresh.products`
  - `probablyfresh.customers`
  - `probablyfresh.purchases`
- Для `customers` и `purchases` перед Kafka:
  - `email`: trim + lower
  - `phone`: нормализация к E.164-подобному виду
  - `email` и `phone` шифруются Fernet (не hash).

### 2.4 ClickHouse RAW

- Основные RAW таблицы:
  - `stores_raw`
  - `products_raw`
  - `customers_raw`
  - `purchases_raw`
  - `purchase_items_raw` (строки чека, разложенные из массива `items`)
- Kafka Engine таблицы + MV `Kafka -> RAW`.
- Доп. MV `mv_purchase_items_from_purchases_raw` раскладывает `items` в строки.

### 2.5 ClickHouse MART

- MART таблицы на `ReplacingMergeTree(ingested_at)`:
  - `stores_mart`
  - `products_mart`
  - `customers_mart`
  - `purchases_mart`
  - `purchase_items_mart`
- MV `RAW -> MART` с очисткой и валидацией.
- Таблица качества `mart_quality_stats` + snapshot метрик.

### 2.6 Grafana

- Автосоздание datasource ClickHouse через provisioning.
- Автоимпорт dashboard `ProbablyFresh RAW Overview`.
- Alerting provisioning:
  - Telegram contact point
  - notification policy
  - alert rule `Duplicates_ratio`
  - message template.

### 2.7 PySpark ETL

`jobs/features_etl.py`:

- Читает MART через JDBC (`products_mart`, `purchase_items_mart`, `customers_mart`, `purchases_mart`).
- Считает **30 бинарных признаков** (0/1 int) на клиента.
- Результат: CSV (31 колонка: `customer_id` + 30 фич).
- Загружает файл в MinIO/S3 как `analytic_result_YYYY_MM_DD.csv`.

### 2.8 Smoke-check

`scripts/smoke_check.py` проверяет:

- RAW uniq counts (stores/products/purchases/customers).
- MART FINAL counts (`customers`, `purchases`, `purchase_items`).
- Последний `mart_quality_stats` для `purchases`.
- Наличие файла ETL в MinIO/S3 (сегодняшняя дата, размер > 1KB).
- CSV: 31 колонка и только `0/1` в feature-колонках.

### 2.9 Airflow

DAG `etl_to_s3_daily` (`airflow/dags/etl_to_s3_daily.py`):

- расписание: ежедневно в 10:00, `Europe/Moscow` (UTC+3)
- `catchup=False`, `max_active_runs=1`
- таски:
  - `wait_clickhouse`
  - `run_etl`
  - `verify_minio`

---

## 3. Архитектура потока данных

```text
JSON files
   -> MongoDB
      -> Kafka topics
         -> ClickHouse RAW
            -> ClickHouse MART
               -> Grafana dashboards/alerts
               -> PySpark ETL
                  -> S3/MinIO CSV

Airflow DAG (daily) orchestrates ETL + verification.
```

---

## 4. Docker-сервисы и роли

Файл: `docker-compose.yml`

- `zookeeper` — координация Kafka.
- `kafka` — брокер сообщений.
- `mongodb` — NoSQL источник документов.
- `clickhouse` — RAW/MART аналитический слой.
- `grafana` — визуализация + alerting.
- `app` — Python/Spark runner (включая JDBC jar).
- `airflow-postgres` — metadata DB для Airflow.
- `airflow` — webserver + scheduler (LocalExecutor).

---

## 5. Ключевые файлы и ответственность

### 5.1 Запуск и инфраструктура

- `docker-compose.yml` — весь runtime стек.
- `docker/app/Dockerfile` — app-образ с Python, Java, зависимостями и JDBC jar.
- `Makefile` — команды удобного запуска (`up/down`, `run-etl`, `smoke` и т.д.).
- `ZERO_START_DOCKER.txt` — пошаговый zero-start runbook.

### 5.2 Python скрипты

- `src/generator/generate_data.py` — генератор JSON датасета.
- `src/loader/load_to_mongo.py` — загрузка JSON в Mongo.
- `src/streaming/produce_from_mongo.py` — публикация Mongo -> Kafka + PII нормализация/шифрование.
- `jobs/features_etl.py` — расчет 30 признаков + upload CSV в MinIO/S3.
- `scripts/smoke_check.py` — smoke-проверка всего контура.

### 5.3 ClickHouse SQL

- `docker/clickhouse/init/01_init.sql` — RAW база/таблицы/Kafka Engine/MV, включая `purchase_items_raw`.
- `docker/clickhouse/init/02_mart.sql` — MART база/таблицы/MV/quality stats, включая `purchase_items_mart`.

### 5.4 Grafana

- `grafana/provisioning/datasources/clickhouse.yaml` — datasource provisioning.
- `grafana/provisioning/dashboards/dashboard.yaml` — dashboards provisioning.
- `docker/grafana/dashboards/probablyfresh_raw_overview.json` — dashboard JSON.
- `grafana/provisioning/alerting/*.yaml` — contact point / policy / rule / template.

### 5.5 Airflow

- `airflow/dags/etl_to_s3_daily.py` — ежедневный DAG ETL-to-S3.

---

## 6. Признаки в ETL (30 шт., 0/1)

Список фич в `jobs/features_etl.py`:

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

Итоговый CSV: `customer_id` + 30 feature-колонок = 31 колонка.

---

## 7. Проверка работоспособности

Рекомендуемый порядок:

1. `ZERO_START_DOCKER.txt` — полный прогон с нуля.
2. `python scripts/smoke_check.py` (через `app` контейнер) — интеграционная проверка.
3. Проверка Grafana dashboard `ProbablyFresh RAW Overview`.
4. Проверка Airflow DAG `etl_to_s3_daily` (unpause + trigger).

---

## 8. Важные практические замечания

- Перед SQL init обязательно ждать `SELECT 1` от ClickHouse.
- Если пропустить `01_init.sql`, `02_mart.sql` упадет по отсутствию RAW таблиц.
- Для ETL в Docker: `CH_HOST=clickhouse`, не `localhost`.
- `purchase_items_mart FINAL` должен быть больше `purchases_mart FINAL`.
- Файл ETL в MinIO/S3 должен быть >1KB и содержать данные, не только header.

---

## 9. Что дальше развивать

- Отдельный MART dashboard.
- Периодический auto-refresh `mart_quality_stats` по расписанию.
- CI smoke-test пайплайна.
- E2E тестирование DAG в Airflow.
- Контроль схем сообщений (schema contracts).
