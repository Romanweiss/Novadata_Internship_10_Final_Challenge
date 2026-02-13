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
│   └── clickhouse/init/01_init.sql
├── infra/
│   └── grafana/
└── src/
    ├── generator/generate_data.py
    ├── loader/load_to_mongo.py
    ├── streaming/produce_from_mongo.py
    └── probablyfresh/
```

### Container-First запуск (PowerShell, без make)

Предполагается, что `.env` уже создан и `FERNET_KEY` заполнен.

1. Остановить и очистить окружение:

```powershell
docker compose --env-file .env down -v --remove-orphans
```

2. Поднять инфраструктуру:

```powershell
docker compose --env-file .env up -d zookeeper kafka mongodb clickhouse app grafana
```

3. Сгенерировать demo JSON:

```powershell
docker compose --env-file .env run --rm app sh -lc "pip install -r requirements.txt && python src/generator/generate_data.py"
```

4. Загрузить JSON в MongoDB:

```powershell
docker compose --env-file .env run --rm app sh -lc "pip install -r requirements.txt && python src/loader/load_to_mongo.py"
```

5. Инициализировать ClickHouse (RAW + Kafka Engine + MV):

```powershell
Get-Content docker/clickhouse/init/01_init.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery
```

6. Запустить producer Mongo -> Kafka (`--once`):

```powershell
docker compose --env-file .env run --rm app sh -lc "pip install -r requirements.txt && python src/streaming/produce_from_mongo.py --once"
```

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

### Примечания

- Генератор идемпотентный: очищает только `*.json` в `data/stores`, `data/products`, `data/customers`, `data/purchases`.
- Детерминизм генератора: seed берется из `SEED` (default `42`) или из CLI `--seed` (приоритет у CLI).

---

## EN

MVP skeleton for ProbablyFresh analytics platform (Stage 1).

### Container-first run (PowerShell, no make)

Assumes `.env` is ready and `FERNET_KEY` is set.

```powershell
docker compose --env-file .env down -v --remove-orphans
docker compose --env-file .env up -d zookeeper kafka mongodb clickhouse app grafana
docker compose --env-file .env run --rm app sh -lc "pip install -r requirements.txt && python src/generator/generate_data.py"
docker compose --env-file .env run --rm app sh -lc "pip install -r requirements.txt && python src/loader/load_to_mongo.py"
Get-Content docker/clickhouse/init/01_init.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery
docker compose --env-file .env run --rm app sh -lc "pip install -r requirements.txt && python src/streaming/produce_from_mongo.py --once"
```

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

### Known compatibility issues

1. `ModuleNotFoundError: kafka.vendor.six.moves`

Cause: `kafka-python==2.0.2` with Python 3.12.

Fix: use `kafka-python==2.1.2` (already pinned in `requirements.txt`).

2. PowerShell `<` redirection fails for ClickHouse init command.

Fix: use `Get-Content ... -Raw | docker compose ... clickhouse-client --multiquery`.
