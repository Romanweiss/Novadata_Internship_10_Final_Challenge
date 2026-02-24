# ProbablyFresh Analytics Platform: описание программы

## 1) Смысл программы

`probablyfresh-analytics-platform` это учебно-прикладной ETL/ELT проект для ритейла.
Он показывает полный путь данных:

1. генерация JSON-данных,
2. загрузка в MongoDB,
3. стриминг через Kafka,
4. посадка в ClickHouse RAW,
5. очистка и дедупликация в ClickHouse MART,
6. визуальная проверка в Grafana.

Ключевая идея: разделить слой "как пришло" (RAW) и слой "для аналитики" (MART), включая контроль качества данных (`duplicates_ratio`, `invalid_rows`).

## 2) Где применять

Проект подходит для:

- PoC аналитической платформы розничной сети.
- Шаблона для собеседований/демо по Data Engineering.
- Базы для учебных задач по Kafka + ClickHouse + Grafana.
- Прототипа DQ-контроля (data quality) с простыми алертами.

В продакшене такой подход применим для:

- сети магазинов,
- e-commerce,
- программ лояльности,
- оперативной аналитики заказов и клиентских событий.

## 3) Что делает программа по шагам

1. `generate_data.py` генерирует демо-датасет в `data/`.
2. `load_to_mongo.py` грузит JSON в MongoDB (upsert по бизнес-ключам).
3. `produce_from_mongo.py --once` читает MongoDB и публикует записи в Kafka:
- `stores`, `products`, `customers`, `purchases`.
- Для `customers` и `purchases` нормализует и шифрует `email`/`phone`.
4. `01_init.sql` поднимает RAW-слой в ClickHouse и ingestion Kafka -> RAW через MV.
5. `02_mart.sql` поднимает MART-слой, создает MV RAW -> MART, добавляет статистику качества.
6. Grafana автоматически подключает datasource и dashboard через provisioning.

## 4) Карта файлов: за что отвечает каждый файл

### Корень проекта

- `docker-compose.yml`
  - Поднимает сервисы: `zookeeper`, `kafka`, `mongodb`, `clickhouse`, `grafana`, `app`.
  - Монтирует provisioning Grafana и дашборды.
  - Прокидывает env-переменные и volume-хранилища.

- `Makefile`
  - Команды-обертки для запуска задач.
  - Основные цели: `up`, `down`, `generate-data`, `load-nosql`, `init-ch`, `mart-init`, `run-producer`, `init-grafana`.

- `.env.example`
  - Эталон переменных окружения.
  - Содержит параметры Mongo/Kafka/ClickHouse/Grafana/FERNET.

- `.env`
  - Локальные значения env для запуска.

- `requirements.txt`
  - Python-зависимости (`pymongo`, `kafka-python`, `cryptography`, `faker`, `python-dotenv`, `requests`, `clickhouse-driver`).

- `README.md`
  - Инструкция по запуску, проверкам и частым проблемам.

### SQL-инициализация

- `docker/clickhouse/init/01_init.sql`
  - Создает `probablyfresh_raw`.
  - Создает RAW таблицы `stores_raw`, `products_raw`, `customers_raw`, `purchases_raw`.
  - Создает Kafka Engine таблицы (`*_kafka`).
  - Создает MV Kafka -> RAW (`mv_*_raw`).

- `docker/clickhouse/init/02_mart.sql`
  - Создает `probablyfresh_mart`.
  - Создает MART таблицы на `ReplacingMergeTree(ingested_at)`:
    - `stores_mart`, `products_mart`, `customers_mart`, `purchases_mart`.
  - Создает MV RAW -> MART (`mv_*_to_mart`) с очисткой и валидацией.
  - Создает `mart_quality_stats`.
  - Пишет snapshot-метрики качества (total/inserted/invalid/duplicates/ratio).

### Grafana provisioning

- `docker/grafana/provisioning/datasources/clickhouse.yaml`
  - Автосоздание datasource `ClickHouse`.
  - Тип datasource: `grafana-clickhouse-datasource`.

- `docker/grafana/provisioning/dashboards/dashboard.yaml`
  - Автоподхват JSON-дашбордов из `/var/lib/grafana/dashboards`.

- `docker/grafana/dashboards/probablyfresh_raw_overview.json`
  - Dashboard `ProbablyFresh RAW Overview`.
  - Показывает RAW-счетчики, уникальные ключи и DQ-метрики из `mart_quality_stats`.

### Основные исполняемые скрипты (`src/`)

- `src/generator/generate_data.py`
  - Генератор JSON датасета MVP.
  - Очищает старые JSON в `data/*`.
  - Генерирует stores/products/customers/purchases.
  - Делает self-check по целевым объемам.

- `src/loader/load_to_mongo.py`
  - Загрузка JSON -> MongoDB.
  - Upsert в коллекции `stores/products/customers/purchases`.
  - Печатает статистику inserted/updated/processed.

- `src/streaming/produce_from_mongo.py`
  - Чтение документов из MongoDB и публикация в Kafka.
  - Режим `--once`.
  - Нормализация и шифрование PII (`email`, `phone`) для `customers` и `purchases`.

### Пакетный слой `src/probablyfresh/` (модульная версия)

Это альтернативный программный слой для запуска через Python-модули. Текущий основной поток в README использует `src/generator|loader|streaming`, но пакет полезен для расширений.

- `src/probablyfresh/config.py`
  - Централизованный `Settings` (чтение env).

- `src/probablyfresh/core/data_generation.py`
  - Альтернативный генератор данных через `Settings`.

- `src/probablyfresh/core/normalization.py`
  - Нормализация `email` и `phone`.

