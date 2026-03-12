# Teacher Review Checklist (Pipeline)

This checklist is designed for a quick, deterministic teacher review of the data pipeline.

## A. What to run

```powershell
cd F:\DE_intern\probablyfresh-analytics-platform
if (!(Test-Path .env)) { throw ".env not found" }

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

docker compose --env-file .env run --rm app python scripts/smoke_check.py
docker compose --env-file .env run --rm app spark-submit --master local[*] --jars /opt/jars/clickhouse-jdbc-0.9.6-all-dependencies.jar jobs/features_etl.py
```

## B. What to show in ClickHouse

### 1) RAW counts
```sql
SELECT 'stores_raw' AS t, count() AS c FROM probablyfresh_raw.stores_raw
UNION ALL SELECT 'products_raw', count() FROM probablyfresh_raw.products_raw
UNION ALL SELECT 'customers_raw', count() FROM probablyfresh_raw.customers_raw
UNION ALL SELECT 'purchases_raw', count() FROM probablyfresh_raw.purchases_raw
UNION ALL SELECT 'purchase_items_raw', count() FROM probablyfresh_raw.purchase_items_raw;
```

### 2) MART FINAL counts
```sql
SELECT 'customers_mart_final' AS t, count() AS c FROM probablyfresh_mart.customers_mart FINAL
UNION ALL SELECT 'purchases_mart_final', count() FROM probablyfresh_mart.purchases_mart FINAL
UNION ALL SELECT 'purchase_items_mart_final', count() FROM probablyfresh_mart.purchase_items_mart FINAL;
```

### 3) PII is one-way hashed (SHA-256 hex)
```sql
SELECT
  email_enc,
  phone_enc,
  length(email_enc) AS email_len,
  length(phone_enc) AS phone_len,
  match(email_enc, '^[0-9a-f]{64}$') AS email_is_hex64,
  match(phone_enc, '^[0-9a-f]{64}$') AS phone_is_hex64
FROM probablyfresh_mart.customers_mart FINAL
LIMIT 5;
```

## C. What to show in Grafana

Dashboard: `ProbablyFresh RAW Overview`

Validate:
- Stores and purchases panels are not empty.
- Stores by network reflects generated data.
- Quality panels reflect `mart_quality_stats` latest snapshot.

## D. What to show in Airflow

UI: `http://localhost:8080`

Commands:
```powershell
docker compose --env-file .env exec airflow airflow dags unpause etl_to_s3_daily
docker compose --env-file .env exec airflow airflow dags trigger etl_to_s3_daily
docker compose --env-file .env exec airflow airflow dags list-runs -d etl_to_s3_daily
```

Show successful DAG run and task statuses.

## E. What to show in S3

- File exists: `analytic_result_YYYY_MM_DD.csv`
- Size > 1KB
- Schema: 31 columns (`customer_id` + 30 binary features)

## F. Pass criteria (summary)

- End-to-end run completed without critical errors.
- RAW and MART populated.
- PII anonymization is one-way and consistent.
- ETL output uploaded to S3.
- Grafana dashboards and Airflow DAG operational.
- Smoke check passes.
