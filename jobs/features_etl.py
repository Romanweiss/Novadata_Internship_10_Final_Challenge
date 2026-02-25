from __future__ import annotations

import logging
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import boto3
from dotenv import load_dotenv
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
import os


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _load_env() -> None:
    load_dotenv(_repo_root() / ".env")


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Environment variable {name} is required")
    return value


def _required_any_env(*names: str) -> str:
    for name in names:
        value = os.getenv(name, "").strip()
        if value:
            return value
    raise RuntimeError(f"One of environment variables {', '.join(names)} is required")


def _optional_env(name: str, default: str) -> str:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip() or default


def _optional_any_env(default: str, *names: str) -> str:
    for name in names:
        value = os.getenv(name)
        if value is not None and value.strip():
            return value.strip()
    return default


def _build_spark_session() -> SparkSession:
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
    logging.info("Reading table via JDBC: %s", table)
    return jdbc_reader.option("dbtable", table).load()


def _build_features(customers_df: DataFrame, purchases_df: DataFrame) -> DataFrame:
    feature_cols = [
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
    ]

    customers_base = (
        customers_df.select(F.trim(F.col("customer_id")).alias("customer_id"))
        .filter(F.col("customer_id").isNotNull() & (F.col("customer_id") != ""))
        .dropDuplicates(["customer_id"])
    )

    purchases_clean = (
        purchases_df.select(
            F.trim(F.col("customer_id")).alias("customer_id"),
            F.col("total_amount").cast("double").alias("total_amount"),
            F.lower(F.trim(F.col("payment_method"))).alias("payment_method"),
            F.col("is_delivery").cast("int").alias("is_delivery"),
            F.col("purchase_dt").cast("timestamp").alias("purchase_dt"),
        )
        .filter(F.col("customer_id").isNotNull() & (F.col("customer_id") != ""))
    )

    purchases_metrics = (
        purchases_clean.withColumn(
            "is_last_30d",
            F.when(F.col("purchase_dt") >= F.expr("current_timestamp() - INTERVAL 30 DAYS"), F.lit(1)).otherwise(
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

    aggregated = purchases_metrics.groupBy("customer_id").agg(
        F.sum("is_last_30d").alias("purchases_last_30d"),
        F.avg("total_amount").alias("avg_total_amount"),
        F.avg("cash_flag").alias("cash_share"),
        F.avg("card_flag").alias("card_share"),
        F.avg("weekend_flag").alias("weekend_share"),
        F.avg("weekday_flag").alias("weekday_share"),
        F.avg("night_flag").alias("night_share"),
        F.avg("morning_flag").alias("morning_share"),
        F.max("is_delivery").alias("delivery_any"),
    )

    purchase_features = aggregated.select(
        "customer_id",
        (F.col("purchases_last_30d") > 2).cast("int").alias("recurrent_buyer"),
        (F.col("delivery_any") > 0).cast("int").alias("delivery_user"),
        (F.col("avg_total_amount") > 1000).cast("int").alias("bulk_buyer"),
        (F.col("avg_total_amount") < 200).cast("int").alias("low_cost_buyer"),
        (F.col("cash_share") >= 0.7).cast("int").alias("prefers_cash"),
        (F.col("card_share") >= 0.7).cast("int").alias("prefers_card"),
        (F.col("weekend_share") >= 0.6).cast("int").alias("weekend_shopper"),
        (F.col("weekday_share") >= 0.6).cast("int").alias("weekday_shopper"),
        (F.col("night_share") >= 0.5).cast("int").alias("night_shopper"),
        (F.col("morning_share") >= 0.5).cast("int").alias("morning_shopper"),
    )

    result = customers_base.join(purchase_features, on="customer_id", how="left")

    result = result.select(
        "customer_id",
        *[F.coalesce(F.col(name), F.lit(0)).cast("int").alias(name) for name in feature_cols],
    )

    return result


def _write_single_csv(features_df: DataFrame) -> Path:
    tmp_dir = Path(tempfile.mkdtemp(prefix="probablyfresh_features_"))
    logging.info("Writing features CSV to temporary directory: %s", tmp_dir)

    features_df.coalesce(1).write.mode("overwrite").option("header", "true").csv(str(tmp_dir))

    part_files = sorted(tmp_dir.glob("part-*.csv"))
    if not part_files:
        raise RuntimeError(f"Spark output does not contain part-*.csv in {tmp_dir}")

    logging.info("Created CSV part file: %s", part_files[0])
    return part_files[0]


def _normalize_endpoint(endpoint: str) -> str:
    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        return endpoint
    return f"https://{endpoint}"


def _upload_to_s3(local_csv_path: Path) -> str:
    endpoint_url = _normalize_endpoint(_required_any_env("MINIO_ENDPOINT", "S3_ENDPOINT_URL"))
    region = _optional_any_env("ru-3", "MINIO_REGION", "S3_REGION")
    bucket = _required_any_env("MINIO_BUCKET", "S3_BUCKET")
    access_key = _required_any_env("MINIO_ACCESS_KEY", "S3_ACCESS_KEY")
    secret_key = _required_any_env("MINIO_SECRET_KEY", "S3_SECRET_KEY")
    prefix = _optional_any_env("", "MINIO_OBJECT_PREFIX", "S3_OBJECT_PREFIX")

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
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    _load_env()

    spark = _build_spark_session()
    temp_csv_path: Path | None = None

    try:
        jdbc_reader = _jdbc_reader(spark)

        purchases_df = _load_table(jdbc_reader, "purchases_mart")
        customers_df = _load_table(jdbc_reader, "customers_mart")

        logging.info("Loaded rows: purchases_mart=%s, customers_mart=%s", purchases_df.count(), customers_df.count())

        features_df = _build_features(customers_df, purchases_df)
        logging.info("Feature rows to export: %s", features_df.count())

        temp_csv_path = _write_single_csv(features_df)
        object_key = _upload_to_s3(temp_csv_path)

        logging.info("Upload completed successfully: %s", object_key)
        print(f"Uploaded features file: {object_key}")
    finally:
        spark.stop()
        if temp_csv_path is not None:
            shutil.rmtree(temp_csv_path.parent, ignore_errors=True)
            logging.info("Removed temporary directory: %s", temp_csv_path.parent)


if __name__ == "__main__":
    main()
