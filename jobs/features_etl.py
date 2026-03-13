from __future__ import annotations

"""
ETL витрины признаков клиентов для ProbablyFresh.

Важно про префикс "_" в именах функций:
- это внутренние helper-функции текущего модуля;
- они не предназначены как публичный API для внешнего импорта;
- точка входа скрипта — функция main().
"""

import logging
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import boto3
from dotenv import load_dotenv
from pyspark import StorageLevel
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
import os


def _repo_root() -> Path:
    """Возвращает путь к корню репозитория (родитель папки jobs/)."""
    return Path(__file__).resolve().parents[1]


def _load_env() -> None:
    """Загружает переменные окружения из .env в корне репозитория."""
    load_dotenv(_repo_root() / ".env")


def _required_env(name: str) -> str:
    """Читает обязательную переменную окружения.

    Args:
        name: имя переменной.
    Returns:
        Непустое строковое значение.
    """
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Environment variable {name} is required")
    return value


def _required_any_env(*names: str) -> str:
    """Возвращает первое непустое значение из списка переменных.

    Args:
        *names: имена переменных в порядке приоритета.
    Returns:
        Первое найденное непустое значение.
    """
    for name in names:
        value = os.getenv(name, "").strip()
        if value:
            return value
    raise RuntimeError(f"One of environment variables {', '.join(names)} is required")


def _optional_env(name: str, default: str) -> str:
    """Читает опциональную переменную окружения с fallback на default.

    Args:
        name: имя переменной.
        default: значение по умолчанию.
    Returns:
        Значение переменной или default.
    """
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip() or default


def _optional_any_env(default: str, *names: str) -> str:
    """Возвращает первое непустое значение или default.

    Args:
        default: значение по умолчанию.
        *names: имена переменных в порядке приоритета.
    Returns:
        Найденное значение или default.
    """
    for name in names:
        value = os.getenv(name)
        if value is not None and value.strip():
            return value.strip()
    return default


def _build_spark_session() -> SparkSession:
    """Создаёт и конфигурирует SparkSession для ETL.

    Returns:
        Готовый SparkSession с UTC timezone и JDBC-драйвером ClickHouse.
    """
    master = _optional_env("SPARK_MASTER", "local[*]")
    jdbc_jar = _optional_env("CLICKHOUSE_JDBC_JAR", "/opt/jars/clickhouse-jdbc-0.9.6-all-dependencies.jar")
    logging.info("Starting SparkSession with master=%s", master)

    builder = SparkSession.builder.appName("probablyfresh-features-etl").master(master)

    # Prefer local JDBC jar baked into the Docker image to avoid network downloads on each run.
    if Path(jdbc_jar).exists():
        logging.info("Using local ClickHouse JDBC jar: %s", jdbc_jar)
        builder = builder.config("spark.jars", jdbc_jar)
    else:
        logging.warning(
            "Local ClickHouse JDBC jar was not found at %s, falling back to Maven package resolution",
            jdbc_jar,
        )
        builder = builder.config("spark.jars.packages", "com.clickhouse:clickhouse-jdbc:0.9.6")

    spark = builder.config("spark.sql.session.timeZone", "UTC").getOrCreate()
    return spark


def _jdbc_reader(spark: SparkSession):
    """Готовит базовый JDBC reader для чтения таблиц из ClickHouse.

    Args:
        spark: активная SparkSession.
    Returns:
        DataFrameReader с предзаполненными JDBC-настройками.
    """
    ch_host = _required_env("CH_HOST")
    ch_port = _required_env("CH_PORT")
    ch_user = _required_env("CH_USER")
    ch_password = os.getenv("CH_PASSWORD", "")
    ch_db = _optional_env("CH_DATABASE", "probablyfresh_mart")

    jdbc_url = f"jdbc:clickhouse://{ch_host}:{ch_port}/{ch_db}"
    logging.info("Using ClickHouse JDBC URL: %s", jdbc_url)

    return (
        spark.read.format("jdbc")
        .option("url", jdbc_url)
        .option("driver", "com.clickhouse.jdbc.ClickHouseDriver")
        .option("user", ch_user)
        .option("password", ch_password)
    )


