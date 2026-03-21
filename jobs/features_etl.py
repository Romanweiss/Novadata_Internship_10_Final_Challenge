from __future__ import annotations

"""
ETL витрины признаков клиентов для ProbablyFresh.

Важно про префикс "_" в именах функций:
- это внутренние helper-функции текущего модуля;
- они не предназначены как публичный API для внешнего импорта;
- точка входа скрипта — функция main().
"""

import logging
import os
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import boto3
from dotenv import load_dotenv
from pyspark import StorageLevel
from pyspark.sql import Column, DataFrame, SparkSession
from pyspark.sql import functions as F


# Business thresholds for binary features. Values are kept unchanged to preserve
# current ETL behavior; the names make their meaning explicit.
PAYMENT_PREFERENCE_MIN_SHARE = 0.7
DAY_OF_WEEK_SHOPPER_MIN_SHARE = 0.6
TIME_OF_DAY_SHOPPER_MIN_SHARE = 0.5
RECURRENT_BUYER_MIN_PURCHASES_30D = 2
FREQUENT_SHOPPER_MIN_PURCHASES_14D = 3
BULK_BUYER_MIN_AVG_TOTAL_AMOUNT = 1000.0
LOW_COST_BUYER_MAX_AVG_TOTAL_AMOUNT = 200.0
HIGH_TICKET_MIN_TOTAL_AMOUNT_90D = 1500.0
HIGH_QUANTITY_MIN_ITEMS_30D = 2.0
CROSS_STORE_MIN_DISTINCT_STORES_90D = 2
NIGHT_SHOPPER_START_HOUR = 20
MORNING_SHOPPER_END_HOUR = 10

# Reused rolling windows in days.
PURCHASE_ACTIVITY_WINDOWS = (7, 14, 30, 90)
ITEM_ACTIVITY_WINDOWS = (7, 30, 90)

# Category matching rules are intentionally broad because source categories are
# heterogeneous and can arrive in both Russian and English.
MILK_CATEGORY_PATTERN = "молоч|dairy"
MEAT_CATEGORY_PATTERN = "мяс|рыб|яйц|бобов|meat|fish|egg|bean|protein"
FRUITS_CATEGORY_PATTERN = "фрукт|ягод|fruit|berry"
VEGETABLES_CATEGORY_PATTERN = "овощ|зел|vegetable|green"
BAKERY_CATEGORY_PATTERN = "зернов|хлеб|grain|bakery|bread"