- `src/probablyfresh/core/crypto_utils.py`
  - Класс `Encryptor` (Fernet) и генерация ключа.

- `src/probablyfresh/integrations/mongo_loader.py`
  - Прямая загрузка JSON в MongoDB.

- `src/probablyfresh/integrations/kafka_producer.py`
  - Публикация raw-событий в Kafka через `Settings`.

- `src/probablyfresh/integrations/clickhouse_client.py`
  - Выполнение SQL-инициализаций в ClickHouse через Python-клиент.

- `src/probablyfresh/jobs/generate_data.py`
  - CLI-обертка для `core.data_generation.generate_data`.

- `src/probablyfresh/jobs/load_nosql.py`
  - CLI-обертка для `integrations.mongo_loader.load_to_mongodb`.

- `src/probablyfresh/jobs/run_producer.py`
  - CLI-обертка для `integrations.kafka_producer.publish_raw_events`.

- `src/probablyfresh/jobs/init_clickhouse.py`
  - CLI-обертка для SQL-инициализации ClickHouse.

- `src/probablyfresh/jobs/init_grafana.py`
  - Health-check Grafana после старта.

### Папка `infra/`

- `infra/*` содержит более ранние/альтернативные конфиги.
- В текущем основном запуске используются файлы из `docker/*`.
- Рекомендуется постепенно консолидировать `infra/` и `docker/`, чтобы избежать дублирования.

### Папка `data/`

Содержит сгенерированные JSON-файлы:

- `data/stores/*.json`
- `data/products/*.json`
- `data/customers/*.json`
- `data/purchases/*.json`

## 5) Функции в ключевых файлах

### `src/generator/generate_data.py`

- `parse_seed()`
  - Берет seed из `--seed` или `SEED` env.

- `project_root()`
  - Возвращает корень репозитория.

- `iso_z(value)`
  - Форматирует `datetime` в ISO UTC c `Z`.

- `clean_json_files(path)`
  - Удаляет старые `*.json` в папке.

- `write_json(path, payload)`
  - Пишет JSON на диск (`utf-8`, pretty).

- `random_phone()`, `random_barcode()`, `random_inn()`
  - Генерация синтетических значений.

- `generate_stores(...)`
  - Генерирует 45 магазинов (30 Almost, 15 Maybe).

- `generate_products(...)`
  - Генерирует 100 товаров (20 на категорию).

- `generate_customers(...)`
  - Генерирует покупателей (2-5 на магазин).

- `generate_purchases(...)`
  - Генерирует 200 покупок с вложенными товарами.

- `self_check(...)`
  - Проверяет целевые объемы и распределения.

- `main()`
  - Оркестрация полного цикла генерации.

### `src/loader/load_to_mongo.py`

- `_repo_root()`
  - Корень проекта.

- `_read_json_files(directory)`
  - Чтение JSON-пакета из папки.

- `_upsert_documents(collection, docs, key_field)`
  - Bulk upsert по бизнес-ключу.

- `main()`
  - Проверка env, цикл по сущностям, логирование результатов.

### `src/streaming/produce_from_mongo.py`

- `parse_args()`
  - Валидирует, что выбран режим `--once`.

- `get_required_env(name)`
  - Жесткая проверка обязательных env.

- `normalize_email(value)`
  - `strip + lower`.

- `normalize_phone(value)`
  - Приведение к E.164-формату с fallback.

- `encrypt_text(cipher, value)`
  - Шифрование строки через Fernet.

- `transform_pii(value, cipher, entity_name, doc_id)`
  - Рекурсивная нормализация+шифрование `email/phone` в dict/list.

- `resolve_topics()`
  - Маппинг сущностей на Kafka topics.

- `main()`
  - Чтение Mongo, трансформация, отправка в Kafka, финальные counters.

## 6) Как развивать и улучшать проект

### Ближайшие улучшения (практичные)

- Убрать двойной запуск `02_mart.sql` после producer:
  - вынести snapshot quality-метрик в отдельный SQL/скрипт,
  - запускать только блок `INSERT INTO mart_quality_stats`.

- Сделать `app`-образ с предустановленными зависимостями:
  - убрать `pip install -r requirements.txt` в каждом запуске,
  - ускорить прогон и повысить стабильность.

- Добавить healthchecks в `docker-compose.yml`:
  - особенно для `kafka`, `clickhouse`, `grafana`.

- Добавить idempotent reset-команду:
  - например `scripts/reset_and_seed.ps1` для чистого запуска в один шаг.

### Качество данных и аналитика

- Вынести DQ-правила в отдельный слой/файл правил.
- Добавить метрики качества по каждому entity (не только purchases).
- Добавить алерт в Grafana на пороги `duplicates_ratio` и `invalid_rows`.

### Надежность пайплайна

- Добавить retries/backoff для producer и загрузчика.
- Добавить DLQ-топики для невалидных сообщений.
- Добавить schema-versioning для событий (Avro/JSON Schema).

### Производственная готовность

- Перейти с synthetic генератора к CDC/инкрементальной загрузке.
- Добавить оркестрацию (Airflow/Prefect).
- Добавить CI-проверки:
  - линтер,
  - smoke-тесты SQL,
  - e2e тест "generate -> mongo -> kafka -> raw -> mart".

### Структура репозитория

- Консолидировать `infra/` и `docker/` в один актуальный набор конфигов.
- Зафиксировать единый способ запуска (либо Makefile-first, либо container-first).
- Убрать устаревшие/дублирующие скрипты после миграции.

## 7) Краткий итог

Проект уже закрывает важный MVP-поток данных и DQ-контроль на уровне MART.
Следующий логичный шаг: автоматизировать quality snapshot, добавить тесты и довести сценарий запуска до полностью идемпотентного one-click.
