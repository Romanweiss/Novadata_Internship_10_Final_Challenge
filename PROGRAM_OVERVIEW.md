# PROGRAM OVERVIEW — ProbablyFresh Analytics Platform

## 1. Что это за проект и зачем он нужен

Этот репозиторий показывает полный учебно-практический data pipeline для сети магазинов ProbablyFresh:

1. Генерируются JSON-данные (`stores`, `products`, `customers`, `purchases`).
2. JSON загружаются в MongoDB.
3. Данные публикуются в Kafka.
4. Kafka-сообщения попадают в ClickHouse RAW.
5. Из RAW данные очищаются и дедуплицируются в ClickHouse MART.
6. В Grafana проверяются метрики и качество данных.
7. Отдельный PySpark job строит признаки клиентов и выгружает CSV в S3/MinIO.

Главная идея архитектуры:

- `RAW` хранит данные в виде, максимально близком к источнику (payload JSON строкой).
- `MART` хранит уже пригодные для аналитики поля с контролем качества.

---

## 2. Краткая архитектура (простыми словами)

```text
JSON files -> MongoDB -> Kafka -> ClickHouse RAW -> ClickHouse MART -> Grafana
                                                      \
                                                       -> PySpark ETL -> S3/MinIO CSV
```

Компоненты:

- `MongoDB`: оперативное NoSQL-хранилище исходных документов.
- `Kafka`: транспорт событий между системами.
- `ClickHouse RAW`: слой «как пришло».
- `ClickHouse MART`: слой «очищено + дедупликация + аналитика».
- `Grafana`: dashboard + alerting.
- `PySpark`: расчет клиентских фичей.

---

## 3. Полный список файлов проекта и ответственность каждого

Ниже перечислены кодовые и конфигурационные файлы (без `data/*.json` и без `__pycache__`).

### 3.1 Корень репозитория

- `.env`
  - Локальные значения окружения (пароли, host, ключи).
  - Не коммитится в git.

- `.env.example`
  - Эталонный шаблон env-переменных.
  - Включает настройки Mongo/Kafka/ClickHouse/Grafana/FERNET/S3-MinIO/Spark.

- `.gitignore`
  - Исключает локальные env, кэш, IDE-файлы, сгенерированные JSON.

- `docker-compose.yml`
  - Поднимает сервисы: `zookeeper`, `kafka`, `mongodb`, `clickhouse`, `grafana`, `app`.
  - Монтирует Grafana provisioning.
  - Пробрасывает порты наружу.

- `Makefile`
  - Командные цели для запуска пайплайна.
  - Ключевые цели: `up`, `down`, `generate-data`, `load-nosql`, `init-ch`, `mart-init`, `run-producer`, `run-etl`.

- `requirements.txt`
  - Python-зависимости проекта (`pymongo`, `kafka-python`, `cryptography`, `pyspark`, `boto3`, и т.д.).

- `README.md`
  - Инструкция запуска и проверки.

- `PROGRAM_OVERVIEW.md`
  - Этот файл, подробная инженерная карта проекта.

### 3.2 Основные исполняемые Python-скрипты

- `src/generator/generate_data.py`
  - Генерирует демо JSON-датасет в `data/`.

- `src/loader/load_to_mongo.py`
  - Загружает JSON из `data/` в MongoDB с upsert.

- `src/streaming/produce_from_mongo.py`
  - Читает MongoDB и публикует в Kafka.
  - Для `customers` и `purchases` нормализует и шифрует `email`/`phone`.

- `jobs/features_etl.py`
  - Spark ETL: читает MART через JDBC, считает клиентские фичи, пишет CSV и загружает в S3/MinIO.

### 3.3 SQL-слой ClickHouse

- `docker/clickhouse/init/01_init.sql`
  - Создает RAW БД и таблицы.
  - Создает Kafka Engine таблицы.
  - Создает Materialized Views Kafka -> RAW.

- `docker/clickhouse/init/02_mart.sql`
  - Создает MART БД и таблицы (`ReplacingMergeTree`).
  - Создает Materialized Views RAW -> MART с очисткой.
  - Создает `mart_quality_stats` и заполняет snapshot статистики качества.

