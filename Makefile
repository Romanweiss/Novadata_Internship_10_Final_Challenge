PYTHON ?= python
ENV_FILE ?= .env

.PHONY: up down generate-data load-nosql init-ch mart-init run-producer init-grafana features-etl

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

features-etl:
	docker compose --env-file $(ENV_FILE) up -d clickhouse app
	docker compose --env-file $(ENV_FILE) run --rm app sh -lc "if ! command -v java >/dev/null 2>&1; then apt-get update && (apt-get install -y --no-install-recommends default-jre-headless || apt-get install -y --no-install-recommends openjdk-21-jre-headless); fi && pip install -r requirements.txt pyspark boto3 && python jobs/features_etl.py"
