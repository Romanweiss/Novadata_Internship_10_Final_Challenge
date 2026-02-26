from __future__ import annotations

from api.services.settings import env_str


def _normalize_endpoint(endpoint: str) -> str:
    if not endpoint:
        return ""
    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        return endpoint
    return f"https://{endpoint}"


def storage_endpoint() -> str:
    return _normalize_endpoint(env_str("S3_ENDPOINT_URL", env_str("MINIO_ENDPOINT", "")))


def storage_region() -> str:
    return env_str("S3_REGION", env_str("MINIO_REGION", "ru-3"))


def storage_bucket() -> str:
    return env_str("S3_BUCKET", env_str("MINIO_BUCKET", "analytics"))


def storage_access_key() -> str:
    return env_str("S3_ACCESS_KEY", env_str("MINIO_ACCESS_KEY", ""))


def storage_secret_key() -> str:
    return env_str("S3_SECRET_KEY", env_str("MINIO_SECRET_KEY", ""))


def storage_prefix() -> str:
    return env_str("S3_OBJECT_PREFIX", env_str("MINIO_OBJECT_PREFIX", ""))
