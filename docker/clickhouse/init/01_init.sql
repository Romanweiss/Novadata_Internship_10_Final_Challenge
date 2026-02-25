CREATE DATABASE IF NOT EXISTS probablyfresh_raw;

CREATE TABLE IF NOT EXISTS probablyfresh_raw.stores_raw
(
    store_id String,
    store_network String,
    payload String,
    ingested_at DateTime
)
ENGINE = MergeTree
ORDER BY (store_id, ingested_at);

CREATE TABLE IF NOT EXISTS probablyfresh_raw.products_raw
(
    product_id String,
    `group` String,
    payload String,
    ingested_at DateTime
)
ENGINE = MergeTree
ORDER BY (product_id, ingested_at);

CREATE TABLE IF NOT EXISTS probablyfresh_raw.customers_raw
(
    customer_id String,
    store_id String,
    email_enc String,
    phone_enc String,
    payload String,
    ingested_at DateTime
)
ENGINE = MergeTree
ORDER BY (customer_id, ingested_at);

CREATE TABLE IF NOT EXISTS probablyfresh_raw.purchases_raw
(
    purchase_id String,
    customer_id String,
    store_id String,
    total_amount String,
    purchase_datetime String,
    payload String,
    ingested_at DateTime
)
ENGINE = MergeTree
ORDER BY (purchase_id, ingested_at);

CREATE TABLE IF NOT EXISTS probablyfresh_raw.purchase_items_raw
(
    purchase_id String,
    customer_id String,
    store_id String,
    product_id String,
    category String,
    quantity Float64,
    price_per_unit Float64,
    total_price Float64,
    purchase_dt Nullable(DateTime),
    payload String,
    ingested_at DateTime
)
ENGINE = ReplacingMergeTree(ingested_at)
ORDER BY (purchase_id, product_id, ingested_at);

CREATE TABLE IF NOT EXISTS probablyfresh_raw.stores_kafka
(
    payload String
)
ENGINE = Kafka
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'probablyfresh.stores',
    kafka_group_name = 'probablyfresh_stores_consumer',
    kafka_format = 'RawBLOB',
    kafka_num_consumers = 1;

CREATE TABLE IF NOT EXISTS probablyfresh_raw.products_kafka
(
    payload String
)
ENGINE = Kafka
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'probablyfresh.products',
    kafka_group_name = 'probablyfresh_products_consumer',
    kafka_format = 'RawBLOB',
    kafka_num_consumers = 1;

CREATE TABLE IF NOT EXISTS probablyfresh_raw.customers_kafka
(
    payload String
)
ENGINE = Kafka
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'probablyfresh.customers',
    kafka_group_name = 'probablyfresh_customers_consumer',
    kafka_format = 'RawBLOB',
    kafka_num_consumers = 1;

CREATE TABLE IF NOT EXISTS probablyfresh_raw.purchases_kafka
(
    payload String
)
ENGINE = Kafka
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'probablyfresh.purchases',
    kafka_group_name = 'probablyfresh_purchases_consumer',
    kafka_format = 'RawBLOB',
    kafka_num_consumers = 1;

CREATE MATERIALIZED VIEW IF NOT EXISTS probablyfresh_raw.mv_stores_raw
TO probablyfresh_raw.stores_raw
AS
SELECT
    JSONExtractString(payload, 'store_id') AS store_id,
    JSONExtractString(payload, 'store_network') AS store_network,
    payload,
    now() AS ingested_at
FROM probablyfresh_raw.stores_kafka;

CREATE MATERIALIZED VIEW IF NOT EXISTS probablyfresh_raw.mv_products_raw
TO probablyfresh_raw.products_raw
AS
SELECT
    JSONExtractString(payload, 'id') AS product_id,
    JSONExtractString(payload, 'group') AS `group`,
    payload,
    now() AS ingested_at
FROM probablyfresh_raw.products_kafka;

CREATE MATERIALIZED VIEW IF NOT EXISTS probablyfresh_raw.mv_customers_raw
TO probablyfresh_raw.customers_raw
AS
SELECT
    JSONExtractString(payload, 'customer_id') AS customer_id,
    JSONExtractString(payload, 'purchase_location', 'store_id') AS store_id,
    JSONExtractString(payload, 'email') AS email_enc,
    JSONExtractString(payload, 'phone') AS phone_enc,
    payload,
    now() AS ingested_at
FROM probablyfresh_raw.customers_kafka;

CREATE MATERIALIZED VIEW IF NOT EXISTS probablyfresh_raw.mv_purchases_raw
TO probablyfresh_raw.purchases_raw
AS
SELECT
    JSONExtractString(payload, 'purchase_id') AS purchase_id,
    JSONExtractString(payload, 'customer', 'customer_id') AS customer_id,
    JSONExtractString(payload, 'store', 'store_id') AS store_id,
    JSONExtractRaw(payload, 'total_amount') AS total_amount,
    JSONExtractString(payload, 'purchase_datetime') AS purchase_datetime,
    payload,
    now() AS ingested_at
FROM probablyfresh_raw.purchases_kafka;

CREATE MATERIALIZED VIEW IF NOT EXISTS probablyfresh_raw.mv_purchase_items_from_purchases_raw
TO probablyfresh_raw.purchase_items_raw
AS
SELECT
    purchase_id,
    customer_id,
    store_id,
    product_id,
    category,
    quantity,
    price_per_unit,
    total_price,
    purchase_dt,
    item_payload AS payload,
    ingested_at
FROM
(
    SELECT
        lowerUTF8(trimBoth(purchase_id)) AS purchase_id,
        lowerUTF8(trimBoth(customer_id)) AS customer_id,
        lowerUTF8(trimBoth(store_id)) AS store_id,
        lowerUTF8(trimBoth(JSONExtractString(item_payload, 'product_id'))) AS product_id,
        lowerUTF8(trimBoth(JSONExtractString(item_payload, 'category'))) AS category,
        JSONExtractFloat(item_payload, 'quantity') AS quantity,
        JSONExtractFloat(item_payload, 'price_per_unit') AS price_per_unit,
        JSONExtractFloat(item_payload, 'total_price') AS total_price,
        parseDateTimeBestEffortOrNull(purchase_datetime) AS purchase_dt,
        item_payload,
        ingested_at
    FROM probablyfresh_raw.purchases_raw
    ARRAY JOIN JSONExtractArrayRaw(payload, 'items') AS item_payload
)
WHERE
    purchase_id != ''
    AND product_id != '';
