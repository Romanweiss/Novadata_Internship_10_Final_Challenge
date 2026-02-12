# probablyfresh-analytics-platform

## RU

MVP-скелет аналитической платформы ProbablyFresh (этап 1).

### Что покрывает этот скелет

- Генерация JSON-файлов на диск:
  - `stores`: 45 файлов (30 Almost + 15 Maybe)
  - `products`: минимум 100 файлов (по 20 в каждой из 5 категорий)
  - `customers`: минимум 1 покупатель на магазин
  - `purchases`: минимум 200 покупок
- Загрузка сгенерированных JSON в MongoDB.
- Публикация 4 потоков сущностей в Kafka и загрузка в RAW-таблицы ClickHouse:
  - `stores_raw`
  - `products_raw`
  - `customers_raw`
  - `purchases_raw`
- Сохранение payload в ClickHouse в исходном JSON-формате (без упрощения структуры).
- Нормализация и шифрование `phone` и `email` перед отправкой в Kafka.
- Provisioning Grafana-дашборда для проверок:
  - количество магазинов = 45
  - количество покупок >= 200

### Технологии

- Docker Compose сервисы:
  - Zookeeper
  - Kafka
  - MongoDB
  - ClickHouse
  - Grafana
- Python-пакет в `src/` для генерации данных и шагов пайплайна.

### Структура проекта

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
└── src/
    ├── generator/generate_data.py
    └── probablyfresh/
        ├── config.py
        ├── core/
        ├── integrations/
        └── jobs/
```

### Быстрый старт

1. Создайте `.env` и задайте реальный ключ шифрования:

```bash
cp .env.example .env
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Вставьте полученный ключ в `FERNET_KEY` в `.env`.

2. Установите Python-зависимости:

```bash
python -m venv .venv
source .venv/bin/activate  # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

3. Поднимите инфраструктуру:

```bash
make up
```

4. Запустите шаги пайплайна:

```bash
make generate-data
make load-nosql
make init-ch
make run-producer
make init-grafana
```

5. Откройте Grafana:

- URL: `http://localhost:${GRAFANA_PORT}` (по умолчанию `http://localhost:3000`)
- Логин: значения из `.env` (`GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD`)
- Дашборд: `ProbablyFresh MVP Checks`

### Команды Makefile

- `make up`: запуск Docker-сервисов.
- `make down`: остановка сервисов и удаление volumes.
- `make generate-data`: запуск `src/generator/generate_data.py` и генерация JSON-файлов в `data/`.
- `make load-nosql`: загрузка JSON в MongoDB через `docker compose run --rm app`.
- `make init-ch`: создание объектов ClickHouse (RAW + Kafka + MV).
- `make run-producer`: отправка нормализованных и зашифрованных payload в Kafka.
- `make init-grafana`: ожидание готовности Grafana и provisioning.

### Примечания

- Текущий коммит задает каркас проекта и bootstrap-процесс.
- Детальная бизнес-логика и дополнительные проверки добавляются на следующих этапах.
- Генератор идемпотентный: перед каждой генерацией очищаются только `*.json` в `data/stores`, `data/products`, `data/customers`, `data/purchases` (служебные файлы вроде `.gitkeep` сохраняются).
- Детерминизм генератора: seed берется из `SEED` (по умолчанию `42`) или из CLI-аргумента `--seed`, который имеет приоритет.

---

## EN

MVP skeleton for ProbablyFresh analytics platform (Stage 1).

### Scope of this skeleton

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

### Tech stack

- Docker Compose services:
  - Zookeeper
  - Kafka
  - MongoDB
  - ClickHouse
  - Grafana
- Python package under `src/` for data generation and data movement tasks.

### Project structure

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
└── src/
    ├── generator/generate_data.py
    └── probablyfresh/
        ├── config.py
        ├── core/
        ├── integrations/
        └── jobs/
```

### Quick start

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

### Make targets

- `make up`: start Docker services.
- `make down`: stop services and remove volumes.
- `make generate-data`: run `src/generator/generate_data.py` and generate JSON files under `data/`.
- `make load-nosql`: load JSON files into MongoDB via `docker compose run --rm app`.
- `make init-ch`: create ClickHouse RAW + Kafka + MV objects.
- `make run-producer`: publish encrypted/normalized payloads to Kafka.
- `make init-grafana`: wait for Grafana health and provisioning readiness.

### Notes

- Generator is idempotent: before each run it removes only `*.json` files in `data/stores`, `data/products`, `data/customers`, `data/purchases` (service files like `.gitkeep` are preserved).
- Generator determinism: seed is taken from `SEED` (default `42`) or CLI argument `--seed` (CLI takes precedence).
