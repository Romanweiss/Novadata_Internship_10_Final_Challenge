from __future__ import annotations

from api.models import get_safe_mode, set_safe_mode
from api.services.settings import env_int, env_str
from api.services.storage import storage_endpoint


def get_connections_payload() -> dict:
    clickhouse_host = env_str("CH_HOST", env_str("CLICKHOUSE_HOST", "clickhouse"))
    clickhouse_port = env_int("CH_PORT", env_int("CLICKHOUSE_PORT", 8123))
    return {
        "clickhouse_jdbc": f"jdbc:clickhouse://{clickhouse_host}:{clickhouse_port}/default",
        "s3_endpoint": storage_endpoint() or env_str("S3_ENDPOINT_URL", ""),
        "grafana_url": env_str("GRAFANA_URL", "http://grafana:3000"),
        "airflow_url": env_str("AIRFLOW_BASE_URL", "http://airflow:8080"),
        "safe_mode": get_safe_mode(default=True),
    }


def update_safe_mode(enabled: bool) -> dict:
    set_safe_mode(enabled)
    return {"enabled": get_safe_mode(default=True)}
