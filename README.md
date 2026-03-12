# ProbablyFresh Analytics Platform

End-to-end Data Engineering pipeline: `JSON -> MongoDB -> Kafka -> ClickHouse RAW -> ClickHouse MART -> PySpark ETL -> S3`, with monitoring in Grafana, orchestration in Airflow, and control panel via Django API + React UI.

## 1. Architecture

```text
JSON files
  -> MongoDB
  -> Kafka topics
  -> ClickHouse RAW
  -> ClickHouse MART
  -> PySpark features ETL
  -> S3 (analytic_result_YYYY_MM_DD.csv)

Grafana: dashboards + alerts
Airflow: daily DAG etl_to_s3_daily
Django backend: API + job actions + run history
React frontend: Control Panel UI
```

## 2. Main services (docker-compose)

- `zookeeper`, `kafka`
- `mongodb`
- `clickhouse`
- `grafana`
- `app` (Python/Spark runner)
- `airflow-postgres`, `airflow`
- `backend` (Django + DRF)
- `frontend` (Vite + React)

## 3. Key files

### Pipeline core
- `src/generator/generate_data.py` - demo JSON generation.
- `src/loader/load_to_mongo.py` - JSON -> MongoDB.
- `src/streaming/produce_from_mongo.py` - Mongo -> Kafka publish.
- `src/probablyfresh/core/normalization.py` - email/phone normalization.
- `src/probablyfresh/core/crypto_utils.py` - one-way PII hashing (`SHA-256 + salt`).
- `docker/clickhouse/init/01_init.sql` - RAW layer + Kafka Engine + MV.
- `docker/clickhouse/init/02_mart.sql` - MART layer + quality snapshots.
- `jobs/features_etl.py` - Spark features ETL and S3 upload.
- `scripts/smoke_check.py` - end-to-end smoke checks.
- `scripts/pii_hash_selfcheck.py` - PII hash self-check.

### Backend/UI
- `backend/` - Django API, actions, run status, presets, admin.
- `frontend/` - React control panel.
- `docker-compose.yml` - full infrastructure.
- `ZERO_START_DOCKER.txt` - full zero-start runbook.
- `START_BACKEND_FRONTEND.txt` - quick start for backend + frontend only.

## 4. Environment setup

1. Go to project root:

```powershell
cd F:\DE_intern\probablyfresh-analytics-platform
```

2. `.env` must already exist and be filled manually (do not overwrite):

```powershell
if (!(Test-Path .env)) { throw ".env not found. Create it manually from .env.example and fill secrets." }
```

Critical variables:
- `PII_HASH_SALT` (>= 16 chars)
- `S3_ENDPOINT_URL`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`
- `API_TOKEN` (for frontend/backend API auth)
- `TELEGRAM_BOT_TOKEN` (if Telegram alerting is required)

## 5. Full pipeline run from zero (PowerShell, Docker-only)

Use `ZERO_START_DOCKER.txt` as the source of truth.

Minimal full sequence:

```powershell
cd F:\DE_intern\probablyfresh-analytics-platform
if (!(Test-Path .env)) { throw ".env not found. Create it manually from .env.example and fill secrets." }
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

docker compose --env-file .env run --rm app spark-submit --master local[*] --jars /opt/jars/clickhouse-jdbc-0.9.6-all-dependencies.jar jobs/features_etl.py
```

## 6. Backend + Frontend start

Use `START_BACKEND_FRONTEND.txt`.

```powershell
cd F:\DE_intern\probablyfresh-analytics-platform
docker compose --env-file .env build backend frontend
docker compose --env-file .env up -d backend frontend
docker compose --env-file .env ps backend frontend
```

URLs:
- Frontend UI: `http://localhost:5173`
- Backend API: `http://localhost:8001/api`
- OpenAPI docs: `http://localhost:8001/api/docs/`
- Django admin: `http://localhost:8001/admin/`

## 7. Airflow

- UI: `http://localhost:8080`
- Default login/password: `admin/admin` (if not overridden in `.env`).
- DAG: `etl_to_s3_daily` (daily 10:00, `Europe/Moscow`, `catchup=False`).

Manual trigger:

```powershell
docker compose --env-file .env exec airflow airflow dags unpause etl_to_s3_daily
docker compose --env-file .env exec airflow airflow dags trigger etl_to_s3_daily
docker compose --env-file .env exec airflow airflow dags list-runs -d etl_to_s3_daily
```

## 8. Verification

Smoke test:

```powershell
docker compose --env-file .env run --rm app python scripts/smoke_check.py
```

PII hash self-check:

```powershell
docker compose --env-file .env run --rm app python scripts/pii_hash_selfcheck.py
```

Quick ClickHouse checks:

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

Expected for PII columns: `64` (or `0` for empty source values).

## 9. Important notes

- `docker compose ... down -v` deletes containers and volumes, but does not modify `.env`.
- Run `02_mart.sql` only after `01_init.sql`.
- If SQL init files changed, do full re-init (`down -v` + init scripts).
- No `make` is required; all official commands are Docker/PowerShell.
