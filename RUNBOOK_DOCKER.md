# RUNBOOK_DOCKER.md

Единый runbook проекта ProbablyFresh (PowerShell + Docker-only).

## 1. Предусловия

- ОС: Windows + PowerShell.
- Docker Desktop запущен.
- Рабочая папка: корень репозитория `probablyfresh-analytics-platform`.
- Файл `.env` создается и заполняется вручную (автокопирование запрещено).

Проверка:

```powershell
cd <repo_root>\probablyfresh-analytics-platform
if (!(Test-Path .env)) { throw ".env не найден. Создай вручную из .env.example и заполни секреты." }
```

Критичные параметры в `.env`:
- `PII_HASH_SALT` (>=16 символов)
- `S3_ENDPOINT_URL`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`
- `API_TOKEN`
- `AIRFLOW_*`
- `GRAFANA_ADMIN_*`
- `TELEGRAM_BOT_TOKEN` (если используется Telegram-алертинг)

## 2. Основные URL

- Grafana: `http://localhost:3000`
- Airflow UI: `http://localhost:8080`
- Frontend UI: `http://localhost:5173`
- Backend API: `http://localhost:8001/api`
- API docs: `http://localhost:8001/api/docs/`
- Django admin: `http://localhost:8001/admin/`

## 3. Полный запуск data-контура с нуля

### Шаг 1. Сборка app-образа

```powershell
docker compose --env-file .env build app
```

Что делает:
- собирает контейнер `probablyfresh-app:local`.

Использует:
- `docker/app/Dockerfile`
- `requirements.txt`

### Шаг 2. Полный сброс окружения

```powershell
docker compose --env-file .env down -v
```

Что делает:
- удаляет контейнеры, сеть и volumes.

Важно:
- `.env` не изменяется.

### Шаг 3. Поднятие core-сервисов

```powershell
docker compose --env-file .env up -d zookeeper kafka mongodb clickhouse app grafana airflow-postgres airflow
```

Что делает:
- запускает инфраструктуру пайплайна.

Использует:
- `docker-compose.yml`

### Шаг 4. Ожидание готовности ClickHouse

```powershell
do { Start-Sleep -Seconds 2; docker compose --env-file .env exec -T clickhouse clickhouse-client --query "SELECT 1" } while ($LASTEXITCODE -ne 0)
```

Что делает:
- гарантирует корректный старт SQL-инициализации.

### Шаг 5. Инициализация RAW

```powershell
Get-Content docker/clickhouse/init/01_init.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery
```

Что делает:
- создает `probablyfresh_raw` + Kafka Engine + MV Kafka->RAW.
- включает `purchase_items_raw` и MV разложения `items`.

Использует:
- `docker/clickhouse/init/01_init.sql`

### Шаг 6. Инициализация MART

```powershell
Get-Content docker/clickhouse/init/02_mart.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery
```

Что делает:
- создает `probablyfresh_mart` + MV RAW->MART + `mart_quality_stats`.
- включает `purchase_items_mart`.

Использует:
- `docker/clickhouse/init/02_mart.sql`

Критично:
- строгий порядок `01_init.sql -> 02_mart.sql`.

### Шаг 7. Генерация JSON

```powershell
docker compose --env-file .env run --rm app python src/generator/generate_data.py
```

Что делает:
- генерирует данные в `data/stores`, `data/products`, `data/customers`, `data/purchases`.

Использует:
- `src/generator/generate_data.py`

### Шаг 8. Загрузка JSON в MongoDB

```powershell
docker compose --env-file .env run --rm app python src/loader/load_to_mongo.py
```

Что делает:
- upsert в Mongo-коллекции `stores/products/customers/purchases`.

Использует:
- `src/loader/load_to_mongo.py`

### Шаг 9. Публикация Mongo -> Kafka

```powershell
docker compose --env-file .env run --rm app python src/streaming/produce_from_mongo.py --once
```

Что делает:
- публикует события в Kafka topic-ы;
- нормализует и обезличивает PII (`email`, `phone`) алгоритмом:
  `sha256(salt + ":" + normalized_value).hexdigest()`.

Использует:
- `src/streaming/produce_from_mongo.py`
- `src/probablyfresh/core/normalization.py`
- `src/probablyfresh/core/crypto_utils.py`

### Шаг 10. Пауза для Kafka -> ClickHouse ingestion

