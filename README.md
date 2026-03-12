# ProbablyFresh Analytics Platform

End-to-end Data Engineering pipeline:

`JSON -> MongoDB -> Kafka -> ClickHouse RAW -> ClickHouse MART -> PySpark ETL -> S3`

Дополнительно:
- Grafana (дашборды + алерты),
- Airflow (ежедневный orchestration),
- Django backend API + React frontend (панель управления).

## 1) Архитектура

```text
JSON files
  -> MongoDB
  -> Kafka topics
  -> ClickHouse RAW
  -> ClickHouse MART
  -> PySpark features ETL
  -> S3 (analytic_result_YYYY_MM_DD.csv)
```

## 2) Ключевые сервисы в `docker-compose.yml`

- `zookeeper`, `kafka` — шина событий.
- `mongodb` — источник документов.
- `clickhouse` — RAW/MART слой.
- `app` — выполнение Python/Spark job.
- `grafana` — наблюдаемость и алерты.
- `airflow-postgres`, `airflow` — orchestration DAG.
- `backend` — Django API.
- `frontend` — React UI (Vite).

## 3) Ключевые файлы проекта

### Pipeline ядро
- `src/generator/generate_data.py` — генерация JSON.
- `src/loader/load_to_mongo.py` — загрузка JSON в MongoDB.
- `src/streaming/produce_from_mongo.py` — публикация Mongo -> Kafka.
- `src/probablyfresh/core/normalization.py` — нормализация email/phone.
- `src/probablyfresh/core/crypto_utils.py` — one-way PII hash (`SHA-256 + salt`).
- `docker/clickhouse/init/01_init.sql` — RAW, Kafka Engine, MV Kafka->RAW.
- `docker/clickhouse/init/02_mart.sql` — MART, MV RAW->MART, quality snapshot.
- `jobs/features_etl.py` — расчет фич и выгрузка CSV в S3.
- `scripts/smoke_check.py` — smoke-проверка E2E.
- `scripts/pii_hash_selfcheck.py` — проверка хэширования PII.

### Панель управления
- `backend/` — Django + DRF API.
- `frontend/` — React UI.
- `START_BACKEND_FRONTEND.txt` — быстрый запуск только backend/frontend.

### Runbook
- `ZERO_START_DOCKER.txt` — полный запуск с нуля (источник истины по шагам).

## 4) Подготовка `.env` (обязательно)

```powershell
cd F:\DE_intern\probablyfresh-analytics-platform
if (!(Test-Path .env)) { throw ".env not found. Create it manually from .env.example and fill secrets." }
```

