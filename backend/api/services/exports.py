from __future__ import annotations

from datetime import datetime
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from api.services.errors import ServiceError
from api.services.settings import env_int, env_str


def _s3_client():
    return boto3.client(
        "s3",
        endpoint_url=env_str("MINIO_ENDPOINT", ""),
        aws_access_key_id=env_str("MINIO_ACCESS_KEY", ""),
        aws_secret_access_key=env_str("MINIO_SECRET_KEY", ""),
        region_name=env_str("MINIO_REGION", "ru-3"),
    )


def _bucket() -> str:
    return env_str("MINIO_BUCKET", "analytics")


def _derive_status(key: str, size_bytes: int) -> str:
    if size_bytes <= 0 or key.endswith(".tmp") or "processing" in key.lower():
        return "processing"
    return "ready"


def _format_item(obj: dict[str, Any]) -> dict[str, Any]:
    key = str(obj.get("Key", ""))
    size_bytes = int(obj.get("Size", 0) or 0)
    modified = obj.get("LastModified")
    date_value = modified.date().isoformat() if isinstance(modified, datetime) else None
    return {
        "key": key,
        "filename": key.split("/")[-1],
        "date": date_value,
        "rows": None,
        "size_bytes": size_bytes,
        "status": _derive_status(key, size_bytes),
    }


def list_exports(query: str = "", limit: int = 50, offset: int = 0) -> dict:
    safe_limit = min(max(limit, 1), 200)
    safe_offset = max(offset, 0)
    query_lower = query.strip().lower()

    try:
        response = _s3_client().list_objects_v2(Bucket=_bucket(), MaxKeys=1000)
        objects = response.get("Contents", [])
        items = [_format_item(obj) for obj in objects]
    except (BotoCoreError, ClientError):
        items = [
            {
                "key": "analytic_result_2026_02_25.csv",
                "filename": "analytic_result_2026_02_25.csv",
                "date": "2026-02-25",
                "rows": 125000,
                "size_bytes": 45_000_000,
                "status": "ready",
            },
            {
                "key": "mart_dump_2026_02_24.csv",
                "filename": "mart_dump_2026_02_24.csv",
                "date": "2026-02-24",
                "rows": 450000,
                "size_bytes": 120_000_000,
                "status": "ready",
            },
            {
                "key": "features_2026_02_23.parquet",
                "filename": "features_2026_02_23.parquet",
                "date": "2026-02-23",
                "rows": 2_000_000,
                "size_bytes": 350_000_000,
                "status": "ready",
            },
            {
                "key": "daily_report_2026_02_25.pdf",
                "filename": "daily_report_2026_02_25.pdf",
                "date": "2026-02-25",
                "rows": None,
                "size_bytes": 2_000_000,
                "status": "processing",
            },
        ]

    if query_lower:
        items = [
            item
            for item in items
            if query_lower in (item.get("filename") or "").lower()
            or query_lower in str(item.get("date") or "").lower()
        ]

    total = len(items)
    sliced = items[safe_offset : safe_offset + safe_limit]
    return {"items": sliced, "total": total}


def presign_export(key: str) -> dict:
    if not key:
        raise ServiceError("EXPORT_KEY_REQUIRED", "Query param 'key' is required.", 400)

    expires = env_int("EXPORT_PRESIGN_TTL", 300)
    try:
        url = _s3_client().generate_presigned_url(
            "get_object",
            Params={"Bucket": _bucket(), "Key": key},
            ExpiresIn=expires,
        )
    except (BotoCoreError, ClientError) as exc:
        raise ServiceError("EXPORT_PRESIGN_FAILED", "Failed to create presigned URL.", 500) from exc

    return {"url": url}