FEATURE_COLUMNS = [
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


def _parquet_export_enabled() -> bool:
    """Возвращает True только при явном включении parquet-экспорта."""
    value = _optional_env("FEATURES_EXPORT_PARQUET", "0").lower()
    return value in {"1", "true", "yes", "on"}


def _parquet_export_warning_message() -> str:
    """Возвращает предупреждение для медленного optional parquet-экспорта."""
    return "WARNING: Parquet export is enabled. This may significantly slow down ETL execution."


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


def _int_flag(condition: Column) -> Column:
    """Преобразует булево условие в бинарный флаг 0/1."""
    return F.when(condition, F.lit(1)).otherwise(F.lit(0))


def _binary_feature(condition: Column, alias: str) -> Column:
    """Оформляет условие как итоговый бинарный признак с заданным alias."""
    return condition.cast("int").alias(alias)


def _coalesced_int(column_name: str) -> Column:
    """Возвращает числовую колонку с безопасной подстановкой 0 для NULL."""
    return F.coalesce(F.col(column_name), F.lit(0))


def _coalesced_double(column_name: str) -> Column:
    """Возвращает вещественную колонку с безопасной подстановкой 0.0 для NULL."""
    return F.coalesce(F.col(column_name), F.lit(0.0))


def _binary_metric(column_name: str) -> Column:
    """Переиспользует уже рассчитанный бинарный признак и нормализует NULL -> 0."""
    return _coalesced_int(column_name).cast("int").alias(column_name)


def _recent_flag(timestamp_col: str, days: int) -> Column:
    """Строит бинарный флаг попадания timestamp в окно последних N дней."""
    return _int_flag(F.col(timestamp_col) >= F.expr(f"current_timestamp() - INTERVAL {days} DAYS"))


def _add_recent_flags(df: DataFrame, timestamp_col: str, windows: tuple[int, ...]) -> DataFrame:
    """Добавляет набор колонок вида is_last_{N}d для указанного timestamp."""
    result = df
    for days in windows:
        result = result.withColumn(f"is_last_{days}d", _recent_flag(timestamp_col, days))
    return result


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
    # customers_base задает якорный набор клиентов. Благодаря этому в итоговую
    # витрину попадут и клиенты без покупок, которым затем проставятся нули.
    customers_base = (
        customers_df.select(F.lower(F.trim(F.col("customer_id"))).alias("customer_id"))
        .filter(F.col("customer_id").isNotNull() & (F.col("customer_id") != ""))
        .dropDuplicates(["customer_id"])
    )

    # Нормализуем ключевые поля покупок и приводим типы к тем, с которыми далее
    # безопасно считать окна, доли оплат и денежные агрегаты.
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

    # На уровне отдельных покупок добавляем временные окна и бинарные флаги,
    # из которых затем считаются customer-level shares и поведенческие признаки.
    purchases_metrics = (
        _add_recent_flags(purchases_clean, "purchase_dt", PURCHASE_ACTIVITY_WINDOWS)
        .withColumn("cash_flag", _int_flag(F.col("payment_method") == "cash"))
        .withColumn("card_flag", _int_flag(F.col("payment_method") == "card"))
        .withColumn(
            "weekend_flag",
            _int_flag(F.dayofweek(F.col("purchase_dt")).isin(1, 7)),
        )
        .withColumn(
            "weekday_flag",
            _int_flag(F.dayofweek(F.col("purchase_dt")).between(2, 6)),
        )
        .withColumn("night_flag", _int_flag(F.hour(F.col("purchase_dt")) >= NIGHT_SHOPPER_START_HOUR))
        .withColumn("morning_flag", _int_flag(F.hour(F.col("purchase_dt")) < MORNING_SHOPPER_END_HOUR))
    )

    # shares вроде cash_share/card_share показывают долю покупок с данным
    # свойством. Именно они потом сравниваются с бизнес-порогами 0.7/0.6/0.5.
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
        F.max(_int_flag((F.col("is_last_30d") == 1) & (F.col("is_delivery") == 1))).alias("delivery_any_30d"),
        F.max(F.when(F.col("is_last_90d") == 1, F.col("total_amount"))).alias("max_total_amount_90d"),
        F.countDistinct(F.when(F.col("is_last_90d") == 1, F.col("store_id"))).alias("distinct_stores_90d"),
        F.max(_int_flag((F.col("is_last_90d") == 1) & (F.col("payment_method") == "cash"))).alias("used_cash_90d"),
        F.max(_int_flag((F.col("is_last_90d") == 1) & (F.col("payment_method") == "card"))).alias("used_card_90d"),
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

    # Если category у позиции чека пустая, используем product_group из каталога
    # продуктов как fallback для дальнейшей классификации.
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
    )
    items_enriched = _add_recent_flags(items_enriched, "purchase_dt", ITEM_ACTIVITY_WINDOWS)

    # Regex-правила нарочно широкие: категории могут приходить в RU/EN и не быть
    # строго стандартизированными, поэтому здесь используются устойчивые маски.
    category_text = F.coalesce(F.col("category_norm"), F.lit(""))
    items_flags = (
        items_enriched.withColumn(
            "is_milk_item",
            _int_flag(category_text.rlike(MILK_CATEGORY_PATTERN)),
        )
        .withColumn(
            "is_meat_item",
            _int_flag(category_text.rlike(MEAT_CATEGORY_PATTERN)),
        )
        .withColumn(
            "is_fruits_item",
            _int_flag(category_text.rlike(FRUITS_CATEGORY_PATTERN)),
        )
        .withColumn(
            "is_vegetables_item",
            _int_flag(category_text.rlike(VEGETABLES_CATEGORY_PATTERN)),
        )
        .withColumn(
            "is_bakery_item",
            _int_flag(category_text.rlike(BAKERY_CATEGORY_PATTERN)),
        )
    )

    items_agg = items_flags.groupBy("customer_id").agg(
        F.max(_int_flag((F.col("is_milk_item") == 1) & (F.col("is_last_7d") == 1))).alias(
            "bought_milk_last_7d"
        ),
        F.max(_int_flag((F.col("is_milk_item") == 1) & (F.col("is_last_30d") == 1))).alias(
            "bought_milk_last_30d"
        ),
        F.max(_int_flag((F.col("is_meat_item") == 1) & (F.col("is_last_7d") == 1))).alias(
            "bought_meat_last_7d"
        ),
        F.max(_int_flag((F.col("is_meat_item") == 1) & (F.col("is_last_30d") == 1))).alias(
            "bought_meat_last_30d"
        ),
        F.max(_int_flag((F.col("is_fruits_item") == 1) & (F.col("is_last_30d") == 1))).alias("bought_fruits_last_30d"),
        F.max(_int_flag((F.col("is_vegetables_item") == 1) & (F.col("is_last_30d") == 1))).alias("bought_vegetables_last_30d"),
        F.max(_int_flag((F.col("is_bakery_item") == 1) & (F.col("is_last_30d") == 1))).alias("bought_bakery_last_30d"),
        F.max(_int_flag((F.col("is_organic_int") == 1) & (F.col("is_last_90d") == 1))).alias("bought_organic_last_90d"),
        F.max(_int_flag((F.col("quantity") > HIGH_QUANTITY_MIN_ITEMS_30D) & (F.col("is_last_30d") == 1))).alias(
            "high_quantity_buyer_last_30d"
        ),
        F.max(_int_flag((F.col("is_meat_item") == 1) & (F.col("is_last_90d") == 1))).alias(
            "has_meat_last_90d"
        ),
        F.max(_int_flag(((F.col("is_fruits_item") == 1) | (F.col("is_vegetables_item") == 1)) & (F.col("is_last_90d") == 1))).alias(
            "has_plant_last_90d"
        ),
    )

    joined = customers_base.join(purchases_agg, on="customer_id", how="left").join(items_agg, on="customer_id", how="left")

    # coalesce(..., 0) превращает отсутствующие агрегаты в нули. Это важно для
    # клиентов без покупок: они должны получить 0 по большинству фич, а не NULL.
    purchases_all_time = _coalesced_int("purchases_all_time")
    purchases_last_7d = _coalesced_int("purchases_last_7d")
    purchases_last_14d = _coalesced_int("purchases_last_14d")
    purchases_last_30d = _coalesced_int("purchases_last_30d")
    purchases_last_90d = _coalesced_int("purchases_last_90d")
    avg_total_amount = _coalesced_double("avg_total_amount")
    cash_share = _coalesced_double("cash_share")
    card_share = _coalesced_double("card_share")
    weekend_share = _coalesced_double("weekend_share")
    weekday_share = _coalesced_double("weekday_share")
    night_share = _coalesced_double("night_share")
    morning_share = _coalesced_double("morning_share")
    delivery_any = _coalesced_int("delivery_any")
    delivery_any_30d = _coalesced_int("delivery_any_30d")
    max_total_amount_90d = _coalesced_double("max_total_amount_90d")
    distinct_stores_90d = _coalesced_int("distinct_stores_90d")
    used_cash_90d = _coalesced_int("used_cash_90d")
    used_card_90d = _coalesced_int("used_card_90d")
    has_meat_last_90d = _coalesced_int("has_meat_last_90d")
    has_plant_last_90d = _coalesced_int("has_plant_last_90d")

    # no_purchases считается отдельной фичей и не выводится из остальных, чтобы
    # downstream-потребители могли явно отделять "нулевую активность" от других
    # поведенческих профилей.
    result = joined.select(
        "customer_id",
        # Feature logic is intentionally conservative: preferences require a clear
        # share threshold, and activity-based flags require at least one purchase.
        _binary_feature(purchases_last_30d > RECURRENT_BUYER_MIN_PURCHASES_30D, "recurrent_buyer"),
        _binary_feature(delivery_any > 0, "delivery_user"),
        _binary_feature(
            (avg_total_amount > BULK_BUYER_MIN_AVG_TOTAL_AMOUNT) & (purchases_all_time > 0),
            "bulk_buyer",
        ),
        _binary_feature(
            (avg_total_amount < LOW_COST_BUYER_MAX_AVG_TOTAL_AMOUNT) & (purchases_all_time > 0),
            "low_cost_buyer",
        ),
        _binary_feature(
            (cash_share >= PAYMENT_PREFERENCE_MIN_SHARE) & (purchases_all_time > 0),
            "prefers_cash",
        ),
        _binary_feature(
            (card_share >= PAYMENT_PREFERENCE_MIN_SHARE) & (purchases_all_time > 0),
            "prefers_card",
        ),
        _binary_feature(
            (weekend_share >= DAY_OF_WEEK_SHOPPER_MIN_SHARE) & (purchases_all_time > 0),
            "weekend_shopper",
        ),
        _binary_feature(
            (weekday_share >= DAY_OF_WEEK_SHOPPER_MIN_SHARE) & (purchases_all_time > 0),
            "weekday_shopper",
        ),
        _binary_feature(
            (night_share >= TIME_OF_DAY_SHOPPER_MIN_SHARE) & (purchases_all_time > 0),
            "night_shopper",
        ),
        _binary_feature(
            (morning_share >= TIME_OF_DAY_SHOPPER_MIN_SHARE) & (purchases_all_time > 0),
            "morning_shopper",
        ),
        _binary_feature(purchases_all_time == 0, "no_purchases"),
        _binary_feature(purchases_last_7d > 0, "has_purchases_last_7d"),
        _binary_feature(purchases_last_14d > 0, "has_purchases_last_14d"),
        _binary_feature(purchases_last_30d > 0, "has_purchases_last_30d"),
        _binary_feature(purchases_last_90d > 0, "has_purchases_last_90d"),
        _binary_feature(
            purchases_last_14d >= FREQUENT_SHOPPER_MIN_PURCHASES_14D,
            "frequent_shopper_last_14d",
        ),
        _binary_feature(max_total_amount_90d > HIGH_TICKET_MIN_TOTAL_AMOUNT_90D, "high_ticket_last_90d"),
        _binary_feature(delivery_any_30d > 0, "delivery_last_30d"),
        _binary_feature(
            distinct_stores_90d >= CROSS_STORE_MIN_DISTINCT_STORES_90D,
            "cross_store_shopper_last_90d",
        ),
        _binary_feature((used_cash_90d == 1) & (used_card_90d == 1), "mixed_payment_user_last_90d"),
        _binary_metric("bought_milk_last_7d"),
        _binary_metric("bought_milk_last_30d"),
        _binary_metric("bought_meat_last_7d"),
        _binary_metric("bought_meat_last_30d"),
        _binary_metric("bought_fruits_last_30d"),
        _binary_metric("bought_vegetables_last_30d"),
        _binary_metric("bought_bakery_last_30d"),
        _binary_metric("bought_organic_last_90d"),
        _binary_metric("high_quantity_buyer_last_30d"),
        # vegetarian_profile stays conservative: at least one plant purchase in 90d,
        # no meat signal in the same period, and the customer is not empty.
        _binary_feature(
            (has_meat_last_90d == 0) & (has_plant_last_90d == 1) & (purchases_all_time > 0),
            "vegetarian_profile",
        ),
    )

    return result.select("customer_id", *FEATURE_COLUMNS)


