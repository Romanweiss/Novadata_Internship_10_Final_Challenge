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
  - app (`python:3.12-slim`)
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
2. `docker compose --env-file .env up -d zookeeper kafka mongodb clickhouse app grafana`
3. `docker compose --env-file .env run --rm app sh -lc "pip install -r requirements.txt && python src/generator/generate_data.py"`
4. `docker compose --env-file .env run --rm app sh -lc "pip install -r requirements.txt && python src/loader/load_to_mongo.py"`
5. `Get-Content docker/clickhouse/init/01_init.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery`
6. `docker compose --env-file .env run --rm app sh -lc "pip install -r requirements.txt && python src/streaming/produce_from_mongo.py --once"`
7. Открыть Grafana и увидеть метрики в dashboard `ProbablyFresh RAW Overview`

Для MART и quality-метрик (используются на dashboard и в alerting) дополнительно выполнить:

1. `Get-Content docker/clickhouse/init/02_mart.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery`
2. `Start-Sleep -Seconds 5`
3. `Get-Content docker/clickhouse/init/02_mart.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery`

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
- `S3_ENDPOINT_URL`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_OBJECT_PREFIX`

Важно: для запуска job внутри Docker-контейнера `app` используйте `CH_HOST=clickhouse` (имя сервиса в compose), а не `localhost`.

Запуск через Docker (без изменения существующего пайплайна):

1. Поднять сервисы:
   - `docker compose --env-file .env up -d clickhouse app`
2. Убедиться, что `probablyfresh_mart.customers_mart` и `probablyfresh_mart.purchases_mart` уже заполнены.
3. Запустить job:
   - `docker compose --env-file .env run --rm app sh -lc "if ! command -v java >/dev/null 2>&1; then apt-get update && (apt-get install -y --no-install-recommends default-jre-headless || apt-get install -y --no-install-recommends openjdk-21-jre-headless); fi && pip install -r requirements.txt pyspark boto3 && python jobs/features_etl.py"`

Альтернатива через Makefile:

- `make features-etl`

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

4. `Get-Content docker/clickhouse/init/01_init.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery`  
Инициализирует RAW-слой в ClickHouse:
- БД `probablyfresh_raw`,
- RAW таблицы,
- Kafka Engine таблицы,
- Materialized Views Kafka -> RAW.

5. `Get-Content docker/clickhouse/init/02_mart.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery`  
Инициализирует MART-слой:
- БД `probablyfresh_mart`,
- MART таблицы на `ReplacingMergeTree(ingested_at)`,
- Materialized Views RAW -> MART с очисткой/валидацией,
- таблицу качества `mart_quality_stats`,
- стартовый snapshot quality-метрик.

6. `docker compose --env-file .env run --rm app sh -lc "pip install -r requirements.txt && python src/generator/generate_data.py"`  
Генерирует JSON-файлы в `data/` (`stores`, `products`, `customers`, `purchases`) по правилам MVP.

7. `docker compose --env-file .env run --rm app sh -lc "pip install -r requirements.txt && python src/loader/load_to_mongo.py"`  
Загружает сгенерированные JSON в MongoDB с upsert по бизнес-ключам.

8. `docker compose --env-file .env run --rm app sh -lc "pip install -r requirements.txt && python src/streaming/produce_from_mongo.py --once"`  
Читает данные из MongoDB и публикует их в Kafka по топикам сущностей.  
Для `customers` и `purchases` перед публикацией выполняются:
- нормализация `email`/`phone`,
- шифрование `email`/`phone` через Fernet.

9. `Start-Sleep -Seconds 5`  
Короткая пауза, чтобы Kafka consumer в ClickHouse успел дочитать сообщения и записать их в RAW/MART.

10. `Get-Content docker/clickhouse/init/02_mart.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery`  
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
- `make features-etl` — PySpark ETL признаков и загрузка CSV в S3/MinIO.

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
2. `docker compose --env-file .env up -d zookeeper kafka mongodb clickhouse app grafana`
3. `docker compose --env-file .env run --rm app sh -lc "pip install -r requirements.txt && python src/generator/generate_data.py"`
4. `docker compose --env-file .env run --rm app sh -lc "pip install -r requirements.txt && python src/loader/load_to_mongo.py"`
5. `Get-Content docker/clickhouse/init/01_init.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery`
6. `docker compose --env-file .env run --rm app sh -lc "pip install -r requirements.txt && python src/streaming/produce_from_mongo.py --once"`
7. Open Grafana and verify metrics on dashboard `ProbablyFresh RAW Overview`

For MART and quality metrics (used by dashboard and alerting), also run:

1. `Get-Content docker/clickhouse/init/02_mart.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery`
2. `Start-Sleep -Seconds 5`
3. `Get-Content docker/clickhouse/init/02_mart.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery`

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
- `S3_ENDPOINT_URL`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_OBJECT_PREFIX`

Important: when running the job inside Docker `app` container, use `CH_HOST=clickhouse` (compose service name), not `localhost`.

Run via Docker:

1. Start services:
   - `docker compose --env-file .env up -d clickhouse app`
2. Ensure `probablyfresh_mart.customers_mart` and `probablyfresh_mart.purchases_mart` are populated.
3. Run job:
   - `docker compose --env-file .env run --rm app sh -lc "if ! command -v java >/dev/null 2>&1; then apt-get update && (apt-get install -y --no-install-recommends default-jre-headless || apt-get install -y --no-install-recommends openjdk-21-jre-headless); fi && pip install -r requirements.txt pyspark boto3 && python jobs/features_etl.py"`

Makefile shortcut:

- `make features-etl`

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
