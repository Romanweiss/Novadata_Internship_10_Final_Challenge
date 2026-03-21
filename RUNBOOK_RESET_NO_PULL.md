# Быстрый Сброс Данных И Повторный Запуск (Без Повторных Скачиваний)

Цель этого сценария:
- очистить уже отправленные/накопленные данные (MongoDB, ClickHouse, Airflow metadata, Grafana state),
- заново прогнать весь pipeline,
- не тянуть заново пакеты и образы из сети.

Сценарий рассчитан на PowerShell + Docker Desktop.

## Важно перед запуском

- `.env` должен уже существовать и быть заполнен.
- Образы должны быть уже собраны/скачаны хотя бы один раз.
- Не используем `down -v` и не удаляем образы, чтобы не провоцировать повторные скачивания.

## 1) Обязательная команда в начале: отключить всё

```powershell
cd F:\DE_intern\probablyfresh-analytics-platform
docker compose --env-file .env down
```

Что делает:
- останавливает и удаляет контейнеры/сеть проекта;
- не трогает образы и не перезаписывает `.env`.

## 2) Очистить только data volumes (данные), без удаления образов

```powershell
$volumes = @(
  "probablyfresh-analytics-platform_mongodb_data",
  "probablyfresh-analytics-platform_clickhouse_data",
  "probablyfresh-analytics-platform_airflow_postgres_data",
  "probablyfresh-analytics-platform_grafana_data"
)
foreach ($v in $volumes) { docker volume rm $v 2>$null | Out-Null }
```

Что делает:
- удаляет только хранилища данных;
- не удаляет Docker images, поэтому повторного pull/install не будет.

## 3) Поднять core-сервисы без pull/build

```powershell
docker compose --env-file .env up -d --pull never zookeeper kafka mongodb clickhouse app grafana airflow-postgres airflow
```

Что делает:
- стартует инфраструктуру;
- `--pull never` запрещает попытки скачивания образов.

## 4) Дождаться готовности ClickHouse

```powershell
do { Start-Sleep -Seconds 2; docker compose --env-file .env exec -T clickhouse clickhouse-client --query "SELECT 1" } while ($LASTEXITCODE -ne 0)
```

## 5) Инициализация RAW и MART (строго по порядку)

```powershell
Get-Content docker/clickhouse/init/01_init.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery
Get-Content docker/clickhouse/init/02_mart.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery
```

## 6) Полный прогон pipeline

```powershell
docker compose --env-file .env exec app python src/generator/generate_data.py
docker compose --env-file .env exec app python src/loader/load_to_mongo.py
docker compose --env-file .env exec app python src/streaming/produce_from_mongo.py --once
Start-Sleep -Seconds 5
Get-Content docker/clickhouse/init/02_mart.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery
docker compose --env-file .env exec app spark-submit --master local[*] --jars /opt/jars/clickhouse-jdbc-0.9.6-all-dependencies.jar jobs/features_etl.py
```

По умолчанию этот шаг делает только CSV-экспорт.
Если нужен дополнительный parquet-артефакт, запускайте ETL явно с флагом:

```powershell
docker compose --env-file .env exec app sh -lc "FEATURES_EXPORT_PARQUET=1 spark-submit --master local[*] --jars /opt/jars/clickhouse-jdbc-0.9.6-all-dependencies.jar jobs/features_etl.py"
```

## 7) Проверки

### 7.1 Smoke-check

```powershell
docker compose --env-file .env exec app python scripts/smoke_check.py
```

### 7.2 Проверка PII hash

```powershell
docker compose --env-file .env exec app python scripts/pii_hash_selfcheck.py
```

### 7.3 Проверка Airflow DAG

```powershell
docker compose --env-file .env exec airflow airflow dags unpause etl_to_s3_daily
docker compose --env-file .env exec airflow airflow dags trigger etl_to_s3_daily
docker compose --env-file .env exec airflow airflow dags list-runs -d etl_to_s3_daily
```

## 8) Полный copy/paste блок

```powershell
cd F:\DE_intern\probablyfresh-analytics-platform
docker compose --env-file .env down
$volumes = @(
  "probablyfresh-analytics-platform_mongodb_data",
  "probablyfresh-analytics-platform_clickhouse_data",
  "probablyfresh-analytics-platform_airflow_postgres_data",
  "probablyfresh-analytics-platform_grafana_data"
)
foreach ($v in $volumes) { docker volume rm $v 2>$null | Out-Null }
docker compose --env-file .env up -d --pull never zookeeper kafka mongodb clickhouse app grafana airflow-postgres airflow
do { Start-Sleep -Seconds 2; docker compose --env-file .env exec -T clickhouse clickhouse-client --query "SELECT 1" } while ($LASTEXITCODE -ne 0)
Get-Content docker/clickhouse/init/01_init.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery
Get-Content docker/clickhouse/init/02_mart.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery
docker compose --env-file .env exec app python src/generator/generate_data.py
docker compose --env-file .env exec app python src/loader/load_to_mongo.py
docker compose --env-file .env exec app python src/streaming/produce_from_mongo.py --once
Start-Sleep -Seconds 5
Get-Content docker/clickhouse/init/02_mart.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery
# CSV-only by default. Add FEATURES_EXPORT_PARQUET=1 only when parquet is explicitly needed.
docker compose --env-file .env exec app spark-submit --master local[*] --jars /opt/jars/clickhouse-jdbc-0.9.6-all-dependencies.jar jobs/features_etl.py
docker compose --env-file .env exec app python scripts/smoke_check.py
docker compose --env-file .env exec app python scripts/pii_hash_selfcheck.py
docker compose --env-file .env exec airflow airflow dags unpause etl_to_s3_daily
docker compose --env-file .env exec airflow airflow dags trigger etl_to_s3_daily
docker compose --env-file .env exec airflow airflow dags list-runs -d etl_to_s3_daily
```

## 9) Если volume names отличаются

Если проектная папка называется иначе, префикс volumes тоже изменится. Проверь текущие имена:

```powershell
docker volume ls | Select-String "probablyfresh"
```

После этого подставь актуальные имена в блок `$volumes`.

## 10) Запуск backend и frontend (в конце сценария)

После полного прогона pipeline можно поднять API и UI:

```powershell
docker compose --env-file .env build backend frontend
docker compose --env-file .env up -d backend frontend
docker compose --env-file .env ps backend frontend
```

Важно:
- `backend` при старте сам выполняет `python backend/manage.py migrate` и `python backend/manage.py ensure_api_token`;
- локально Django для этого сценария не нужен;
- если новая миграция была добавлена уже после запуска контейнера `backend`, примените её вручную:

```powershell
docker compose --env-file .env exec backend python backend/manage.py showmigrations api
docker compose --env-file .env exec backend python backend/manage.py migrate
```

Проверка:
- Frontend UI: `http://localhost:5173`
- Backend API: `http://localhost:8001/api`
- API docs: `http://localhost:8001/api/docs/`
- Django admin: `http://localhost:8001/admin/`

Дополнительно:
- во вкладке `Pipelines` доступен блок `Загрузка данных`;
- текущий ingestion сохраняет ошибки batch и валидные строки в staging layer, но не вмешивается в основной pipeline MongoDB/Kafka;
- для проверки можно использовать endpoint-ы:
  - `POST /api/imports`
  - `GET /api/imports/{id}`
  - `GET /api/imports/{id}/errors`
  - `GET /api/imports/{id}/staging`