### 3.4 Grafana конфигурации (актуальные)

- `docker/grafana/provisioning/datasources/clickhouse.yaml`
  - Автоматически создает datasource ClickHouse.

- `docker/grafana/provisioning/dashboards/dashboard.yaml`
  - Включает автоподхват dashboard JSON.

- `docker/grafana/dashboards/probablyfresh_raw_overview.json`
  - Основной dashboard по RAW/MART метрикам.

- `grafana/provisioning/datasources/clickhouse.yaml`
  - Datasource provisioning (используется через монтирование `./grafana/provisioning`).

- `grafana/provisioning/dashboards/dashboard.yaml`
  - Dashboard provider provisioning.

- `grafana/provisioning/alerting/contact-points.yaml`
  - Контакт Telegram.

- `grafana/provisioning/alerting/notification-policies.yaml`
  - Политика маршрутизации алертов.

- `grafana/provisioning/alerting/alert-rules.yaml`
  - Alert rule `Duplicates_ratio`.

- `grafana/provisioning/alerting/templates.yaml`
  - Шаблон текста уведомлений в Telegram.

### 3.5 Пакет `src/probablyfresh` (модульный слой)

Этот слой дублирует/инкапсулирует часть логики в виде пакета. Он полезен для дальнейшего расширения и unit-тестов.

- `src/probablyfresh/__init__.py`
  - Версия пакета.

- `src/probablyfresh/config.py`
  - Класс `Settings` + чтение env.

- `src/probablyfresh/core/__init__.py`
  - Маркер core-модуля.

- `src/probablyfresh/core/crypto_utils.py`
  - Шифрование через Fernet (`Encryptor`).

- `src/probablyfresh/core/normalization.py`
  - Нормализация email/phone.

- `src/probablyfresh/core/data_generation.py`
  - Генерация данных через `Settings`.

- `src/probablyfresh/integrations/__init__.py`
  - Маркер интеграционного модуля.

- `src/probablyfresh/integrations/mongo_loader.py`
  - Загрузка JSON в Mongo (вариант с delete+insert).

- `src/probablyfresh/integrations/kafka_producer.py`
  - Публикация событий в Kafka (вариант через package settings).

- `src/probablyfresh/integrations/clickhouse_client.py`
  - Выполнение SQL-инициализации через `clickhouse_driver.Client`.

- `src/probablyfresh/jobs/__init__.py`
  - Маркер job-entrypoints.

- `src/probablyfresh/jobs/generate_data.py`
  - Тонкий entrypoint для package-генератора.

- `src/probablyfresh/jobs/load_nosql.py`
  - Тонкий entrypoint для package-загрузчика.

- `src/probablyfresh/jobs/run_producer.py`
  - Тонкий entrypoint для package-producer.

- `src/probablyfresh/jobs/init_clickhouse.py`
  - Тонкий entrypoint инициализации ClickHouse (`infra/clickhouse/init.sql`).

- `src/probablyfresh/jobs/init_grafana.py`
  - Health-check Grafana.

### 3.6 Legacy/альтернативные файлы infra

- `infra/clickhouse/init.sql`
- `infra/grafana/provisioning/datasources/clickhouse.yml`
- `infra/grafana/provisioning/dashboards/dashboard.yml`
- `infra/grafana/dashboards/probablyfresh-overview.json`

Это более ранний набор конфигов. Текущий рабочий путь в Docker-рантайме идет через `docker/*` и `grafana/provisioning/*`.

---

## 4. Детальный разбор основных Python-файлов: импорты и функции

## 4.1 `src/generator/generate_data.py`

Роль: синтетическая генерация тестового датасета для всего пайплайна.

Импорты:

- Стандартная библиотека:
  - `argparse`, `json`, `os`, `random`, `collections.Counter`, `datetime`, `pathlib.Path`, `typing.Any`.
  - Нужны для CLI, генерации, файлов, дат, валидации и типизации.

- Внешние:
  - `faker.Faker` для реалистичных персональных/адресных данных.

Ключевые функции:

