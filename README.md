# probablyfresh-analytics-platform

## RU

MVP-скелет аналитической платформы ProbablyFresh (этап 1).

### Что покрывает проект

- Генерация JSON-файлов на диск:
  - `stores`: 45 файлов (30 Almost + 15 Maybe)
  - `products`: 100 файлов (по 20 в каждой из 5 категорий)
  - `customers`: >= 45
  - `purchases`: >= 200
- Загрузка JSON в MongoDB.
- Ingestion MongoDB -> Kafka -> ClickHouse RAW.
- Шифрование PII (`email`, `phone`) перед отправкой в Kafka для `customers` и `purchases`.

### Технологии

- Docker Compose сервисы:
  - Zookeeper (`confluentinc/cp-zookeeper:7.7.1`)
  - Kafka (`confluentinc/cp-kafka:7.7.1`)
  - MongoDB (`mongo:6`)
  - ClickHouse (`clickhouse/clickhouse-server:24.8`)
  - Grafana (`grafana/grafana:11.1.0`)
  - app (custom image from `docker/app/Dockerfile`, Python 3.12 + Java + deps)
- Python-скрипты в `src/`.

### Структура проекта

```text
.
├── .env.example
├── docker-compose.yml
├── Makefile
├── PROGRAM_OVERVIEW.md
├── requirements.txt
├── data/
├── jobs/
│   └── features_etl.py
├── grafana/
│   └── provisioning/
│       ├── alerting/
│       ├── dashboards/dashboard.yaml
│       └── datasources/clickhouse.yaml
├── docker/
│   ├── clickhouse/init/01_init.sql
│   ├── clickhouse/init/02_mart.sql
│   └── grafana/dashboards/probablyfresh_raw_overview.json
└── src/
    ├── generator/generate_data.py
    ├── loader/load_to_mongo.py
    ├── streaming/produce_from_mongo.py
    └── probablyfresh/
```

### Quickstart

Строгий порядок запуска (container-first, без make):

1. `cp .env.example .env`
2. `docker compose --env-file .env build app`
3. `docker compose --env-file .env up -d zookeeper kafka mongodb clickhouse app grafana`
4. `do { Start-Sleep -Seconds 2; docker compose --env-file .env exec -T clickhouse clickhouse-client --query "SELECT 1" } while ($LASTEXITCODE -ne 0)`
5. `Get-Content docker/clickhouse/init/01_init.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery`
6. `docker compose --env-file .env run --rm app python src/generator/generate_data.py`
7. `docker compose --env-file .env run --rm app python src/loader/load_to_mongo.py`
8. `docker compose --env-file .env run --rm app python src/streaming/produce_from_mongo.py --once`
9. Открыть Grafana и увидеть метрики в dashboard `ProbablyFresh RAW Overview`

Для MART и quality-метрик (используются на dashboard и в alerting) дополнительно выполнить:

1. `Get-Content docker/clickhouse/init/02_mart.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery`
2. `Start-Sleep -Seconds 5`
3. `Get-Content docker/clickhouse/init/02_mart.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery`

После MART и ETL (S3 выгрузка) включить и проверить Airflow DAG:

1. `docker compose --env-file .env up -d airflow-postgres airflow`
2. Открыть `http://localhost:8080` (логин/пароль: `admin/admin` или из `.env`)
3. Включить DAG (unpause):
   - `docker compose --env-file .env exec airflow airflow dags unpause etl_to_s3_daily`
4. Запустить DAG вручную (Trigger DAG):
   - `docker compose --env-file .env exec airflow airflow dags trigger etl_to_s3_daily`

### Airflow

Airflow запускается отдельными сервисами `airflow-postgres` и `airflow`:
- executor: `LocalExecutor`
- examples: отключены (`AIRFLOW__CORE__LOAD_EXAMPLES=false`)
- DAG-монтаж: `./airflow/dags -> /opt/airflow/dags`
- docker socket: `/var/run/docker.sock` примонтирован в контейнер `airflow`

Запуск:

1. `docker compose --env-file .env up -d airflow airflow-postgres`
2. (альтернатива, если `.env` уже подхватывается автоматически) `docker compose up -d airflow airflow-postgres`
3. Открыть `http://localhost:8080`
4. Логин: `admin/admin` (или значения из `.env`: `AIRFLOW_ADMIN_USER` / `AIRFLOW_ADMIN_PASSWORD`)

Примечание:
- первый старт может занимать 1-2 минуты (миграции БД + создание admin пользователя).

### Airflow DAG: etl_to_s3_daily

DAG `etl_to_s3_daily` запускается ежедневно в `10:00` по timezone `Europe/Moscow` (`UTC+3`), `catchup=False`, `max_active_runs=1`.

Что делает DAG:

1. `wait_clickhouse` — проверяет доступность ClickHouse.
2. `run_etl` — запускает `jobs/features_etl.py` внутри контейнера `app` через `docker exec`.
3. `verify_minio` — проверяет наличие объекта `analytic_result_YYYY_MM_DD.csv` в bucket MinIO/S3.

Примечание по timezone:
- расписание считается в `UTC+3` (`Europe/Moscow`), поэтому запуск "в 10:00" относится к московскому времени.

### ETL to S3

После построения MART (шаги выше), выполните:

1. Заполнить `.env`:
   - `CH_HOST`, `CH_PORT`, `CH_USER`, `CH_PASSWORD`
   - `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`
2. Создать bucket `analytics` (если не создается автоматически):
   - `mc alias set local http://localhost:9000 $MINIO_ACCESS_KEY $MINIO_SECRET_KEY`
   - `mc ls local/$MINIO_BUCKET`
3. Запустить ETL:
   - `make run-etl`
4. Проверить файл в MinIO:
   - `mc ls local/$MINIO_BUCKET`
   - `mc cat local/$MINIO_BUCKET/analytic_result_YYYY_MM_DD.csv | head`

Примечание:
- после `docker compose --env-file .env build app` зависимости (включая `pyspark`) и JDBC jar уже внутри образа, поэтому при каждом запуске они не скачиваются заново.

### Verification / Smoke test

Одна команда для быстрой верификации всего контура (ClickHouse + S3 CSV):

- `make smoke`

Что проверяет `scripts/smoke_check.py`:
- RAW uniq counts: `stores=45`, `products=100`, `purchases=200`, `customers>=45`
- MART FINAL counts: `customers`, `purchases`, `purchase_items` (`purchase_items > purchases`)
- Последний snapshot `mart_quality_stats` для `purchases` (`invalid_rows`, `duplicates_ratio`)
- Наличие объекта `analytic_result_YYYY_MM_DD.csv` в S3/MinIO и размер `>1KB`
- Первые 5 строк CSV: ровно 31 колонка, все фичи только `0/1`

Пример ожидаемого вывода:

```text
== ProbablyFresh smoke check ==
RAW uniq counts: stores=45, products=100, purchases=200, customers=175
MART FINAL counts: customers=175, purchases=200, purchase_items=<N>, where N > 200
mart_quality_stats (latest purchases): event_time=..., invalid_rows=0, duplicates_ratio=0.500000
S3 object: s3://final-project-nova-data/analytic_result_2026_02_25.csv, size=5580 bytes
CSV check: 31 columns and binary feature values (0/1) on first 5 rows
SMOKE CHECK PASSED
```

### Backend API

MVP backend (Django + DRF) обслуживает UI Control Panel и экшены пайплайна.

Запуск:

1. `docker compose --env-file .env build backend`
2. `docker compose --env-file .env up -d backend`
3. API доступен:
   - в Docker сети: `http://backend:8001/api`
   - с хоста: `http://localhost:8001/api`
4. OpenAPI:
   - schema: `http://localhost:8001/api/schema/`
   - docs: `http://localhost:8001/api/docs/`

Auth:

- `TokenAuthentication`
- header: `Authorization: Token <token>`
- стартовый токен:
  - либо задайте `API_TOKEN` в `.env` до запуска `backend`,
  - либо получите автоматически созданный токен в логах `ensure_api_token`.

Polling модель для UI:

1. UI вызывает `POST /api/actions/<action-name>`
2. backend возвращает `run_id`
3. UI опрашивает `GET /api/runs/{run_id}` каждые 1-2 сек до `success|failed`