def _load_table(jdbc_reader, table: str) -> DataFrame:
    """Читает одну таблицу из ClickHouse через JDBC.

    Args:
        jdbc_reader: reader из _jdbc_reader().
        table: имя таблицы в выбранной БД.
    Returns:
        DataFrame с данными таблицы.
    """
    logging.info("Reading table via JDBC: %s", table)
    return jdbc_reader.option("dbtable", table).load()


def _build_features(
    customers_df: DataFrame,
    purchases_df: DataFrame,
    products_df: DataFrame,
    purchase_items_df: DataFrame,
) -> DataFrame:
    """Строит feature-матрицу клиентов (customer_id + 30 бинарных признаков).

    Args:
        customers_df: таблица клиентов MART.
        purchases_df: таблица покупок MART.
        products_df: таблица продуктов MART.
        purchase_items_df: таблица позиций чеков MART.
    Returns:
        DataFrame вида (customer_id, feature_1..feature_30), где все фичи 0/1.
    """
    feature_cols = [
        # Existing 10 features (kept as-is by name)
        "recurrent_buyer",
        "delivery_user",
        "bulk_buyer",
        "low_cost_buyer",
        "prefers_cash",
        "prefers_card",
        "weekend_shopper",
        "weekday_shopper",
        "night_shopper",
        "morning_shopper",
        # Additional 20 features (total = 30)
        "no_purchases",
        "has_purchases_last_7d",
        "has_purchases_last_14d",
        "has_purchases_last_30d",
        "has_purchases_last_90d",
        "frequent_shopper_last_14d",
        "high_ticket_last_90d",
        "delivery_last_30d",
        "cross_store_shopper_last_90d",
        "mixed_payment_user_last_90d",
        "bought_milk_last_7d",
        "bought_milk_last_30d",
        "bought_meat_last_7d",
        "bought_meat_last_30d",
        "bought_fruits_last_30d",
        "bought_vegetables_last_30d",
        "bought_bakery_last_30d",
        "bought_organic_last_90d",
        "high_quantity_buyer_last_30d",
        "vegetarian_profile",
    ]

    customers_base = (
        customers_df.select(F.lower(F.trim(F.col("customer_id"))).alias("customer_id"))
        .filter(F.col("customer_id").isNotNull() & (F.col("customer_id") != ""))
        .dropDuplicates(["customer_id"])
    )

    purchases_clean = (
        purchases_df.select(
            F.lower(F.trim(F.col("customer_id"))).alias("customer_id"),
            F.lower(F.trim(F.col("store_id"))).alias("store_id"),
            F.col("total_amount").cast("double").alias("total_amount"),
            F.lower(F.trim(F.col("payment_method"))).alias("payment_method"),
            F.col("is_delivery").cast("int").alias("is_delivery"),
            F.col("purchase_dt").cast("timestamp").alias("purchase_dt"),
        )
        .filter(F.col("customer_id").isNotNull() & (F.col("customer_id") != ""))
    )

    purchases_metrics = (
        purchases_clean.withColumn(
            "is_last_7d",
            F.when(F.col("purchase_dt") >= F.expr("current_timestamp() - INTERVAL 7 DAYS"), F.lit(1)).otherwise(
                F.lit(0)
            ),
        )
        .withColumn(
            "is_last_14d",
            F.when(F.col("purchase_dt") >= F.expr("current_timestamp() - INTERVAL 14 DAYS"), F.lit(1)).otherwise(
                F.lit(0)
            ),
        )
        .withColumn(
            "is_last_30d",
            F.when(F.col("purchase_dt") >= F.expr("current_timestamp() - INTERVAL 30 DAYS"), F.lit(1)).otherwise(
                F.lit(0)
            ),
        )
        .withColumn(
            "is_last_90d",
            F.when(F.col("purchase_dt") >= F.expr("current_timestamp() - INTERVAL 90 DAYS"), F.lit(1)).otherwise(
                F.lit(0)
            ),
        )
        .withColumn("cash_flag", F.when(F.col("payment_method") == "cash", F.lit(1)).otherwise(F.lit(0)))
        .withColumn("card_flag", F.when(F.col("payment_method") == "card", F.lit(1)).otherwise(F.lit(0)))
        .withColumn(
            "weekend_flag",
            F.when(F.dayofweek(F.col("purchase_dt")).isin(1, 7), F.lit(1)).otherwise(F.lit(0)),
        )
        .withColumn(
            "weekday_flag",
            F.when(F.dayofweek(F.col("purchase_dt")).between(2, 6), F.lit(1)).otherwise(F.lit(0)),
        )
        .withColumn("night_flag", F.when(F.hour(F.col("purchase_dt")) >= 20, F.lit(1)).otherwise(F.lit(0)))
        .withColumn("morning_flag", F.when(F.hour(F.col("purchase_dt")) < 10, F.lit(1)).otherwise(F.lit(0)))
    )

    purchases_agg = purchases_metrics.groupBy("customer_id").agg(
        F.count(F.lit(1)).alias("purchases_all_time"),
        F.sum("is_last_7d").alias("purchases_last_7d"),
        F.sum("is_last_14d").alias("purchases_last_14d"),
        F.sum("is_last_30d").alias("purchases_last_30d"),
        F.sum("is_last_90d").alias("purchases_last_90d"),
        F.avg("total_amount").alias("avg_total_amount"),
        F.avg("cash_flag").alias("cash_share"),
        F.avg("card_flag").alias("card_share"),
        F.avg("weekend_flag").alias("weekend_share"),
        F.avg("weekday_flag").alias("weekday_share"),
        F.avg("night_flag").alias("night_share"),
        F.avg("morning_flag").alias("morning_share"),
        F.max("is_delivery").alias("delivery_any"),
        F.max(
            F.when((F.col("is_last_30d") == 1) & (F.col("is_delivery") == 1), F.lit(1)).otherwise(F.lit(0))
        ).alias("delivery_any_30d"),
        F.max(F.when(F.col("is_last_90d") == 1, F.col("total_amount"))).alias("max_total_amount_90d"),
        F.countDistinct(F.when(F.col("is_last_90d") == 1, F.col("store_id"))).alias("distinct_stores_90d"),
        F.max(
            F.when((F.col("is_last_90d") == 1) & (F.col("payment_method") == "cash"), F.lit(1)).otherwise(F.lit(0))
        ).alias("used_cash_90d"),
        F.max(
            F.when((F.col("is_last_90d") == 1) & (F.col("payment_method") == "card"), F.lit(1)).otherwise(F.lit(0))
        ).alias("used_card_90d"),
    )

    product_group_expr = F.col("`group`") if "group" in products_df.columns else F.lit(None).cast("string")
    if "is_organic" in products_df.columns:
        organic_expr = F.col("is_organic").cast("int")
    elif "payload" in products_df.columns:
        organic_expr = F.when(F.lower(F.get_json_object(F.col("payload"), "$.is_organic")) == "true", F.lit(1)).otherwise(
            F.lit(0)
        )
    else:
        organic_expr = F.lit(0)

    products_clean = (
        products_df.select(
            F.lower(F.trim(F.col("product_id"))).alias("product_id"),
            F.lower(F.trim(product_group_expr)).alias("product_group"),
            organic_expr.alias("is_organic_int"),
        )
        .filter(F.col("product_id").isNotNull() & (F.col("product_id") != ""))
        .dropDuplicates(["product_id"])
    )

    item_category_expr = (
        F.col("category")
        if "category" in purchase_items_df.columns
        else (F.col("`group`") if "group" in purchase_items_df.columns else F.lit(None).cast("string"))
    )

    items_clean = (
        purchase_items_df.select(
            F.lower(F.trim(F.col("customer_id"))).alias("customer_id"),
            F.lower(F.trim(F.col("product_id"))).alias("product_id"),
            F.lower(F.trim(item_category_expr)).alias("category_raw"),
            F.col("quantity").cast("double").alias("quantity"),
            F.col("total_price").cast("double").alias("total_price"),
            F.col("purchase_dt").cast("timestamp").alias("purchase_dt"),
        )
        .filter(
            F.col("customer_id").isNotNull()
            & (F.col("customer_id") != "")
            & F.col("product_id").isNotNull()
            & (F.col("product_id") != "")
        )
    )

    items_enriched = (
        items_clean.join(products_clean, on="product_id", how="left")
        .withColumn(
            "category_norm",
            F.coalesce(
                F.when(F.length(F.col("category_raw")) > 0, F.col("category_raw")),
                F.col("product_group"),
            ),
        )
        .withColumn(
            "is_last_7d",
            F.when(F.col("purchase_dt") >= F.expr("current_timestamp() - INTERVAL 7 DAYS"), F.lit(1)).otherwise(
                F.lit(0)
            ),
        )
        .withColumn(
            "is_last_30d",
            F.when(F.col("purchase_dt") >= F.expr("current_timestamp() - INTERVAL 30 DAYS"), F.lit(1)).otherwise(
                F.lit(0)
            ),
        )
        .withColumn(
            "is_last_90d",
            F.when(F.col("purchase_dt") >= F.expr("current_timestamp() - INTERVAL 90 DAYS"), F.lit(1)).otherwise(
                F.lit(0)
            ),
        )
    )

    category_text = F.coalesce(F.col("category_norm"), F.lit(""))
    items_flags = (
        items_enriched.withColumn(
            "is_milk_item",
            F.when(category_text.rlike("молоч|dairy"), F.lit(1)).otherwise(F.lit(0)),
        )
        .withColumn(
            "is_meat_item",
            F.when(category_text.rlike("мяс|рыб|яйц|бобов|meat|fish|egg|bean|protein"), F.lit(1)).otherwise(F.lit(0)),
        )
        .withColumn(
            "is_fruits_item",
            F.when(category_text.rlike("фрукт|ягод|fruit|berry"), F.lit(1)).otherwise(F.lit(0)),
        )
        .withColumn(
            "is_vegetables_item",
            F.when(category_text.rlike("овощ|зел|vegetable|green"), F.lit(1)).otherwise(F.lit(0)),
        )
        .withColumn(
            "is_bakery_item",
            F.when(category_text.rlike("зернов|хлеб|grain|bakery|bread"), F.lit(1)).otherwise(F.lit(0)),
        )
    )

    items_agg = items_flags.groupBy("customer_id").agg(
        F.max(F.when((F.col("is_milk_item") == 1) & (F.col("is_last_7d") == 1), F.lit(1)).otherwise(F.lit(0))).alias(
            "bought_milk_last_7d"
        ),
        F.max(F.when((F.col("is_milk_item") == 1) & (F.col("is_last_30d") == 1), F.lit(1)).otherwise(F.lit(0))).alias(
            "bought_milk_last_30d"
        ),
        F.max(F.when((F.col("is_meat_item") == 1) & (F.col("is_last_7d") == 1), F.lit(1)).otherwise(F.lit(0))).alias(
            "bought_meat_last_7d"
        ),
        F.max(F.when((F.col("is_meat_item") == 1) & (F.col("is_last_30d") == 1), F.lit(1)).otherwise(F.lit(0))).alias(
            "bought_meat_last_30d"
        ),
        F.max(
            F.when((F.col("is_fruits_item") == 1) & (F.col("is_last_30d") == 1), F.lit(1)).otherwise(F.lit(0))
        ).alias("bought_fruits_last_30d"),
        F.max(
            F.when((F.col("is_vegetables_item") == 1) & (F.col("is_last_30d") == 1), F.lit(1)).otherwise(F.lit(0))
        ).alias("bought_vegetables_last_30d"),
        F.max(
            F.when((F.col("is_bakery_item") == 1) & (F.col("is_last_30d") == 1), F.lit(1)).otherwise(F.lit(0))
        ).alias("bought_bakery_last_30d"),
        F.max(
            F.when((F.col("is_organic_int") == 1) & (F.col("is_last_90d") == 1), F.lit(1)).otherwise(F.lit(0))
        ).alias("bought_organic_last_90d"),
        F.max(F.when((F.col("quantity") > 2) & (F.col("is_last_30d") == 1), F.lit(1)).otherwise(F.lit(0))).alias(
            "high_quantity_buyer_last_30d"
        ),
        F.max(F.when((F.col("is_meat_item") == 1) & (F.col("is_last_90d") == 1), F.lit(1)).otherwise(F.lit(0))).alias(
            "has_meat_last_90d"
        ),
        F.max(
            F.when(
                ((F.col("is_fruits_item") == 1) | (F.col("is_vegetables_item") == 1)) & (F.col("is_last_90d") == 1),
                F.lit(1),
            ).otherwise(F.lit(0))
        ).alias("has_plant_last_90d"),
    )

    joined = customers_base.join(purchases_agg, on="customer_id", how="left").join(items_agg, on="customer_id", how="left")

    result = joined.select(
        "customer_id",
        (F.coalesce(F.col("purchases_last_30d"), F.lit(0)) > 2).cast("int").alias("recurrent_buyer"),
        (F.coalesce(F.col("delivery_any"), F.lit(0)) > 0).cast("int").alias("delivery_user"),
        (
            (F.coalesce(F.col("avg_total_amount"), F.lit(0.0)) > 1000)
            & (F.coalesce(F.col("purchases_all_time"), F.lit(0)) > 0)
        ).cast("int").alias("bulk_buyer"),
        (
            (F.coalesce(F.col("avg_total_amount"), F.lit(0.0)) < 200)
            & (F.coalesce(F.col("purchases_all_time"), F.lit(0)) > 0)
        ).cast("int").alias("low_cost_buyer"),
        (
            (F.coalesce(F.col("cash_share"), F.lit(0.0)) >= 0.7)
            & (F.coalesce(F.col("purchases_all_time"), F.lit(0)) > 0)
        ).cast("int").alias("prefers_cash"),
        (
            (F.coalesce(F.col("card_share"), F.lit(0.0)) >= 0.7)
            & (F.coalesce(F.col("purchases_all_time"), F.lit(0)) > 0)
        ).cast("int").alias("prefers_card"),
        (
            (F.coalesce(F.col("weekend_share"), F.lit(0.0)) >= 0.6)
            & (F.coalesce(F.col("purchases_all_time"), F.lit(0)) > 0)
        ).cast("int").alias("weekend_shopper"),
        (
            (F.coalesce(F.col("weekday_share"), F.lit(0.0)) >= 0.6)
            & (F.coalesce(F.col("purchases_all_time"), F.lit(0)) > 0)
        ).cast("int").alias("weekday_shopper"),
        (
            (F.coalesce(F.col("night_share"), F.lit(0.0)) >= 0.5)
            & (F.coalesce(F.col("purchases_all_time"), F.lit(0)) > 0)
        ).cast("int").alias("night_shopper"),
        (
            (F.coalesce(F.col("morning_share"), F.lit(0.0)) >= 0.5)
            & (F.coalesce(F.col("purchases_all_time"), F.lit(0)) > 0)
        ).cast("int").alias("morning_shopper"),
        (F.coalesce(F.col("purchases_all_time"), F.lit(0)) == 0).cast("int").alias("no_purchases"),
        (F.coalesce(F.col("purchases_last_7d"), F.lit(0)) > 0).cast("int").alias("has_purchases_last_7d"),
        (F.coalesce(F.col("purchases_last_14d"), F.lit(0)) > 0).cast("int").alias("has_purchases_last_14d"),
        (F.coalesce(F.col("purchases_last_30d"), F.lit(0)) > 0).cast("int").alias("has_purchases_last_30d"),
        (F.coalesce(F.col("purchases_last_90d"), F.lit(0)) > 0).cast("int").alias("has_purchases_last_90d"),
        (F.coalesce(F.col("purchases_last_14d"), F.lit(0)) >= 3).cast("int").alias("frequent_shopper_last_14d"),
        (F.coalesce(F.col("max_total_amount_90d"), F.lit(0.0)) > 1500).cast("int").alias("high_ticket_last_90d"),
        (F.coalesce(F.col("delivery_any_30d"), F.lit(0)) > 0).cast("int").alias("delivery_last_30d"),
        (F.coalesce(F.col("distinct_stores_90d"), F.lit(0)) >= 2).cast("int").alias("cross_store_shopper_last_90d"),
        (
            (F.coalesce(F.col("used_cash_90d"), F.lit(0)) == 1)
            & (F.coalesce(F.col("used_card_90d"), F.lit(0)) == 1)
        ).cast("int").alias("mixed_payment_user_last_90d"),
        F.coalesce(F.col("bought_milk_last_7d"), F.lit(0)).cast("int").alias("bought_milk_last_7d"),
        F.coalesce(F.col("bought_milk_last_30d"), F.lit(0)).cast("int").alias("bought_milk_last_30d"),
        F.coalesce(F.col("bought_meat_last_7d"), F.lit(0)).cast("int").alias("bought_meat_last_7d"),
        F.coalesce(F.col("bought_meat_last_30d"), F.lit(0)).cast("int").alias("bought_meat_last_30d"),
        F.coalesce(F.col("bought_fruits_last_30d"), F.lit(0)).cast("int").alias("bought_fruits_last_30d"),
        F.coalesce(F.col("bought_vegetables_last_30d"), F.lit(0)).cast("int").alias("bought_vegetables_last_30d"),
        F.coalesce(F.col("bought_bakery_last_30d"), F.lit(0)).cast("int").alias("bought_bakery_last_30d"),
        F.coalesce(F.col("bought_organic_last_90d"), F.lit(0)).cast("int").alias("bought_organic_last_90d"),
        F.coalesce(F.col("high_quantity_buyer_last_30d"), F.lit(0)).cast("int").alias("high_quantity_buyer_last_30d"),
        (
            (F.coalesce(F.col("has_meat_last_90d"), F.lit(0)) == 0)
            & (F.coalesce(F.col("has_plant_last_90d"), F.lit(0)) == 1)
            & (F.coalesce(F.col("purchases_all_time"), F.lit(0)) > 0)
        ).cast("int").alias("vegetarian_profile"),
    )

    return result.select("customer_id", *feature_cols)


