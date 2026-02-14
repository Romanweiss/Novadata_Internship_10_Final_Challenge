CREATE DATABASE IF NOT EXISTS probablyfresh_mart;

CREATE TABLE IF NOT EXISTS probablyfresh_mart.stores_mart
(
    store_id String,
    store_network String,
    store_name String,
    city String,
    payload String,
    ingested_at DateTime
)
ENGINE = ReplacingMergeTree(ingested_at)
ORDER BY store_id;

CREATE TABLE IF NOT EXISTS probablyfresh_mart.products_mart
(
    product_id String,
    `group` String,
    name String,
    price Float64,
    unit String,
    payload String,
    ingested_at DateTime
)
ENGINE = ReplacingMergeTree(ingested_at)
ORDER BY product_id;

CREATE TABLE IF NOT EXISTS probablyfresh_mart.customers_mart
(
    customer_id String,
    store_id String,
    email_enc String,
    phone_enc String,
    birth_date Nullable(Date),
    registration_dt Nullable(DateTime),
    payload String,
    ingested_at DateTime
)
ENGINE = ReplacingMergeTree(ingested_at)
ORDER BY customer_id;

CREATE TABLE IF NOT EXISTS probablyfresh_mart.purchases_mart
(
    purchase_id String,
    customer_id String,
    store_id String,
    total_amount Float64,
    payment_method String,
    is_delivery UInt8,
    purchase_dt Nullable(DateTime),
    payload String,
    ingested_at DateTime
)
ENGINE = ReplacingMergeTree(ingested_at)
ORDER BY purchase_id;

CREATE TABLE IF NOT EXISTS probablyfresh_mart.mart_quality_stats
(
    event_time DateTime,
    entity String,
    total_rows_raw UInt64,
    inserted_rows_mart UInt64,
    invalid_rows UInt64,
    duplicates_rows UInt64,
    duplicates_ratio Float64
)
ENGINE = MergeTree
ORDER BY (entity, event_time);

CREATE MATERIALIZED VIEW IF NOT EXISTS probablyfresh_mart.mv_stores_to_mart
TO probablyfresh_mart.stores_mart
AS
WITH
    lowerUTF8(trimBoth(JSONExtractString(payload, 'store_id'))) AS store_id_norm,
    lowerUTF8(trimBoth(JSONExtractString(payload, 'store_network'))) AS store_network_norm,
    lowerUTF8(trimBoth(JSONExtractString(payload, 'store_name'))) AS store_name_norm,
    lowerUTF8(trimBoth(JSONExtractString(payload, 'location', 'city'))) AS city_norm
SELECT
    store_id_norm AS store_id,
    store_network_norm AS store_network,
    store_name_norm AS store_name,
    city_norm AS city,
    payload,
    ingested_at
FROM probablyfresh_raw.stores_raw
WHERE store_id_norm != '';

CREATE MATERIALIZED VIEW IF NOT EXISTS probablyfresh_mart.mv_products_to_mart
TO probablyfresh_mart.products_mart
AS
WITH
    lowerUTF8(trimBoth(JSONExtractString(payload, 'id'))) AS product_id_norm,
    lowerUTF8(trimBoth(JSONExtractString(payload, 'group'))) AS group_norm,
    lowerUTF8(trimBoth(JSONExtractString(payload, 'name'))) AS name_norm,
    JSONExtractFloat(payload, 'price') AS price_value,
    lowerUTF8(trimBoth(JSONExtractString(payload, 'unit'))) AS unit_norm
SELECT
    product_id_norm AS product_id,
    group_norm AS `group`,
    name_norm AS name,
    price_value AS price,
    unit_norm AS unit,
    payload,
    ingested_at
FROM probablyfresh_raw.products_raw
WHERE product_id_norm != '';

CREATE MATERIALIZED VIEW IF NOT EXISTS probablyfresh_mart.mv_customers_to_mart
TO probablyfresh_mart.customers_mart
AS
WITH
    lowerUTF8(trimBoth(JSONExtractString(payload, 'customer_id'))) AS customer_id_norm,
    lowerUTF8(trimBoth(JSONExtractString(payload, 'purchase_location', 'store_id'))) AS store_id_norm,
    trimBoth(JSONExtractString(payload, 'email')) AS email_enc_norm,
    trimBoth(JSONExtractString(payload, 'phone')) AS phone_enc_norm,
    toDateOrNull(trimBoth(JSONExtractString(payload, 'birth_date'))) AS birth_date_parsed,
    trimBoth(JSONExtractString(payload, 'registration_date')) AS registration_raw,
    parseDateTimeBestEffortOrNull(registration_raw) AS registration_dt_parsed
SELECT
    customer_id_norm AS customer_id,
    store_id_norm AS store_id,
    email_enc_norm AS email_enc,
    phone_enc_norm AS phone_enc,
    birth_date_parsed AS birth_date,
    registration_dt_parsed AS registration_dt,
    payload,
    ingested_at
FROM probablyfresh_raw.customers_raw
WHERE
    customer_id_norm != ''
    AND birth_date_parsed IS NOT NULL
    AND birth_date_parsed <= today()
    AND (registration_raw = '' OR registration_dt_parsed IS NOT NULL);