Примеры `curl`:

```bash
curl -H "Authorization: Token $API_TOKEN" \
  http://localhost:8001/api/overview/kpis

curl -X POST -H "Authorization: Token $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"seed":42}' \
  http://localhost:8001/api/actions/generate-data

curl -H "Authorization: Token $API_TOKEN" \
  http://localhost:8001/api/runs/<run_id>
```

### Telegram alerting (provisioning)

1. Добавить в `.env` переменную:
   - `TELEGRAM_BOT_TOKEN=<your_bot_token>`
2. Поднять стек:
   - `docker compose --env-file .env up -d`
3. После старта Grafana автоматически создаст:
   - contact point `rwss_grafana_bot`,
   - notification policy,
   - alert rule `Duplicates_ratio`,
   - notification template `probablyfresh.telegram.message`.

### PySpark features ETL (Docker)

Подготовка `.env` (если нужно поменять значения):

- `CH_HOST`, `CH_PORT`, `CH_USER`, `CH_PASSWORD`, `CH_DATABASE=probablyfresh_mart`
- `SPARK_MASTER=local[*]`
- `MINIO_ENDPOINT`, `MINIO_REGION`, `MINIO_BUCKET`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_OBJECT_PREFIX`
- (опционально, для обратной совместимости) `S3_ENDPOINT_URL`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_OBJECT_PREFIX`

Важно: для запуска job внутри Docker-контейнера `app` используйте `CH_HOST=clickhouse` (имя сервиса в compose), а не `localhost`.

Запуск через Docker (без изменения существующего пайплайна):

1. Поднять сервисы:
   - `docker compose --env-file .env up -d clickhouse app`
2. Убедиться, что `probablyfresh_mart.customers_mart` и `probablyfresh_mart.purchases_mart` уже заполнены.
3. Запустить job:
   - `make run-etl`

Альтернатива через Makefile:

- `make features-etl` (alias на `make run-etl`)

Результат:

- в S3/MinIO загружается файл `analytic_result_YYYY_MM_DD.csv` в bucket из `.env`.

### Полная чистая проверка с нуля (PowerShell)

Ниже сценарий для полностью чистого прогона без накопленных данных в RAW.

1. `cd F:\DE_intern\probablyfresh-analytics-platform`  
Переход в корень репозитория, чтобы все относительные пути (`docker/...`, `src/...`) работали корректно.

2. `docker compose --env-file .env down -v`  
Останавливает и удаляет контейнеры, сеть и volumes проекта.  
Важно: удаляются накопленные данные MongoDB, ClickHouse и Grafana, поэтому это именно "чистый старт".

3. `docker compose --env-file .env up -d zookeeper kafka mongodb clickhouse app grafana`  
Поднимает инфраструктуру в фоне:
- `zookeeper` и `kafka` для стриминга,
- `mongodb` как NoSQL источник,
- `clickhouse` как RAW/MART хранилище,
- `app` как контейнер-раннер Python-скриптов,
- `grafana` для визуальной проверки.

4. `do { Start-Sleep -Seconds 2; docker compose --env-file .env exec -T clickhouse clickhouse-client --query "SELECT 1" } while ($LASTEXITCODE -ne 0)`  
Ждем готовности ClickHouse. Если этот шаг пропустить, следующие SQL могут упасть с `Connection refused`.

5. `Get-Content docker/clickhouse/init/01_init.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery`  
Инициализирует RAW-слой в ClickHouse:
- БД `probablyfresh_raw`,
- RAW таблицы,
- Kafka Engine таблицы,
- Materialized Views Kafka -> RAW.

6. `Get-Content docker/clickhouse/init/02_mart.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery`  
Инициализирует MART-слой:
- БД `probablyfresh_mart`,
- MART таблицы на `ReplacingMergeTree(ingested_at)`,
- Materialized Views RAW -> MART с очисткой/валидацией,
- таблицу качества `mart_quality_stats`,
- стартовый snapshot quality-метрик.

7. `docker compose --env-file .env run --rm app python src/generator/generate_data.py`  
Генерирует JSON-файлы в `data/` (`stores`, `products`, `customers`, `purchases`) по правилам MVP.