def _write_single_csv(features_df: DataFrame) -> Path:
    """Пишет витрину в один CSV-файл через coalesce(1).

    Args:
        features_df: итоговый DataFrame с признаками.
    Returns:
        Путь к сгенерированному part-*.csv.
    """
    tmp_dir = Path(tempfile.mkdtemp(prefix="probablyfresh_features_"))
    logging.info("Writing features CSV to temporary directory: %s", tmp_dir)

    features_df.coalesce(1).write.mode("overwrite").option("header", "true").csv(str(tmp_dir))

    part_files = sorted(tmp_dir.glob("part-*.csv"))
    if not part_files:
        raise RuntimeError(f"Spark output does not contain part-*.csv in {tmp_dir}")

    logging.info("Created CSV part file: %s", part_files[0])
    return part_files[0]


def _normalize_endpoint(endpoint: str) -> str:
    """Приводит endpoint к URL-формату с протоколом.

    Args:
        endpoint: адрес/домен из env.
    Returns:
        URL с http(s)-префиксом.
    """
    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        return endpoint
    return f"https://{endpoint}"


def _upload_to_s3(local_csv_path: Path) -> str:
    """Загружает локальный CSV в S3-совместимое хранилище.

    Args:
        local_csv_path: путь к CSV-файлу.
    Returns:
        object_key загруженного файла в bucket.
    """
    endpoint_url = _normalize_endpoint(_required_env("S3_ENDPOINT_URL"))
    region = _optional_any_env("ru-3", "S3_REGION", "AWS_DEFAULT_REGION")
    bucket = _required_env("S3_BUCKET")
    access_key = _required_any_env("S3_ACCESS_KEY", "AWS_ACCESS_KEY_ID")
    secret_key = _required_any_env("S3_SECRET_KEY", "AWS_SECRET_ACCESS_KEY")
    prefix = _optional_any_env("", "S3_OBJECT_PREFIX")

    object_name = f"analytic_result_{datetime.now(timezone.utc):%Y_%m_%d}.csv"
    object_key = f"{prefix.strip('/')}/{object_name}" if prefix.strip("/") else object_name

    logging.info("Uploading %s to s3://%s/%s", local_csv_path, bucket, object_key)

    client = boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
    )

    client.upload_file(str(local_csv_path), bucket, object_key)
    return object_key


