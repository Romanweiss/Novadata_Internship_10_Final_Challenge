PYTHON ?= python
ENV_FILE ?= .env

.PHONY: up down generate-data load-nosql init-ch run-producer init-grafana

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

run-producer:
	docker compose --env-file $(ENV_FILE) run --rm app sh -lc "pip install -r requirements.txt && python src/streaming/produce_from_mongo.py --once"

init-grafana:
	docker compose --env-file $(ENV_FILE) up -d grafana
	@echo "Grafana provisioning is automatic on startup."