8. `docker compose --env-file .env run --rm app python src/loader/load_to_mongo.py`  
Загружает сгенерированные JSON в MongoDB с upsert по бизнес-ключам.

9. `docker compose --env-file .env run --rm app python src/streaming/produce_from_mongo.py --once`  
Читает данные из MongoDB и публикует их в Kafka по топикам сущностей.  
Для `customers` и `purchases` перед публикацией выполняются:
- нормализация `email`/`phone`,
- шифрование `email`/`phone` через Fernet.

10. `Start-Sleep -Seconds 5`  
Короткая пауза, чтобы Kafka consumer в ClickHouse успел дочитать сообщения и записать их в RAW/MART.

11. `Get-Content docker/clickhouse/init/02_mart.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery`  
Повторно выполняет `02_mart.sql` для обновления snapshot в `mart_quality_stats`.  
Это нужно для актуальных значений `duplicates_rows` и `duplicates_ratio` на момент текущего прогона.

Ожидаемый результат после одного чистого прогона:
- `probablyfresh_raw.stores_raw = 45`
- `probablyfresh_raw.products_raw = 100`
- `probablyfresh_raw.customers_raw >= 45` (обычно `175`)
- `probablyfresh_raw.purchases_raw = 200`
- `probablyfresh_mart.purchases_mart FINAL = 200`
- `duplicates_ratio` по `purchases` в последнем snapshot = `0`

### Проверка результата

Запрос в ClickHouse/DBeaver:

```sql
SELECT 'stores' AS t, count() AS c FROM probablyfresh_raw.stores_raw
UNION ALL
SELECT 'products', count() FROM probablyfresh_raw.products_raw
UNION ALL
SELECT 'customers', count() FROM probablyfresh_raw.customers_raw
UNION ALL
SELECT 'purchases', count() FROM probablyfresh_raw.purchases_raw;
```

Ожидаемо:

- `stores = 45`
- `products = 100`
- `customers >= 45`
- `purchases >= 200`

Проверка MART и alert-метрики:

```sql
SELECT
  event_time,
  entity,
  total_rows_raw,
  inserted_rows_mart,
  invalid_rows,
  duplicates_rows,
  duplicates_ratio
FROM probablyfresh_mart.mart_quality_stats
WHERE entity = 'purchases'
ORDER BY event_time DESC
LIMIT 3;
```

```sql
SELECT duplicates_ratio
FROM probablyfresh_mart.mart_quality_stats
WHERE entity = 'purchases'
ORDER BY event_time DESC
LIMIT 1;
```

Проверка в Grafana:

1. Открыть `http://localhost:3000`.
2. Войти под логином/паролем из `.env` (`GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD`).
3. Открыть dashboard `ProbablyFresh RAW Overview` (подхватывается автоматически через provisioning).
4. Проверить значения:
   - `Stores count` = `45`
   - `Purchases count` >= `200`
   - `Stores by network` содержит `ProbablyFresh Almost` и `ProbablyFresh Maybe`

### Подключение DBeaver (ClickHouse)

- Host: `localhost`
- Port: `9000` (native) или `8123` (HTTP)
- Database: `probablyfresh_raw` или `probablyfresh_mart`
- User/Password: из `.env` (`CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD`)

### Быстрые команды Makefile

- `make up` — поднять все сервисы.
- `make down` — остановить и удалить сервисы и volumes.
- `make generate-data` — генерация JSON.
- `make load-nosql` — загрузка JSON в MongoDB.
- `make init-ch` — инициализация RAW в ClickHouse.
- `make mart-init` — инициализация MART и snapshot quality-метрик.
- `make run-producer` — публикация Mongo -> Kafka (`--once`).
- `make init-grafana` — поднять Grafana (provisioning автоматический).
- `make run-etl` — PySpark ETL признаков (через `spark-submit`) и загрузка CSV в S3/MinIO.
- `make features-etl` — alias на `make run-etl`.

### Известные несовместимости и частые ошибки

1. `ModuleNotFoundError: kafka.vendor.six.moves`

Причина: `kafka-python==2.0.2` с Python 3.12 в контейнере.