def main() -> None:
    """Точка входа ETL: чтение MART -> расчёт фич -> CSV -> загрузка в S3."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    _load_env()

    spark = _build_spark_session()
    temp_csv_path: Path | None = None
    persisted_dfs: list[DataFrame] = []

    try:
        jdbc_reader = _jdbc_reader(spark)

        # Кэшируем входные DataFrame (MEMORY_AND_DISK): ниже есть count(),
        # а затем эти же данные повторно используются в _build_features().
        purchases_df = _load_table(jdbc_reader, "purchases_mart").persist(StorageLevel.MEMORY_AND_DISK)
        customers_df = _load_table(jdbc_reader, "customers_mart").persist(StorageLevel.MEMORY_AND_DISK)
        products_df = _load_table(jdbc_reader, "products_mart").persist(StorageLevel.MEMORY_AND_DISK)
        purchase_items_df = _load_table(jdbc_reader, "purchase_items_mart").persist(StorageLevel.MEMORY_AND_DISK)
        persisted_dfs.extend([purchases_df, customers_df, products_df, purchase_items_df])

        logging.info(
            "Loaded rows: purchases_mart=%s, customers_mart=%s, products_mart=%s, purchase_items_mart=%s",
            purchases_df.count(),
            customers_df.count(),
            products_df.count(),
            purchase_items_df.count(),
        )

        # Кэшируем итоговую витрину: дальше выполняются count(), write(),
        # а в debug-режиме также show() и filter().count().
        features_df = _build_features(customers_df, purchases_df, products_df, purchase_items_df).persist(
            StorageLevel.MEMORY_AND_DISK
        )
        persisted_dfs.append(features_df)
        logging.info("Feature columns count (with customer_id): %s", len(features_df.columns))
        logging.info("Feature rows to export: %s", features_df.count())

        if _optional_env("FEATURES_DEBUG", "0") == "1":
            features_df.printSchema()
            features_df.show(5, truncate=False)
            logging.info(
                "Customers with no_purchases=1: %s",
                features_df.filter(F.col("no_purchases") == 1).count(),
            )

        temp_csv_path = _write_single_csv(features_df)
        object_key = _upload_to_s3(temp_csv_path)

        logging.info("Upload completed successfully: %s", object_key)
        print(f"Uploaded features file: {object_key}")
    finally:
        # Явно освобождаем кэш перед остановкой Spark.
        for df in reversed(persisted_dfs):
            try:
                df.unpersist(blocking=False)
            except Exception as exc:
                logging.warning("Failed to unpersist DataFrame: %s", exc)
        spark.stop()
        if temp_csv_path is not None:
            shutil.rmtree(temp_csv_path.parent, ignore_errors=True)
            logging.info("Removed temporary directory: %s", temp_csv_path.parent)


if __name__ == "__main__":
    main()
