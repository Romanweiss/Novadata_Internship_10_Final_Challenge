CREATE DATABASE IF NOT EXISTS probablyfresh_raw;

CREATE TABLE IF NOT EXISTS probablyfresh_raw.stores_raw
(
    object_id String,
    payload String,
    event_ts DateTime64(3),
    ingested_at DateTime DEFAULT now()
)
ENGINE = MergeTree
ORDER BY (object_id, event_ts);

CREATE TABLE IF NOT EXISTS probablyfresh_raw.products_raw
(
    object_id String,
    payload String,
    event_ts DateTime64(3),
    ingested_at DateTime DEFAULT now()
)
ENGINE = MergeTree
ORDER BY (object_id, event_ts);

CREATE TABLE IF NOT EXISTS probablyfresh_raw.customers_raw
(
    object_id String,
    payload String,
    event_ts DateTime64(3),
    ingested_at DateTime DEFAULT now()
)
ENGINE = MergeTree
ORDER BY (object_id, event_ts);

CREATE TABLE IF NOT EXISTS probablyfresh_raw.purchases_raw
(
    object_id String,
    payload String,
    event_ts DateTime64(3),
    ingested_at DateTime DEFAULT now()
)
ENGINE = MergeTree
ORDER BY (object_id, event_ts);

CREATE TABLE IF NOT EXISTS probablyfresh_raw.stores_kafka
(
    source String,
    object_id String,
    payload String,
    event_ts String
)
ENGINE = Kafka
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'stores_raw',
    kafka_group_name = 'stores_raw_consumer_group',
    kafka_format = 'JSONEachRow',
    kafka_num_consumers = 1,
    kafka_max_block_size = 1000;

CREATE TABLE IF NOT EXISTS probablyfresh_raw.products_kafka
(
    source String,
    object_id String,
    payload String,
    event_ts String
)
ENGINE = Kafka
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'products_raw',
    kafka_group_name = 'products_raw_consumer_group',
    kafka_format = 'JSONEachRow',
    kafka_num_consumers = 1,
    kafka_max_block_size = 1000;

CREATE TABLE IF NOT EXISTS probablyfresh_raw.customers_kafka
(
    source String,
    object_id String,
    payload String,
    event_ts String
)
ENGINE = Kafka
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'customers_raw',
    kafka_group_name = 'customers_raw_consumer_group',
    kafka_format = 'JSONEachRow',
    kafka_num_consumers = 1,
    kafka_max_block_size = 1000;

CREATE TABLE IF NOT EXISTS probablyfresh_raw.purchases_kafka
(
    source String,
    object_id String,
    payload String,
    event_ts String
)
ENGINE = Kafka
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'purchases_raw',
    kafka_group_name = 'purchases_raw_consumer_group',
    kafka_format = 'JSONEachRow',
    kafka_num_consumers = 1,
    kafka_max_block_size = 1000;

CREATE MATERIALIZED VIEW IF NOT EXISTS probablyfresh_raw.mv_stores_raw
TO probablyfresh_raw.stores_raw
AS
SELECT
    object_id,
    payload,
    coalesce(parseDateTime64BestEffortOrNull(event_ts), now64(3)) AS event_ts,
    now() AS ingested_at
FROM probablyfresh_raw.stores_kafka;

CREATE MATERIALIZED VIEW IF NOT EXISTS probablyfresh_raw.mv_products_raw
TO probablyfresh_raw.products_raw
AS
SELECT
    object_id,
    payload,
    coalesce(parseDateTime64BestEffortOrNull(event_ts), now64(3)) AS event_ts,
    now() AS ingested_at
FROM probablyfresh_raw.products_kafka;

CREATE MATERIALIZED VIEW IF NOT EXISTS probablyfresh_raw.mv_customers_raw
TO probablyfresh_raw.customers_raw
AS
SELECT
    object_id,
    payload,
    coalesce(parseDateTime64BestEffortOrNull(event_ts), now64(3)) AS event_ts,
    now() AS ingested_at
FROM probablyfresh_raw.customers_kafka;

CREATE MATERIALIZED VIEW IF NOT EXISTS probablyfresh_raw.mv_purchases_raw
TO probablyfresh_raw.purchases_raw
AS
SELECT
    object_id,
    payload,
    coalesce(parseDateTime64BestEffortOrNull(event_ts), now64(3)) AS event_ts,
    now() AS ingested_at
FROM probablyfresh_raw.purchases_kafka;