Решение: использовать `kafka-python==2.1.2` (уже зафиксировано в `requirements.txt`).

2. Ошибка PowerShell на шаге `init-ch` с символом `<`

Причина: redirection `<` в PowerShell работает не как в bash для этой команды.

Решение: использовать pipeline через `Get-Content -Raw` (см. шаг 5).

3. Warning Docker Compose: `the attribute version is obsolete`

Это предупреждение, не блокирует запуск.

4. Grafana datasource `Type: undefined` / `Plugin not found`

Причина: в `grafana_data` мог сохраниться старый datasource с неверным типом `clickhouse`.

Решение:

- В provisioning используется правильный тип: `grafana-clickhouse-datasource`.
- Если проблема осталась, перезапустить Grafana:
  - `docker compose --env-file .env restart grafana`
- Если не помогло, пересоздать только volume Grafana:
  - `docker compose --env-file .env down`
  - `docker volume rm probablyfresh-analytics-platform_grafana_data`
  - `docker compose --env-file .env up -d grafana`

### Примечания

- Генератор идемпотентный: очищает только `*.json` в `data/stores`, `data/products`, `data/customers`, `data/purchases`.
- Детерминизм генератора: seed берется из `SEED` (default `42`) или из CLI `--seed` (приоритет у CLI).

---

## EN

MVP skeleton for ProbablyFresh analytics platform (Stage 1).

### Quickstart

Strict run order (container-first, no make):

1. `cp .env.example .env`
2. `docker compose --env-file .env build app`
3. `docker compose --env-file .env up -d zookeeper kafka mongodb clickhouse app grafana`
4. `do { Start-Sleep -Seconds 2; docker compose --env-file .env exec -T clickhouse clickhouse-client --query "SELECT 1" } while ($LASTEXITCODE -ne 0)`
5. `Get-Content docker/clickhouse/init/01_init.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery`
6. `docker compose --env-file .env run --rm app python src/generator/generate_data.py`
7. `docker compose --env-file .env run --rm app python src/loader/load_to_mongo.py`
8. `docker compose --env-file .env run --rm app python src/streaming/produce_from_mongo.py --once`
9. Open Grafana and verify metrics on dashboard `ProbablyFresh RAW Overview`

For MART and quality metrics (used by dashboard and alerting), also run:

1. `Get-Content docker/clickhouse/init/02_mart.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery`
2. `Start-Sleep -Seconds 5`
3. `Get-Content docker/clickhouse/init/02_mart.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery`

After MART and ETL (S3 export), enable and test Airflow DAG:

1. `docker compose --env-file .env up -d airflow-postgres airflow`
2. Open `http://localhost:8080` (login/password: `admin/admin` or values from `.env`)
3. Unpause DAG:
   - `docker compose --env-file .env exec airflow airflow dags unpause etl_to_s3_daily`
4. Trigger DAG manually:
   - `docker compose --env-file .env exec airflow airflow dags trigger etl_to_s3_daily`

### Airflow DAG: etl_to_s3_daily

`etl_to_s3_daily` runs daily at `10:00` in timezone `Europe/Moscow` (`UTC+3`), with `catchup=False` and `max_active_runs=1`.

What the DAG does:

1. `wait_clickhouse` — checks ClickHouse availability.
2. `run_etl` — runs `jobs/features_etl.py` inside the `app` container via `docker exec`.
3. `verify_minio` — verifies `analytic_result_YYYY_MM_DD.csv` exists in MinIO/S3 bucket.

Timezone note:
- schedule is interpreted in `UTC+3` (`Europe/Moscow`), so "10:00 daily" means Moscow local time.

### ETL to S3

After MART is built (steps above), run:

1. Fill `.env`:
   - `CH_HOST`, `CH_PORT`, `CH_USER`, `CH_PASSWORD`
   - `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`
2. Create bucket `analytics` (if not auto-created):
   - `mc alias set local http://localhost:9000 $MINIO_ACCESS_KEY $MINIO_SECRET_KEY`
   - `mc ls local/$MINIO_BUCKET`
3. Run ETL:
   - `make run-etl`