def _write_single_csv(features_df: DataFrame) -> Path:
    """Пишет витрину в один CSV-файл через coalesce(1).

    Args:
        features_df: итоговый DataFrame с признаками.
    Returns:
        Путь к сгенерированному part-*.csv.
    """
    tmp_dir = Path(tempfile.mkdtemp(prefix="probablyfresh_features_"))
    logging.info("Writing features CSV to temporary directory: %s", tmp_dir)

    # coalesce(1) нужен, чтобы downstream получил один итоговый CSV-файл, а не
    # стандартный набор part-*.csv от Spark.
    features_df.coalesce(1).write.mode("overwrite").option("header", "true").csv(str(tmp_dir))

    part_files = sorted(tmp_dir.glob("part-*.csv"))
    if not part_files:
        raise RuntimeError(f"Spark output does not contain part-*.csv in {tmp_dir}")

    logging.info("Created CSV part file: %s", part_files[0])
    return part_files[0]


def _write_parquet_dataset(features_df: DataFrame) -> Path:
    """Writes the feature mart to a parquet directory with snappy compression.

    Args:
        features_df: final DataFrame with customer features.
    Returns:
        Path to the directory containing generated parquet part files.
    """
    tmp_dir = Path(tempfile.mkdtemp(prefix="probablyfresh_features_parquet_"))
    logging.info("Writing features Parquet to temporary directory: %s", tmp_dir)

    features_df.write.mode("overwrite").option("compression", "snappy").parquet(str(tmp_dir))

    part_files = sorted(tmp_dir.glob("part-*.parquet"))
    if not part_files:
        raise RuntimeError(f"Spark output does not contain part-*.parquet in {tmp_dir}")

    logging.info("Created Parquet dataset directory: %s", tmp_dir)
    return tmp_dir


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


