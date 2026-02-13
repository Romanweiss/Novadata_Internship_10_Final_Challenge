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
├── requirements.txt
├── data/
├── docker/
│   ├── clickhouse/init/01_init.sql
│   └── grafana/
│       ├── dashboards/probablyfresh_raw_overview.json
│       └── provisioning/
│           ├── dashboards/dashboard.yaml
│           └── datasources/clickhouse.yaml
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
- Database: `probablyfresh_raw`
- User/Password: из `.env` (`CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD`)

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