4. Verify file in MinIO:
   - `mc ls local/$MINIO_BUCKET`
   - `mc cat local/$MINIO_BUCKET/analytic_result_YYYY_MM_DD.csv | head`

Note:
- after `docker compose --env-file .env build app`, dependencies (including `pyspark`) and the JDBC jar are already inside the image, so they are not downloaded on each run.

### Telegram alerting (provisioning)

1. Add to `.env`:
   - `TELEGRAM_BOT_TOKEN=<your_bot_token>`
2. Start the stack:
   - `docker compose --env-file .env up -d`
3. Grafana will auto-provision:
   - contact point `rwss_grafana_bot`,
   - notification policy,
   - alert rule `Duplicates_ratio`,
   - notification template `probablyfresh.telegram.message`.

### PySpark features ETL (Docker)

Prepare `.env` (adjust if needed):

- `CH_HOST`, `CH_PORT`, `CH_USER`, `CH_PASSWORD`, `CH_DATABASE=probablyfresh_mart`
- `SPARK_MASTER=local[*]`
- `MINIO_ENDPOINT`, `MINIO_REGION`, `MINIO_BUCKET`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_OBJECT_PREFIX`
- (optional, backward compatible) `S3_ENDPOINT_URL`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_OBJECT_PREFIX`

Important: when running the job inside Docker `app` container, use `CH_HOST=clickhouse` (compose service name), not `localhost`.

Run via Docker:

1. Start services:
   - `docker compose --env-file .env up -d clickhouse app`
2. Ensure `probablyfresh_mart.customers_mart` and `probablyfresh_mart.purchases_mart` are populated.
3. Run job:
   - `make run-etl`

Makefile shortcut:

- `make features-etl` (alias to `make run-etl`)

Output:

- uploads `analytic_result_YYYY_MM_DD.csv` to S3/MinIO bucket from `.env`.

### Validation query

```sql
SELECT 'stores' AS t, count() AS c FROM probablyfresh_raw.stores_raw
UNION ALL
SELECT 'products', count() FROM probablyfresh_raw.products_raw
UNION ALL
SELECT 'customers', count() FROM probablyfresh_raw.customers_raw
UNION ALL
SELECT 'purchases', count() FROM probablyfresh_raw.purchases_raw;
```

Expected: `stores=45`, `products=100`, `customers>=45`, `purchases>=200`.

MART and alert-metric validation:

```sql
SELECT
  event_time,
  entity,
  total_rows_raw,
  inserted_rows_mart,
  invalid_rows,
  duplicates_rows,
  duplicates_ratio
FROM probablyfresh_mart.mart_quality_stats
WHERE entity = 'purchases'
ORDER BY event_time DESC
LIMIT 3;
```

```sql
SELECT duplicates_ratio
FROM probablyfresh_mart.mart_quality_stats
WHERE entity = 'purchases'
ORDER BY event_time DESC
LIMIT 1;
```

Grafana validation:

1. Open `http://localhost:3000`.
2. Login with `.env` credentials (`GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD`).
3. Open dashboard `ProbablyFresh RAW Overview` (auto-provisioned).
4. Validate:
   - `Stores count` = `45`
   - `Purchases count` >= `200`
   - `Stores by network` shows `ProbablyFresh Almost` and `ProbablyFresh Maybe`

### Known compatibility issues

1. `ModuleNotFoundError: kafka.vendor.six.moves`

Cause: `kafka-python==2.0.2` with Python 3.12.

Fix: use `kafka-python==2.1.2` (already pinned in `requirements.txt`).

2. PowerShell `<` redirection fails for ClickHouse init command.

Fix: use `Get-Content ... -Raw | docker compose ... clickhouse-client --multiquery`.

3. Grafana datasource shows `Type: undefined` / `Plugin not found`.

Cause: old datasource with wrong type `clickhouse` persisted in `grafana_data`.

Fix:

- Provisioning now uses `type: grafana-clickhouse-datasource`.
- Restart Grafana:
  - `docker compose --env-file .env restart grafana`
- If still broken, recreate Grafana volume only:
  - `docker compose --env-file .env down`
  - `docker volume rm probablyfresh-analytics-platform_grafana_data`
  - `docker compose --env-file .env up -d grafana`
