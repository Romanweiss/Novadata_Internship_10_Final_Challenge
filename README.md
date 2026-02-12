# probablyfresh-analytics-platform

MVP skeleton for ProbablyFresh analytics platform (Stage 1).

## Scope of this skeleton

- Generate JSON files on disk for:
  - `stores`: 45 files (30 Almost + 15 Maybe)
  - `products`: 100 files minimum (20 in each of 5 categories)
  - `customers`: at least one customer per store
  - `purchases`: at least 200 purchases
- Load generated JSON into MongoDB.
- Publish 4 entity streams to Kafka and ingest to ClickHouse RAW tables:
  - `stores_raw`
  - `products_raw`
  - `customers_raw`
  - `purchases_raw`
- Keep original payload shape as JSON in ClickHouse `payload` column.
- Normalize and encrypt `phone` and `email` fields before publishing to Kafka.
- Provision Grafana with a dashboard validating:
  - stores count = 45
  - purchases count >= 200

## Tech stack

- Docker Compose services:
  - Zookeeper
  - Kafka
  - MongoDB
  - ClickHouse
  - Grafana
- Python package under `src/` for data generation and data movement tasks.

## Project structure

```text
.
├── .env.example
├── docker-compose.yml
├── Makefile
├── requirements.txt
├── infra/
│   ├── clickhouse/init.sql
│   └── grafana/
│       ├── dashboards/probablyfresh-overview.json
│       └── provisioning/
│           ├── dashboards/dashboard.yml
│           └── datasources/clickhouse.yml
└── src/probablyfresh/
    ├── config.py
    ├── core/
    ├── integrations/
    └── jobs/
```

## Quick start

1. Create env file and set a real encryption key:

```bash
cp .env.example .env
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Put generated key into `FERNET_KEY` in `.env`.

2. Install Python dependencies:

```bash
python -m venv .venv
source .venv/bin/activate  # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

3. Start infrastructure:

```bash
make up
```

4. Run pipeline steps:

```bash
make generate-data
make load-nosql
make init-ch
make run-producer
make init-grafana
```

5. Open Grafana:

- URL: `http://localhost:${GRAFANA_PORT}` (default `http://localhost:3000`)
- Login: values from `.env` (`GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD`)
- Dashboard: `ProbablyFresh MVP Checks`

## Make targets

- `make up`: start Docker services.
- `make down`: stop services and remove volumes.
- `make generate-data`: generate JSON files under `data/`.
- `make load-nosql`: load JSON files into MongoDB.
- `make init-ch`: create ClickHouse RAW + Kafka + MV objects.
- `make run-producer`: publish encrypted/normalized payloads to Kafka.
- `make init-grafana`: wait for Grafana health and provisioning readiness.

## Notes

- This commit provides project skeleton and bootstrap workflow.
- Business logic, quality rules, and extended validations can be added in next iterations.
