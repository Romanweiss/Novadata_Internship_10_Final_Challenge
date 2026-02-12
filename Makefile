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
	PYTHONPATH=src $(PYTHON) -m probablyfresh.jobs.init_clickhouse

run-producer:
	PYTHONPATH=src $(PYTHON) -m probablyfresh.jobs.run_producer

init-grafana:
	PYTHONPATH=src $(PYTHON) -m probablyfresh.jobs.init_grafana