- `parse_seed()`
  - Читает seed из `--seed` или env `SEED`.
  - Гарантирует детерминированность генерации.

- `project_root()`
  - Возвращает корень проекта.

- `iso_z(value)`
  - Приводит `datetime` к ISO-строке в UTC с `Z`.

- `clean_json_files(path)`
  - Удаляет старые `*.json` в целевой директории.

- `write_json(path, payload)`
  - Унифицированная запись JSON на диск.

- `random_phone()`, `random_barcode()`, `random_inn()`
  - Хелперы генерации идентификаторов.

- `generate_stores(fake, stores_dir, base_date)`
  - Создает 45 магазинов (30 Almost + 15 Maybe).

- `generate_products(fake, products_dir)`
  - Создает 100 товаров (20 на категорию).

- `generate_customers(fake, customers_dir, stores, base_date)`
  - Создает клиентов по магазинам.

- `generate_purchases(purchases_dir, stores, products, customers, base_date)`
  - Создает минимум 200 покупок, связывая клиентов, магазины и товары.

- `self_check(stores, products, customers, purchases)`
  - Проверяет целевые объемы и распределение товаров по категориям.

- `main()`
  - Оркеструет весь генератор от seed до итоговой печати результата.

Выход:

- JSON-файлы в `data/stores|products|customers|purchases`.

## 4.2 `src/loader/load_to_mongo.py`

Роль: загрузка файлов из `data/` в MongoDB.

Импорты:

- Стандартная библиотека: `json`, `os`, `pathlib.Path`, `typing.Any`.
- Внешние: `pymongo.MongoClient`, `pymongo.UpdateOne`.

Ключевые сущности и функции:

- `ENTITY_MAP`
  - Сопоставляет директории/коллекции и бизнес-ключи для upsert.

- `_repo_root()`
  - Находит корень проекта.

- `_read_json_files(directory)`
  - Читает все JSON в список документов.

- `_upsert_documents(collection, docs, key_field)`
  - Bulk upsert по ключу (`store_id`, `id`, `customer_id`, `purchase_id`).
  - Возвращает статистику inserted/updated/processed.

- `main()`
  - Читает `MONGO_URI`, `MONGO_DB`, проходит по сущностям, грузит данные в Mongo.

Выход:

- Коллекции `stores`, `products`, `customers`, `purchases` в MongoDB.

## 4.3 `src/streaming/produce_from_mongo.py`

Роль: экспорт Mongo -> Kafka, включая PII-пайплайн.

Импорты:

- Стандартная библиотека: `argparse`, `json`, `logging`, `os`, `re`, `typing.Any`.
- Внешние: `cryptography.fernet.Fernet`, `kafka.KafkaProducer`, `pymongo.MongoClient`.

Ключевые константы:

- `ENTITY_TO_TOPIC_ENV` — mapping сущность -> env topic.
- `PII_ENTITIES` — где шифруются персональные поля.

Ключевые функции:

- `parse_args()`
  - Разрешает только режим `--once`.

- `get_required_env(name)`
  - Жестко проверяет обязательные env.

- `normalize_email(value)`
  - `strip + lower`.

- `normalize_phone(value)`
  - Приводит к E.164-подобному формату (`8xxxxxxxxxx` -> `+7xxxxxxxxxx`).

- `encrypt_text(cipher, value)`
  - Шифрует строку через Fernet.

- `transform_pii(value, cipher, entity_name, doc_id)`
  - Рекурсивно проходит JSON и шифрует `email/phone`.

- `resolve_topics()`
  - Готовит финальный mapping entity -> topic.

- `main()`
  - Читает Mongo, трансформирует payload, отправляет в Kafka.

Выход:

- Kafka сообщения в топики:
  - `probablyfresh.stores`
  - `probablyfresh.products`
  - `probablyfresh.customers`
  - `probablyfresh.purchases`

## 4.4 `jobs/features_etl.py`

Роль: PySpark ETL для расчета бинарных клиентских признаков и выгрузки CSV в S3/MinIO.

Импорты:

- Стандартная библиотека:
  - `logging`, `shutil`, `tempfile`, `datetime`, `pathlib.Path`, `os`.

