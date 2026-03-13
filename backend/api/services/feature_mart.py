from __future__ import annotations

import csv
import io
import re
from datetime import date, datetime, timezone
from typing import Any

from botocore.exceptions import BotoCoreError, ClientError

from api.services.errors import ServiceError
from api.services.exports import _bucket, _s3_client
from api.services.storage import storage_prefix

_FEATURE_FILE_PATTERN = re.compile(r"^analytic_result_(\d{4})_(\d{2})_(\d{2})\.csv$")


def _feature_listing_prefix() -> str:
    prefix = storage_prefix().strip().strip("/")
    if not prefix:
        return ""
    return f"{prefix}/"


def _extract_file_date(key: str) -> date | None:
    filename = key.rsplit("/", 1)[-1]
    match = _FEATURE_FILE_PATTERN.match(filename)
    if not match:
        return None
    year, month, day = (int(value) for value in match.groups())
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _list_matching_exports() -> list[dict[str, Any]]:
    client = _s3_client()
    prefix = _feature_listing_prefix()
    continuation_token: str | None = None
    matched: list[dict[str, Any]] = []

    while True:
        params: dict[str, Any] = {"Bucket": _bucket(), "MaxKeys": 1000}
        if prefix:
            params["Prefix"] = prefix
        if continuation_token:
            params["ContinuationToken"] = continuation_token

        response = client.list_objects_v2(**params)
        for obj in response.get("Contents", []):
            key = str(obj.get("Key", ""))
            file_date = _extract_file_date(key)
            if not file_date:
                continue
            matched.append(
                {
                    "key": key,
                    "filename": key.rsplit("/", 1)[-1],
                    "file_date": file_date,
                    "last_modified": obj.get("LastModified"),
                }
            )

        if not response.get("IsTruncated"):
            break
        continuation_token = response.get("NextContinuationToken")

    return matched


def _pick_latest_file(candidates: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not candidates:
        return None

    def sort_key(item: dict[str, Any]) -> tuple[date, datetime, str]:
        last_modified = item.get("last_modified")
        if not isinstance(last_modified, datetime):
            last_modified = datetime.min.replace(tzinfo=timezone.utc)
        return item["file_date"], last_modified, item["key"]

    return max(candidates, key=sort_key)


def _to_binary_flag(value: str | int | None) -> int:
    if value is None:
        return 0
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "y"}:
        return 1
    if text in {"0", "false", "no", "n", ""}:
        return 0
    try:
        return 1 if int(text) == 1 else 0
    except ValueError:
        return 0


def _parse_feature_csv(csv_bytes: bytes) -> dict[str, Any]:
    decoded = csv_bytes.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(decoded))
    raw_columns = [str(column).strip() for column in (reader.fieldnames or []) if str(column).strip()]
    if not raw_columns:
        raise ServiceError(
            "FEATURE_MART_CSV_INVALID",
            "Feature mart CSV has no columns.",
            status_code=500,
        )
    if "customer_id" not in raw_columns:
        raise ServiceError(
            "FEATURE_MART_CSV_INVALID",
            "Feature mart CSV must contain 'customer_id' column.",
            status_code=500,
            details={"columns": raw_columns},
        )

    feature_columns = [column for column in raw_columns if column != "customer_id"]
    summary: dict[str, int] = {column: 0 for column in feature_columns}
    rows: list[dict[str, Any]] = []

    for raw_row in reader:
        if not raw_row:
            continue

        customer_id = str(raw_row.get("customer_id") or "").strip()
        if not customer_id:
            continue

        row: dict[str, Any] = {"customer_id": customer_id}
        for column in feature_columns:
            flag = _to_binary_flag(raw_row.get(column))
            row[column] = flag
            if flag == 1:
                summary[column] += 1

        rows.append(row)

    return {
        "columns": raw_columns,
        "feature_columns": feature_columns,
        "rows": rows,
        "rows_count": len(rows),
        "features_count": len(feature_columns),
        "feature_summary": [
            {"feature": column, "ones_count": summary[column]}
            for column in feature_columns
        ],
    }


def get_feature_mart_payload() -> dict[str, Any]:
    try:
        candidates = _list_matching_exports()
    except (BotoCoreError, ClientError) as exc:
        raise ServiceError(
            "FEATURE_MART_STORAGE_ERROR",
            "Failed to list feature mart exports in S3.",
            status_code=503,
        ) from exc

    latest = _pick_latest_file(candidates)
    if not latest:
        return {
            "file_name": None,
            "source": "s3",
            "generated_at": None,
            "rows_count": 0,
            "features_count": 0,
            "columns": ["customer_id"],
            "feature_columns": [],
            "rows": [],
            "feature_summary": [],
        }

    key = latest["key"]
    try:
        response = _s3_client().get_object(Bucket=_bucket(), Key=key)
        body = response["Body"].read()
    except (BotoCoreError, ClientError) as exc:
        raise ServiceError(
            "FEATURE_MART_READ_ERROR",
            "Failed to read feature mart CSV from S3.",
            status_code=503,
            details={"key": key},
        ) from exc

    parsed = _parse_feature_csv(body)
    return {
        "file_name": latest["filename"],
        "source": "s3",
        "generated_at": latest["file_date"].isoformat(),
        **parsed,
    }
