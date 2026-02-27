cd F:\DE_intern\probablyfresh-analytics-platform
docker compose --env-file .env down -v
docker compose --env-file .env up -d zookeeper kafka mongodb clickhouse app grafana
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
docker compose --env-file .env run --rm app spark-submit --master local[*] --jars /opt/jars/clickhouse-jdbc-0.9.6-all-dependencies.jar jobs/features_etl.py