```powershell
Start-Sleep -Seconds 5
```

### Шаг 11. Обновление snapshot качества MART

```powershell
Get-Content docker/clickhouse/init/02_mart.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery
```

Что делает:
- фиксирует актуальные `mart_quality_stats` после ingestion.

### Шаг 12. ETL в S3

```powershell
docker compose --env-file .env run --rm app spark-submit --master local[*] --jars /opt/jars/clickhouse-jdbc-0.9.6-all-dependencies.jar jobs/features_etl.py
```

Что делает:
- считает 30 бинарных фич;
- по умолчанию сохраняет только `analytic_result_YYYY_MM_DD.csv` в S3.

Опционально, если нужен дополнительный parquet-экспорт:

```powershell
docker compose --env-file .env run --rm -e FEATURES_EXPORT_PARQUET=1 app spark-submit --master local[*] --jars /opt/jars/clickhouse-jdbc-0.9.6-all-dependencies.jar jobs/features_etl.py
```

Важно:
- parquet выключен по умолчанию;
- parquet заметно замедляет ETL, поэтому включайте его только при явной необходимости;
- smoke-check по-прежнему ориентируется на обязательный CSV-артефакт.

Использует:
- `jobs/features_etl.py`

## 4. Проверки после запуска

### 4.1 Проверка counts RAW

```powershell
docker compose --env-file .env exec -T clickhouse clickhouse-client --query "SELECT 'stores_raw' AS t, count() AS c FROM probablyfresh_raw.stores_raw UNION ALL SELECT 'products_raw', count() FROM probablyfresh_raw.products_raw UNION ALL SELECT 'customers_raw', count() FROM probablyfresh_raw.customers_raw UNION ALL SELECT 'purchases_raw', count() FROM probablyfresh_raw.purchases_raw UNION ALL SELECT 'purchase_items_raw', count() FROM probablyfresh_raw.purchase_items_raw"
```

### 4.2 Проверка counts MART FINAL

```powershell
docker compose --env-file .env exec -T clickhouse clickhouse-client --query "SELECT 'customers_mart_final' AS t, count() AS c FROM probablyfresh_mart.customers_mart FINAL UNION ALL SELECT 'purchases_mart_final', count() FROM probablyfresh_mart.purchases_mart FINAL UNION ALL SELECT 'purchase_items_mart_final', count() FROM probablyfresh_mart.purchase_items_mart FINAL"
```

### 4.3 PII hash self-check

```powershell
docker compose --env-file .env run --rm app python scripts/pii_hash_selfcheck.py
```

### 4.4 Smoke-check E2E

```powershell
docker compose --env-file .env run --rm app python scripts/smoke_check.py
```

Проверяет:
- RAW/MART counts,
- `mart_quality_stats`,
- наличие сегодняшнего CSV в S3,
- 31 колонку в CSV и бинарность feature-полей.

## 5. Запуск backend и frontend

```powershell
docker compose --env-file .env build backend frontend
docker compose --env-file .env up -d backend frontend
docker compose --env-file .env ps backend frontend
```

Что делает:
- поднимает API и UI поверх уже поднятой инфраструктуры.
- при старте `backend` автоматически выполняет:
  - `python backend/manage.py migrate`
  - `python backend/manage.py ensure_api_token`
  - `python backend/manage.py runserver 0.0.0.0:8001`

Использует:
- `docker/backend/Dockerfile`
- `docker/frontend/Dockerfile`
- `backend/`
- `frontend/`

Важно:
- локально Django устанавливать не нужно;
- все проверки и миграции выполняются через контейнер `backend`;
- если новая миграция появилась после того, как `backend` уже был запущен, выполните ручной `migrate`.

### 5.1 Проверка и ручной запуск миграций backend

Проверить список миграций `api`:

```powershell
docker compose --env-file .env exec backend python backend/manage.py showmigrations api
```

Применить миграции вручную:

```powershell
docker compose --env-file .env exec backend python backend/manage.py migrate
```

Проверить, что ingestion-таблицы существуют:

```powershell
docker compose --env-file .env exec backend python backend/manage.py shell -c "from django.db import connection; print('\n'.join(sorted(t for t in connection.introspection.table_names() if t.startswith('api_import'))))"
```

Ожидаемые таблицы:
- `api_importbatch`
- `api_importrowerror`
- `api_importstagingrecord`

### 5.2 Проверка managed ingestion и staging layer