def _s3_upload_config() -> tuple[str, str, str, str, str, str]:
    """Collects connection parameters for the S3-compatible storage."""
    endpoint_url = _normalize_endpoint(_required_env("S3_ENDPOINT_URL"))
    region = _optional_any_env("ru-3", "S3_REGION", "AWS_DEFAULT_REGION")
    bucket = _required_env("S3_BUCKET")
    access_key = _required_any_env("S3_ACCESS_KEY", "AWS_ACCESS_KEY_ID")
    secret_key = _required_any_env("S3_SECRET_KEY", "AWS_SECRET_ACCESS_KEY")
    prefix = _optional_any_env("", "S3_OBJECT_PREFIX")
    return endpoint_url, region, bucket, access_key, secret_key, prefix


def _build_csv_object_key(prefix: str, export_dt: datetime) -> str:
    """Builds the CSV object key while preserving the current naming scheme."""
    object_name = f"analytic_result_{export_dt:%Y_%m_%d}.csv"
    return f"{prefix.strip('/')}/{object_name}" if prefix.strip("/") else object_name


def _build_parquet_object_prefix(prefix: str, export_dt: datetime) -> str:
    """Builds the parquet export prefix next to the current CSV artifact."""
    object_name = f"analytic_result_{export_dt:%Y_%m_%d}"
    parquet_prefix = f"{prefix.strip('/')}/parquet" if prefix.strip("/") else "parquet"
    return f"{parquet_prefix}/{object_name}"