- Внешние:
  - `boto3` (S3 API), `dotenv.load_dotenv`, `pyspark.sql.SparkSession/DataFrame/functions`.

Ключевые функции:

- `_repo_root()`
  - Возвращает корень проекта.

- `_load_env()`
  - Подгружает `.env` через `python-dotenv`.

- `_required_env(name)`
  - Проверка обязательной переменной.

- `_required_any_env(*names)`
  - Берет первое непустое значение из списка env-переменных.
  - Используется для совместимости `MINIO_*` и `S3_*`.

- `_optional_env(name, default)`, `_optional_any_env(default, *names)`
  - Безопасное чтение опциональных env.

- `_build_spark_session()`
  - Создает SparkSession.
  - Включает JDBC package `com.clickhouse:clickhouse-jdbc:0.9.6`.

- `_jdbc_reader(spark)`
  - Готовит JDBC reader к ClickHouse MART.

- `_load_table(jdbc_reader, table)`
  - Читает таблицу через JDBC.

- `_build_features(customers_df, purchases_df)`
  - Основная бизнес-логика фичей:
  - `recurrent_buyer`
  - `delivery_user`
  - `bulk_buyer`
  - `low_cost_buyer`
  - `prefers_cash`
  - `prefers_card`
  - `weekend_shopper`
  - `weekday_shopper`
  - `night_shopper`
  - `morning_shopper`
  - Все признаки приводятся к `int` (0/1).

- `_write_single_csv(features_df)`
  - Записывает CSV во временную папку, находит `part-*.csv`.

- `_normalize_endpoint(endpoint)`
  - Добавляет `https://`, если в endpoint не указан протокол.

- `_upload_to_s3(local_csv_path)`
  - Загружает CSV в S3/MinIO.
  - Имя объекта: `analytic_result_YYYY_MM_DD.csv`.

- `main()`
  - Оркестрирует чтение MART -> расчет фич -> CSV -> upload -> cleanup.

Выход:

- CSV-файл в bucket S3/MinIO.

---

## 4.5 `src/probablyfresh/config.py`

Роль: единая точка конфигурации приложения через env-переменные.

Импорты:

- Стандартная библиотека: `os`, `dataclasses.dataclass`, `pathlib.Path`.
- Внешние: `dotenv.load_dotenv`.

Что внутри:

- `PROJECT_ROOT`
  - Вычисляет корень репозитория.

- `_env_int(name, default)`
  - Безопасно читает целочисленные env.

- `Settings`
  - Dataclass со всеми параметрами проекта (counts, Mongo/Kafka/ClickHouse/Grafana/FERNET).

- `get_settings()`
  - Возвращает заполненный `Settings`.

## 4.6 `src/probablyfresh/core/crypto_utils.py`

Роль: утилиты шифрования.

Импорты:

- Внешние: `cryptography.fernet.Fernet`.

Что внутри:

- `Encryptor`
  - Проверяет наличие `FERNET_KEY`.
  - `encrypt(value)` возвращает зашифрованную строку.

- `generate_key()`
  - Генерирует новый Fernet-ключ.

## 4.7 `src/probablyfresh/core/normalization.py`

Роль: нормализация PII-полей.

Импорты:

- Стандартная библиотека: `re`.

Что внутри:

- `normalize_email(value)`
  - `strip + lower`.

- `normalize_phone(value)`
  - Удаляет нецифровые символы, приводит локальные номера к международному формату.

## 4.8 `src/probablyfresh/core/data_generation.py`

Роль: генератор данных в модульном стиле (через `Settings`).

Импорты:

- Стандартная библиотека: `json`, `random`, `dataclass`, `datetime`, `pathlib.Path`, `typing.Any`, `uuid4`.
- Внешние: `faker.Faker`.
- Внутренние: `probablyfresh.config.Settings`.

Что внутри:

- `CATEGORIES`
  - Категории товарных групп.

- `GenerationResult`
  - Dataclass-результат генерации (stores/products/customers/purchases).

