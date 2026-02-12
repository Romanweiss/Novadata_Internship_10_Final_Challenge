PYTHON ?= python
ENV_FILE ?= .env

.PHONY: up down generate-data load-nosql init-ch run-producer init-grafana

up:
	docker compose --env-file $(ENV_FILE) up -d

down:
	docker compose --env-file $(ENV_FILE) down -v

generate-data:
	PYTHONPATH=src $(PYTHON) -m probablyfresh.jobs.generate_data

load-nosql:
	PYTHONPATH=src $(PYTHON) -m probablyfresh.jobs.load_nosql

init-ch:
	PYTHONPATH=src $(PYTHON) -m probablyfresh.jobs.init_clickhouse

run-producer:
	PYTHONPATH=src $(PYTHON) -m probablyfresh.jobs.run_producer

init-grafana:
	PYTHONPATH=src $(PYTHON) -m probablyfresh.jobs.init_grafana