def _delete_s3_prefix(client, bucket: str, prefix: str) -> None:
    """Deletes all objects under the given prefix in the S3-compatible storage."""
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        contents = page.get("Contents", [])
        if not contents:
            continue

        delete_batch = [{"Key": item["Key"]} for item in contents]
        client.delete_objects(Bucket=bucket, Delete={"Objects": delete_batch, "Quiet": True})


def _upload_to_s3(local_csv_path: Path, export_dt: datetime) -> str:
    """Uploads the local CSV export to the S3-compatible storage.

    Args:
        local_csv_path: path to the CSV file.
        export_dt: shared export timestamp used for consistent artifact names.
    Returns:
        Uploaded object key in the bucket.
    """
    # Keep the current CSV file name format analytic_result_YYYY_MM_DD.csv
    # because documentation, smoke-checks, and UI already rely on it.
    endpoint_url, region, bucket, access_key, secret_key, prefix = _s3_upload_config()
    object_key = _build_csv_object_key(prefix, export_dt)

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


def _upload_parquet_to_s3(local_parquet_dir: Path, export_dt: datetime) -> str:
    """Uploads the parquet export directory to the S3-compatible storage.

    Args:
        local_parquet_dir: path to the directory with parquet part files.
        export_dt: shared export timestamp used for consistent artifact names.
    Returns:
        Uploaded parquet directory prefix in the bucket.
    """
    endpoint_url, region, bucket, access_key, secret_key, prefix = _s3_upload_config()
    object_prefix = _build_parquet_object_prefix(prefix, export_dt)

    logging.info("Uploading parquet dataset %s to s3://%s/%s", local_parquet_dir, bucket, object_prefix)

    client = boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
    )

    # Repeated exports on the same day reuse the same prefix, so clear the old
    # parquet parts first to keep the dataset idempotent for downstream readers.
    _delete_s3_prefix(client, bucket, object_prefix)

    for file_path in sorted(local_parquet_dir.rglob('*')):
        if not file_path.is_file() or file_path.name.startswith('.'):
            continue
        relative_path = file_path.relative_to(local_parquet_dir).as_posix()
        client.upload_file(str(file_path), bucket, f"{object_prefix}/{relative_path}")

    return object_prefix


def main() -> None:
    """Точка входа ETL: чтение MART -> расчёт фич -> CSV/Parquet -> загрузка в S3."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    _load_env()

    spark = _build_spark_session()
    temp_csv_path: Path | None = None
    temp_parquet_dir: Path | None = None
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

        export_dt = datetime.now(timezone.utc)
        temp_csv_path = _write_single_csv(features_df)
        csv_object_key = _upload_to_s3(temp_csv_path, export_dt)

        if _parquet_export_enabled():
            warning_message = _parquet_export_warning_message()
            logging.warning(warning_message)
            print(warning_message)

            temp_parquet_dir = _write_parquet_dataset(features_df)
            parquet_object_prefix = _upload_parquet_to_s3(temp_parquet_dir, export_dt)

            logging.info(
                "Upload completed successfully: csv=%s parquet=%s",
                csv_object_key,
                parquet_object_prefix,
            )
            print(f"Uploaded features file: {csv_object_key}")
            print(f"Uploaded features parquet dataset: {parquet_object_prefix}")
        else:
            logging.info("Upload completed successfully: csv=%s", csv_object_key)
            print(f"Uploaded features file: {csv_object_key}")
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
        if temp_parquet_dir is not None:
            shutil.rmtree(temp_parquet_dir, ignore_errors=True)
            logging.info("Removed temporary directory: %s", temp_parquet_dir)


if __name__ == "__main__":
    main()