- `_ensure_dir(path)`, `_clear_json_files(path)`, `_write_json(path, payload)`
  - Файловые хелперы.

- `generate_data(settings)`
  - Генерирует stores/products/customers/purchases и возвращает `GenerationResult`.

## 4.9 `src/probablyfresh/integrations/mongo_loader.py`

Роль: загрузка локальных JSON в MongoDB (package-реализация).

Импорты:

- Стандартная библиотека: `json`, `pathlib.Path`, `typing.Any`.
- Внешние: `pymongo.MongoClient`.
- Внутренние: `probablyfresh.config.Settings`.

Что внутри:

- `ENTITY_TO_COLLECTION`
  - mapping директория -> коллекция.

- `_read_json_files(folder)`
  - Читает JSON документы.

- `load_to_mongodb(settings)`
  - Очищает коллекции и вставляет документы.
  - Возвращает counters по сущностям.

## 4.10 `src/probablyfresh/integrations/kafka_producer.py`

Роль: публикация событий в Kafka (package-реализация).

Импорты:

- Стандартная библиотека: `json`, `datetime`, `pathlib.Path`, `typing.Any`.
- Внешние: `kafka.KafkaProducer`.
- Внутренние:
  - `probablyfresh.config.Settings`
  - `probablyfresh.core.crypto_utils.Encryptor`
  - `probablyfresh.core.normalization.normalize_email/normalize_phone`

Что внутри:

- `ENTITY_TO_TOPIC`, `SENSITIVE_KEYS`
  - mapping сущностей на топики и список чувствительных ключей.

- `_load_json(path)`, `_object_id(entity_name, payload)`
  - Хелперы чтения и вычисления ключа сообщения.

- `_encrypt_sensitive_fields(value, encryptor)`
  - Рекурсивно шифрует `email` и `phone`.

- `publish_raw_events(settings)`
  - Публикует события по всем сущностям и возвращает counters.

## 4.11 `src/probablyfresh/integrations/clickhouse_client.py`

Роль: выполнение SQL-инициализаций ClickHouse из Python.

Импорты:

- Стандартная библиотека: `pathlib.Path`.
- Внешние: `clickhouse_driver.Client`.
- Внутренние: `probablyfresh.config.Settings`.

Что внутри:

- `_split_sql_statements(sql_text)`
  - Разбивает SQL-текст на отдельные statements.

- `run_init_sql(settings, sql_path)`
  - Подключается к ClickHouse и выполняет statements по порядку.

## 4.12 `src/probablyfresh/jobs/*.py` (entrypoints)

Роль: тонкие запускаемые скрипты поверх package-модулей.

- `src/probablyfresh/jobs/generate_data.py`
  - Загружает `Settings`, вызывает `generate_data`, печатает результат.

- `src/probablyfresh/jobs/load_nosql.py`
  - Загружает `Settings`, вызывает `load_to_mongodb`.

- `src/probablyfresh/jobs/run_producer.py`
  - Загружает `Settings`, вызывает `publish_raw_events`.

- `src/probablyfresh/jobs/init_clickhouse.py`
  - Загружает `Settings`, исполняет `infra/clickhouse/init.sql`.

- `src/probablyfresh/jobs/init_grafana.py`
  - Пингует `/api/health` Grafana с retry.

- `src/probablyfresh/jobs/__init__.py`
  - Маркерный файл пакета jobs.

## 4.13 `src/probablyfresh/__init__.py`, `core/__init__.py`, `integrations/__init__.py`

Роль:

- Маркируют директории как Python packages.
- Хранят краткую мета-информацию (`__version__`, docstring).

---

## 5. Что происходит в SQL-слое

## 5.1 RAW (`docker/clickhouse/init/01_init.sql`)

Создаются:

- `probablyfresh_raw.stores_raw`
- `probablyfresh_raw.products_raw`
- `probablyfresh_raw.customers_raw`
- `probablyfresh_raw.purchases_raw`

Плюс Kafka engine таблицы `*_kafka`, и Materialized Views, которые автоматически перекладывают события из Kafka в RAW.

Важно:

- `payload` хранится строкой JSON.
- Выделены join-ключи (`store_id`, `product_id`, `customer_id`, `purchase_id`) и техническое поле `ingested_at`.

## 5.2 MART (`docker/clickhouse/init/02_mart.sql`)

Создаются:

- `probablyfresh_mart.stores_mart`
- `probablyfresh_mart.products_mart`
- `probablyfresh_mart.customers_mart`
- `probablyfresh_mart.purchases_mart`
- `probablyfresh_mart.mart_quality_stats`

Ключевые принципы MART:

- Дедупликация через `ReplacingMergeTree(ingested_at)`.
- Очистка и нормализация в MV (trim/lower, валидация дат).
- Отбрасывание невалидных записей.
- Снимок качества данных:
  - `total_rows_raw`
  - `inserted_rows_mart`
  - `invalid_rows`
  - `duplicates_rows`
  - `duplicates_ratio`

---

## 6. Что делает Grafana

Provisioning создает автоматически:

- Datasource ClickHouse.
- Dashboard с метриками RAW/MART.
- Alerting:
  - Contact point (Telegram).
  - Notification policy.
  - Alert rule `Duplicates_ratio`.
  - Template сообщения.

Текущий алерт отслеживает `duplicates_ratio` по `purchases` и срабатывает при значении выше порога.

---

## 7. Docker и runbook: как это работает вместе

Базовый поток:

1. Поднять сервисы (`docker compose up -d ...`).
2. Выполнить `01_init.sql` (RAW).
3. Выполнить `02_mart.sql` (MART + quality snapshot).
4. Сгенерировать JSON.
5. Загрузить JSON в Mongo.
6. Запустить producer Mongo -> Kafka.
7. Проверить RAW/MART в ClickHouse и dashboard в Grafana.
8. Запустить ETL `make run-etl` для выгрузки признаков в S3/MinIO.

---

## 8. Как читать проект новичку (рекомендуемый порядок)

1. `README.md` — понять, как запускать и проверять.
2. `docker-compose.yml` — какие сервисы участвуют.
3. `Makefile` — какие есть команды.
4. `src/generator/generate_data.py` — откуда берутся данные.
5. `src/loader/load_to_mongo.py` — как данные попадают в Mongo.
6. `src/streaming/produce_from_mongo.py` — как работает Kafka и PII.
7. `docker/clickhouse/init/01_init.sql` — как устроен RAW.
8. `docker/clickhouse/init/02_mart.sql` — как устроен MART и DQ.
9. `jobs/features_etl.py` — как строятся признаки и выгружается CSV.
10. `grafana/provisioning/*` — как настроены мониторинг и алерты.

---

## 9. Типичные вопросы и ответы

Почему есть и `docker/*`, и `infra/*`?

- Исторически остались два набора конфигов.
- В текущем docker-run используют `docker/*` и `grafana/provisioning/*`.
- `infra/*` можно считать legacy/альтернативой.

Почему в Makefile есть и `features-etl`, и `run-etl`?

- `run-etl` — основной актуальный target.
- `features-etl` — alias для обратной совместимости.

Почему ETL может выгрузить пустой файл?

- Если MART пустой (`customers_mart`/`purchases_mart` не заполнены), Spark корректно выгрузит header и 0 строк.
- Нужно сначала прогнать producer и убедиться, что MART заполнен.

---

## 10. Куда развивать дальше

Практичные следующие шаги:

- Вынести повторный snapshot `mart_quality_stats` в отдельную SQL-команду.
- Сделать кастомный Docker image для `app` с предустановленными Python/Java пакетами.
- Добавить e2e smoke-тест: generate -> mongo -> kafka -> raw -> mart -> etl.
- Убрать дублирование `infra/*` vs `docker/*`, оставить один источник истины.
- Добавить контракт схемы событий (JSON Schema/Avro) и валидацию на входе.

---

## 11. Итог в одном абзаце

Этот проект — готовый учебный макет современной data-платформы: от генерации и ingestion до quality-контроля, аналитического слоя и мониторинга. Его можно использовать как основу для практики Data Engineering, демонстрации на собеседовании и дальнейшего наращивания до production-подхода.
