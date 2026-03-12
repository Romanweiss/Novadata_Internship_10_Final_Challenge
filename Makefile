PYTHON ?= python
ENV_FILE ?= .env

.PHONY: up down generate-data load-nosql init-ch mart-init run-producer init-grafana features-etl run-etl smoke verify pii-check

up:
	docker compose --env-file $(ENV_FILE) up -d

down:
	docker compose --env-file $(ENV_FILE) down -v

generate-data:
	docker compose --env-file $(ENV_FILE) run --rm app python src/generator/generate_data.py

load-nosql:
	docker compose --env-file $(ENV_FILE) run --rm app python src/loader/load_to_mongo.py

init-ch:
	docker compose --env-file $(ENV_FILE) exec -T clickhouse clickhouse-client --multiquery < docker/clickhouse/init/01_init.sql

mart-init:
	docker compose --env-file $(ENV_FILE) exec -T clickhouse clickhouse-client --multiquery < docker/clickhouse/init/02_mart.sql

run-producer:
	docker compose --env-file $(ENV_FILE) run --rm app python src/streaming/produce_from_mongo.py --once

init-grafana:
	docker compose --env-file $(ENV_FILE) up -d grafana
	@echo "Grafana provisioning is automatic on startup."

run-etl:
	@echo "Fill .env before ETL: CH_HOST, CH_PORT, CH_USER, CH_PASSWORD, S3_ENDPOINT_URL, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET."
	docker compose --env-file $(ENV_FILE) up -d clickhouse app
	docker compose --env-file $(ENV_FILE) run --rm app spark-submit --master local[*] --jars /opt/jars/clickhouse-jdbc-0.9.6-all-dependencies.jar jobs/features_etl.py

features-etl: run-etl

smoke:
	docker compose --env-file $(ENV_FILE) up -d clickhouse app
	docker compose --env-file $(ENV_FILE) run --rm app python scripts/smoke_check.py

verify: smoke

pii-check:
	docker compose --env-file $(ENV_FILE) run --rm app python scripts/pii_hash_selfcheck.py