Текущий ingestion работает как безопасное расширение:
- файл загружается через UI/API;
- создается `ImportBatch`;
- строки валидируются;
- ошибки пишутся в `ImportRowError`;
- валидные строки сохраняются в изолированный staging layer;
- данные пока не пушатся автоматически в MongoDB/Kafka.

UI-проверка:
- открыть `http://localhost:5173`;
- перейти во вкладку `Pipelines`;
- найти блок `Загрузка данных`.

API endpoint-ы первого и второго безопасного этапа:
- `POST http://localhost:8001/api/imports`
- `GET http://localhost:8001/api/imports/{id}`
- `GET http://localhost:8001/api/imports/{id}/errors`
- `GET http://localhost:8001/api/imports/{id}/staging`
- `POST http://localhost:8001/api/imports/{id}/replay`

Что проверить вручную:
- batch создается и получает статус `queued/running/success/failed/partial`;
- ошибки доступны через `/errors`;
- валидные строки доступны через `/staging`;
- повторный прогон batch работает через `/replay` и увеличивает `replay_count`.

## 6. Airflow DAG (ручной запуск)

```powershell
docker compose --env-file .env exec airflow airflow dags unpause etl_to_s3_daily
docker compose --env-file .env exec airflow airflow dags trigger etl_to_s3_daily
docker compose --env-file .env exec airflow airflow dags list-runs -d etl_to_s3_daily
```

Что делает:
- включает и запускает DAG `etl_to_s3_daily`.

Использует:
- `airflow/dags/etl_to_s3_daily.py`

## 7. Типичные ошибки и как проверить

### Ошибка `Unknown table probablyfresh_raw.*`
Причина:
- пропущен `01_init.sql` или нарушен порядок init.

Проверка:
- повторить шаги 4, 5, 6.

### Ошибка `Connection refused` при SQL init
Причина:
- ClickHouse не готов.

Проверка:
- дождаться успешного цикла `SELECT 1`.

### Ошибка ETL по S3 ключам
Причина:
- не заполнены `S3_ACCESS_KEY`/`S3_SECRET_KEY`/`S3_BUCKET`.

Проверка:
- проверить `.env` и перезапустить ETL.

### Нет данных в Grafana
Причина:
- не прошел ingestion или не обновлен MART snapshot.

Проверка:
- запустить шаги 9-11 и проверить counts в ClickHouse.

### Warning про `PII_HASH_SALT`
Причина:
- не задан `PII_HASH_SALT`.

Проверка:
- заполнить `PII_HASH_SALT` (>=16), перезапустить producer.

## 8. Быстрый copy/paste сценарий

```powershell
cd <repo_root>\probablyfresh-analytics-platform
if (!(Test-Path .env)) { throw ".env не найден. Создай вручную из .env.example и заполни секреты." }
docker compose --env-file .env build app
docker compose --env-file .env down -v
docker compose --env-file .env up -d zookeeper kafka mongodb clickhouse app grafana airflow-postgres airflow
do { Start-Sleep -Seconds 2; docker compose --env-file .env exec -T clickhouse clickhouse-client --query "SELECT 1" } while ($LASTEXITCODE -ne 0)
Get-Content docker/clickhouse/init/01_init.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery
Get-Content docker/clickhouse/init/02_mart.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery
docker compose --env-file .env run --rm app python src/generator/generate_data.py
docker compose --env-file .env run --rm app python src/loader/load_to_mongo.py
docker compose --env-file .env run --rm app python src/streaming/produce_from_mongo.py --once
Start-Sleep -Seconds 5
Get-Content docker/clickhouse/init/02_mart.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery
docker compose --env-file .env run --rm app python scripts/pii_hash_selfcheck.py
docker compose --env-file .env run --rm app python scripts/smoke_check.py
# CSV-only by default. Add -e FEATURES_EXPORT_PARQUET=1 only when parquet is explicitly needed.
docker compose --env-file .env run --rm app spark-submit --master local[*] --jars /opt/jars/clickhouse-jdbc-0.9.6-all-dependencies.jar jobs/features_etl.py
docker compose --env-file .env build backend frontend
docker compose --env-file .env up -d backend frontend
docker compose --env-file .env exec airflow airflow dags unpause etl_to_s3_daily
docker compose --env-file .env exec airflow airflow dags trigger etl_to_s3_daily
```
