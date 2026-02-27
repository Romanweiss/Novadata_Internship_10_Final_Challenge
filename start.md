cd F:\DE_intern\probablyfresh-analytics-platform
docker compose --env-file .env down -v
docker compose --env-file .env up -d zookeeper kafka mongodb clickhouse app
Get-Content docker/clickhouse/init/01_init.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery
Get-Content docker/clickhouse/init/02_mart.sql -Raw | docker compose --env-file .env exec -T clickhouse clickhouse-client --multiquery
docker compose --env-file .env run --rm app sh -lc "pip install -r requirements.txt && python src/streaming/produce_from_mongo.py --once"
Start-Sleep -Seconds 5
docker compose --env-file .env exec -T clickhouse clickhouse-client --query "SELECT 'customers_mart' AS t, count() FROM probablyfresh_mart.customers_mart UNION ALL SELECT 'purchases_mart', count() FROM probablyfresh_mart.purchases_mart"
docker compose --env-file .env run --rm app sh -lc "if ! command -v java >/dev/null 2>&1; then apt-get update && (apt-get install -y --no-install-recommends default-jre-headless || apt-get install -y --no-install-recommends openjdk-21-jre-headless); fi && pip install -r requirements.txt pyspark boto3 && python jobs/features_etl.py"

