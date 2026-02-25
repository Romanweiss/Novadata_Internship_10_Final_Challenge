from __future__ import annotations

import csv
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import boto3
import requests
from botocore.exceptions import ClientError
from dotenv import load_dotenv


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _load_env() -> None:
    load_dotenv(_repo_root() / ".env")


def _required_any_env(*names: str) -> str:
    for name in names:
        value = os.getenv(name, "").strip()
        if value:
            return value
    raise RuntimeError(f"One of environment variables {', '.join(names)} is required")


def _optional_any_env(default: str, *names: str) -> str:
    for name in names:
        value = os.getenv(name)
        if value is not None and value.strip():
            return value.strip()
    return default


def _normalize_endpoint(endpoint: str, default_scheme: str = "http") -> str:
    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        return endpoint
    return f"{default_scheme}://{endpoint}"


def _assert(cond: bool, message: str) -> None:
    if not cond:
        raise RuntimeError(message)


def _ch_query_json(query: str, database: str | None = None) -> list[dict[str, Any]]:
    host = _optional_any_env("clickhouse", "CH_HOST", "CLICKHOUSE_HOST")
    port = _optional_any_env("8123", "CH_PORT", "CLICKHOUSE_HTTP_PORT", "CLICKHOUSE_PORT")
    user = _optional_any_env("default", "CH_USER", "CLICKHOUSE_USER")
    password = _optional_any_env("", "CH_PASSWORD", "CLICKHOUSE_PASSWORD")

    base_url = f"http://{host}:{port}/"
    params: dict[str, str] = {"default_format": "JSON", "user": user}
    if password:
        params["password"] = password
    if database:
        params["database"] = database

    response = requests.post(
        base_url,
        params=params,
        data=f"{query}\nFORMAT JSON",
        timeout=60,
    )
    response.raise_for_status()
    payload = response.json()
    return payload.get("data", [])


def _ch_scalar(query: str, field: str, database: str) -> Any:
    rows = _ch_query_json(query=query, database=database)
    _assert(bool(rows), f"Empty ClickHouse response for query field {field}")
    _assert(field in rows[0], f"Field {field} not found in ClickHouse response")
    return rows[0][field]


def _print_raw_checks() -> None:
    raw_db = "probablyfresh_raw"
    stores = int(_ch_scalar("SELECT uniqExact(store_id) AS v FROM stores_raw", "v", raw_db))
    products = int(_ch_scalar("SELECT uniqExact(product_id) AS v FROM products_raw", "v", raw_db))
    purchases = int(_ch_scalar("SELECT uniqExact(purchase_id) AS v FROM purchases_raw", "v", raw_db))
    customers = int(_ch_scalar("SELECT uniqExact(customer_id) AS v FROM customers_raw", "v", raw_db))

    print(f"RAW uniq counts: stores={stores}, products={products}, purchases={purchases}, customers={customers}")
    _assert(stores == 45, f"RAW stores uniq expected 45, got {stores}")
    _assert(products == 100, f"RAW products uniq expected 100, got {products}")
    _assert(purchases == 200, f"RAW purchases uniq expected 200, got {purchases}")
    _assert(customers >= 45, f"RAW customers uniq expected >=45, got {customers}")


def _print_mart_checks() -> None:
    mart_db = "probablyfresh_mart"
    customers = int(_ch_scalar("SELECT count() AS v FROM customers_mart FINAL", "v", mart_db))
    purchases = int(_ch_scalar("SELECT count() AS v FROM purchases_mart FINAL", "v", mart_db))
    purchase_items = int(_ch_scalar("SELECT count() AS v FROM purchase_items_mart FINAL", "v", mart_db))

    print(
        f"MART FINAL counts: customers={customers}, purchases={purchases}, purchase_items={purchase_items}"
    )
    _assert(customers >= 45, f"MART customers FINAL expected >=45, got {customers}")
    _assert(purchases >= 200, f"MART purchases FINAL expected >=200, got {purchases}")
    _assert(
        purchase_items > purchases,
        f"MART purchase_items FINAL expected > purchases ({purchases}), got {purchase_items}",
    )


