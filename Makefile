PYTHON ?= python
ENV_FILE ?= .env

.PHONY: up down generate-data load-nosql init-ch mart-init run-producer init-grafana features-etl run-etl

up:
	docker compose --env-file $(ENV_FILE) up -d

down:
	docker compose --env-file $(ENV_FILE) down -v

generate-data:
	$(PYTHON) src/generator/generate_data.py

load-nosql:
	docker compose --env-file $(ENV_FILE) run --rm app sh -lc "pip install -r requirements.txt && python src/loader/load_to_mongo.py"

init-ch:
	docker compose --env-file $(ENV_FILE) exec -T clickhouse clickhouse-client --multiquery < docker/clickhouse/init/01_init.sql

mart-init:
	docker compose --env-file $(ENV_FILE) exec -T clickhouse clickhouse-client --multiquery < docker/clickhouse/init/02_mart.sql

run-producer:
	docker compose --env-file $(ENV_FILE) run --rm app sh -lc "pip install -r requirements.txt && python src/streaming/produce_from_mongo.py --once"

init-grafana:
	docker compose --env-file $(ENV_FILE) up -d grafana
	@echo "Grafana provisioning is automatic on startup."

run-etl:
	@echo "Fill .env before ETL: CH_HOST, CH_PORT, CH_USER, CH_PASSWORD, MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET."
	docker compose --env-file $(ENV_FILE) up -d clickhouse app
	docker compose --env-file $(ENV_FILE) run --rm app sh -lc "if ! command -v java >/dev/null 2>&1; then apt-get update && (apt-get install -y --no-install-recommends default-jre-headless || apt-get install -y --no-install-recommends openjdk-21-jre-headless); fi && pip install -r requirements.txt && spark-submit --master \"$${SPARK_MASTER:-local[*]}\" --packages com.clickhouse:clickhouse-jdbc:0.9.6 jobs/features_etl.py"

features-etl: run-etl