CREATE MATERIALIZED VIEW IF NOT EXISTS probablyfresh_mart.mv_purchases_to_mart
TO probablyfresh_mart.purchases_mart
AS
WITH
    lowerUTF8(trimBoth(JSONExtractString(payload, 'purchase_id'))) AS purchase_id_norm,
    lowerUTF8(trimBoth(JSONExtractString(payload, 'customer', 'customer_id'))) AS customer_id_norm,
    lowerUTF8(trimBoth(JSONExtractString(payload, 'store', 'store_id'))) AS store_id_norm,
    JSONExtractFloat(payload, 'total_amount') AS total_amount_value,
    lowerUTF8(trimBoth(JSONExtractString(payload, 'payment_method'))) AS payment_method_norm,
    toUInt8(JSONExtractBool(payload, 'is_delivery')) AS is_delivery_value,
    parseDateTimeBestEffortOrNull(trimBoth(JSONExtractString(payload, 'purchase_datetime'))) AS purchase_dt_parsed
SELECT
    purchase_id_norm AS purchase_id,
    customer_id_norm AS customer_id,
    store_id_norm AS store_id,
    total_amount_value AS total_amount,
    payment_method_norm AS payment_method,
    is_delivery_value AS is_delivery,
    purchase_dt_parsed AS purchase_dt,
    payload,
    ingested_at
FROM probablyfresh_raw.purchases_raw
WHERE
    purchase_id_norm != ''
    AND customer_id_norm != ''
    AND store_id_norm != ''
    AND purchase_dt_parsed IS NOT NULL
    AND purchase_dt_parsed <= now();

INSERT INTO probablyfresh_mart.mart_quality_stats
SELECT
    now() AS event_time,
    'stores' AS entity,
    total_rows_raw,
    inserted_rows_mart,
    total_rows_raw - inserted_rows_mart AS invalid_rows,
    duplicates_rows,
    if(total_rows_raw = 0, 0.0, duplicates_rows / total_rows_raw) AS duplicates_ratio
FROM
(
    SELECT
        count() AS total_rows_raw,
        countIf(store_id_norm != '') AS inserted_rows_mart,
        count() - countDistinct(store_id_norm) AS duplicates_rows
    FROM
    (
        SELECT lowerUTF8(trimBoth(JSONExtractString(payload, 'store_id'))) AS store_id_norm
        FROM probablyfresh_raw.stores_raw
    )
);

INSERT INTO probablyfresh_mart.mart_quality_stats
SELECT
    now() AS event_time,
    'products' AS entity,
    total_rows_raw,
    inserted_rows_mart,
    total_rows_raw - inserted_rows_mart AS invalid_rows,
    duplicates_rows,
    if(total_rows_raw = 0, 0.0, duplicates_rows / total_rows_raw) AS duplicates_ratio
FROM
(
    SELECT
        count() AS total_rows_raw,
        countIf(product_id_norm != '') AS inserted_rows_mart,
        count() - countDistinct(product_id_norm) AS duplicates_rows
    FROM
    (
        SELECT lowerUTF8(trimBoth(JSONExtractString(payload, 'id'))) AS product_id_norm
        FROM probablyfresh_raw.products_raw
    )
);

INSERT INTO probablyfresh_mart.mart_quality_stats
SELECT
    now() AS event_time,
    'customers' AS entity,
    total_rows_raw,
    inserted_rows_mart,
    total_rows_raw - inserted_rows_mart AS invalid_rows,
    duplicates_rows,
    if(total_rows_raw = 0, 0.0, duplicates_rows / total_rows_raw) AS duplicates_ratio
FROM
(
    SELECT
        count() AS total_rows_raw,
        countIf(
            customer_id_norm != ''
            AND birth_date_parsed IS NOT NULL
            AND birth_date_parsed <= today()
            AND (registration_raw = '' OR registration_dt_parsed IS NOT NULL)
        ) AS inserted_rows_mart,
        count() - countDistinct(customer_id_norm) AS duplicates_rows
    FROM
    (
        SELECT
            lowerUTF8(trimBoth(JSONExtractString(payload, 'customer_id'))) AS customer_id_norm,
            toDateOrNull(trimBoth(JSONExtractString(payload, 'birth_date'))) AS birth_date_parsed,
            trimBoth(JSONExtractString(payload, 'registration_date')) AS registration_raw,
            parseDateTimeBestEffortOrNull(registration_raw) AS registration_dt_parsed
        FROM probablyfresh_raw.customers_raw
    )
);

INSERT INTO probablyfresh_mart.mart_quality_stats
SELECT
    now() AS event_time,
    'purchases' AS entity,
    total_rows_raw,
    inserted_rows_mart,
    total_rows_raw - inserted_rows_mart AS invalid_rows,
    duplicates_rows,
    if(total_rows_raw = 0, 0.0, duplicates_rows / total_rows_raw) AS duplicates_ratio
FROM
(
    SELECT
        count() AS total_rows_raw,
        countIf(
            purchase_id_norm != ''
            AND customer_id_norm != ''
            AND store_id_norm != ''
            AND purchase_dt_parsed IS NOT NULL
            AND purchase_dt_parsed <= now()
        ) AS inserted_rows_mart,
        count() - countDistinct(purchase_id_norm) AS duplicates_rows
    FROM
    (
        SELECT
            lowerUTF8(trimBoth(JSONExtractString(payload, 'purchase_id'))) AS purchase_id_norm,
            lowerUTF8(trimBoth(JSONExtractString(payload, 'customer', 'customer_id'))) AS customer_id_norm,
            lowerUTF8(trimBoth(JSONExtractString(payload, 'store', 'store_id'))) AS store_id_norm,
            parseDateTimeBestEffortOrNull(trimBoth(JSONExtractString(payload, 'purchase_datetime'))) AS purchase_dt_parsed
        FROM probablyfresh_raw.purchases_raw
    )
);