def _print_quality_checks() -> None:
    mart_db = "probablyfresh_mart"
    rows = _ch_query_json(
        query=(
            "SELECT entity, event_time, invalid_rows, duplicates_ratio "
            "FROM mart_quality_stats "
            "WHERE entity = 'purchases' "
            "ORDER BY event_time DESC "
            "LIMIT 1"
        ),
        database=mart_db,
    )
    _assert(bool(rows), "mart_quality_stats has no row for entity='purchases'")
    row = rows[0]

    invalid_rows = int(row["invalid_rows"])
    duplicates_ratio = float(row["duplicates_ratio"])
    event_time = row["event_time"]
    print(
        "mart_quality_stats (latest purchases): "
        f"event_time={event_time}, invalid_rows={invalid_rows}, duplicates_ratio={duplicates_ratio:.6f}"
    )
    _assert(invalid_rows >= 0, f"invalid_rows must be >=0, got {invalid_rows}")
    _assert(
        0.0 <= duplicates_ratio <= 1.0,
        f"duplicates_ratio must be in [0,1], got {duplicates_ratio}",
    )


def _build_s3_client() -> tuple[Any, str, str]:
    endpoint = _normalize_endpoint(_required_any_env("MINIO_ENDPOINT", "S3_ENDPOINT_URL"), default_scheme="https")
    region = _optional_any_env("ru-3", "MINIO_REGION", "S3_REGION")
    bucket = _required_any_env("MINIO_BUCKET", "S3_BUCKET")
    access_key = _required_any_env("MINIO_ACCESS_KEY", "S3_ACCESS_KEY")
    secret_key = _required_any_env("MINIO_SECRET_KEY", "S3_SECRET_KEY")
    prefix = _optional_any_env("", "MINIO_OBJECT_PREFIX", "S3_OBJECT_PREFIX").strip("/")

    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
    )
    return client, bucket, prefix


def _read_first_non_empty_lines(body: Any, lines_count: int) -> list[str]:
    lines: list[str] = []
    for raw_line in body.iter_lines():
        if raw_line is None:
            continue
        line = raw_line.decode("utf-8-sig").strip()
        if not line:
            continue
        lines.append(line)
        if len(lines) >= lines_count:
            break
    return lines


def _print_s3_csv_checks() -> None:
    client, bucket, prefix = _build_s3_client()

    object_name = f"analytic_result_{datetime.now(timezone.utc):%Y_%m_%d}.csv"
    object_key = f"{prefix}/{object_name}" if prefix else object_name

    try:
        head = client.head_object(Bucket=bucket, Key=object_key)
    except ClientError as exc:
        raise RuntimeError(f"S3 object {object_key} was not found in bucket {bucket}") from exc

    size = int(head.get("ContentLength", 0))
    print(f"S3 object: s3://{bucket}/{object_key}, size={size} bytes")
    _assert(size > 1024, f"S3 object size must be > 1024 bytes, got {size}")

    response = client.get_object(Bucket=bucket, Key=object_key)
    body = response["Body"]
    try:
        lines = _read_first_non_empty_lines(body=body, lines_count=6)
    finally:
        body.close()

    _assert(len(lines) >= 6, "CSV must contain header + at least 5 rows")
    parsed_rows = list(csv.reader(lines))
    header = parsed_rows[0]
    rows = parsed_rows[1:6]

    _assert(len(header) == 31, f"CSV header must have 31 columns, got {len(header)}")
    for idx, row in enumerate(rows, start=1):
        _assert(len(row) == 31, f"CSV row #{idx} must have 31 columns, got {len(row)}")
        _assert(row[0].strip() != "", f"CSV row #{idx} has empty customer_id")
        invalid_values = [v for v in row[1:] if v not in ("0", "1")]
        _assert(
            not invalid_values,
            f"CSV row #{idx} contains non-binary feature values: {invalid_values}",
        )

    print("CSV check: 31 columns and binary feature values (0/1) on first 5 rows")


def main() -> None:
    _load_env()

    print("== ProbablyFresh smoke check ==")
    _print_raw_checks()
    _print_mart_checks()
    _print_quality_checks()
    _print_s3_csv_checks()
    print("SMOKE CHECK PASSED")


if __name__ == "__main__":
    main()