Критичные переменные:
- `PII_HASH_SALT` (>= 16 символов),
- `S3_ENDPOINT_URL`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`,
- `API_TOKEN`,
- `TELEGRAM_BOT_TOKEN` (если нужен Telegram alerting).

## 5) Полный запуск пайплайна (Docker-only, PowerShell)

Ниже шаги «команда -> что делает -> какие файлы использует».

### Шаг 1. Собрать образ runner-контейнера `app`

```powershell
docker compose --env-file .env build app
```

Что делает:
- собирает `probablyfresh-app:local` с Python/Java и зависимостями.

Какие файлы:
- `docker/app/Dockerfile`
- `requirements.txt`

### Шаг 2. Полностью очистить предыдущую среду

```powershell
docker compose --env-file .env down -v
```

Что делает:
- удаляет контейнеры/сеть/volumes для чистого старта.

Важно:
- `.env` не изменяется.

### Шаг 3. Поднять инфраструктуру

```powershell
docker compose --env-file .env up -d zookeeper kafka mongodb clickhouse app grafana airflow-postgres airflow
```

Что делает:
- запускает весь контур pipeline.

Какие файлы:
- `docker-compose.yml`

### Шаг 4. Дождаться готовности ClickHouse

```powershell
do { Start-Sleep -Seconds 2; docker compose --env-file .env exec -T clickhouse clickhouse-client --query "SELECT 1" } while ($LASTEXITCODE -ne 0)
```

Что делает:
- гарантирует, что SQL init применится без `Connection refused`.

### Шаг 5. Инициализировать RAW слой

```powershell
Get-Content docker/clickhouse/init/01_init.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery
```

Что делает:
- создает `probablyfresh_raw` таблицы, Kafka Engine таблицы и MV Kafka->RAW.

Какие файлы:
- `docker/clickhouse/init/01_init.sql`

### Шаг 6. Инициализировать MART слой

```powershell
Get-Content docker/clickhouse/init/02_mart.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery
```

Что делает:
- создает `probablyfresh_mart` таблицы, MV RAW->MART и `mart_quality_stats`.

Какие файлы:
- `docker/clickhouse/init/02_mart.sql`

### Шаг 7. Сгенерировать данные

```powershell
docker compose --env-file .env run --rm app python src/generator/generate_data.py
```

Что делает:
- генерирует JSON в `data/stores`, `data/products`, `data/customers`, `data/purchases`.

Какие файлы:
- `src/generator/generate_data.py`

### Шаг 8. Загрузить JSON в MongoDB

```powershell
docker compose --env-file .env run --rm app python src/loader/load_to_mongo.py
```

Что делает:
- выполняет upsert JSON в MongoDB коллекции.

Какие файлы:
- `src/loader/load_to_mongo.py`

### Шаг 9. Опубликовать Mongo -> Kafka

```powershell
docker compose --env-file .env run --rm app python src/streaming/produce_from_mongo.py --once
```

Что делает:
- читает Mongo и публикует записи в Kafka topic-ы;
- нормализует и one-way хэширует PII (`email`, `phone`) перед публикацией.

Какие файлы:
- `src/streaming/produce_from_mongo.py`
- `src/probablyfresh/core/normalization.py`
- `src/probablyfresh/core/crypto_utils.py`

### Шаг 10. Дать ClickHouse дочитать Kafka

```powershell
Start-Sleep -Seconds 5
```

### Шаг 11. Обновить snapshot качества в MART

```powershell
Get-Content docker/clickhouse/init/02_mart.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery
```

Что делает:
- фиксирует актуальные метрики качества после ingestion.

### Шаг 12. Запустить PySpark ETL в S3

```powershell
docker compose --env-file .env run --rm app spark-submit --master local[*] --jars /opt/jars/clickhouse-jdbc-0.9.6-all-dependencies.jar jobs/features_etl.py
```

Что делает:
- строит feature-матрицу по MART;
- сохраняет CSV в S3 как `analytic_result_YYYY_MM_DD.csv`.

Какие файлы:
- `jobs/features_etl.py`

## 6) Запуск backend + frontend

```powershell
cd F:\DE_intern\probablyfresh-analytics-platform
docker compose --env-file .env build backend frontend
docker compose --env-file .env up -d backend frontend
docker compose --env-file .env ps backend frontend
```

Что делает:
- поднимает API и UI для управления pipeline.

Какие файлы:
- `docker/backend/Dockerfile`
- `docker/frontend/Dockerfile`
- `backend/`
- `frontend/`
- `docker-compose.yml`

URL:
- UI: `http://localhost:5173`
- API: `http://localhost:8001/api`
- API docs: `http://localhost:8001/api/docs/`
- Django admin: `http://localhost:8001/admin/`

## 7) Airflow (ежедневный DAG)

```powershell
docker compose --env-file .env exec airflow airflow dags unpause etl_to_s3_daily
docker compose --env-file .env exec airflow airflow dags trigger etl_to_s3_daily
docker compose --env-file .env exec airflow airflow dags list-runs -d etl_to_s3_daily
```

Что делает:
- включает и запускает DAG `etl_to_s3_daily`.

Какие файлы:
- `airflow/dags/etl_to_s3_daily.py`

UI:
- `http://localhost:8080`

## 8) Проверки

### Smoke E2E

```powershell
docker compose --env-file .env run --rm app python scripts/smoke_check.py
```

Файл:
- `scripts/smoke_check.py`

### PII hash self-check

```powershell
docker compose --env-file .env run --rm app python scripts/pii_hash_selfcheck.py
```

Файл:
- `scripts/pii_hash_selfcheck.py`

### Быстрые SQL проверки

```sql
SELECT 'stores_raw' AS t, count() AS c FROM probablyfresh_raw.stores_raw
UNION ALL SELECT 'products_raw', count() FROM probablyfresh_raw.products_raw
UNION ALL SELECT 'customers_raw', count() FROM probablyfresh_raw.customers_raw
UNION ALL SELECT 'purchases_raw', count() FROM probablyfresh_raw.purchases_raw;
```

```sql
SELECT
  length(email_enc) AS email_len,
  length(phone_enc) AS phone_len
FROM probablyfresh_mart.customers_mart
LIMIT 5;
```

Ожидание по PII:
- `64` (или `0` для пустых исходных значений).

## 9) Важные правила

- Всегда порядок init: `01_init.sql` -> `02_mart.sql`.
- При изменениях SQL init-файлов делайте полный re-init (`down -v` и повтор init).
- Официальные сценарии запуска в проекте — через Docker команды из этого README / `ZERO_START_DOCKER.txt`.
