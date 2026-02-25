from __future__ import annotations

import json
from typing import Any

import requests

from api.services.errors import ServiceError
from api.services.settings import env_int, env_str


def _db_raw() -> str:
    return env_str("CLICKHOUSE_DB_RAW", env_str("CLICKHOUSE_DB", "probablyfresh_raw"))


def _db_mart() -> str:
    return env_str("CLICKHOUSE_DB_MART", env_str("CH_DATABASE", "probablyfresh_mart"))


def _host() -> str:
    return env_str("CH_HOST", env_str("CLICKHOUSE_HOST", "clickhouse"))


def _port() -> int:
    port = env_int("CH_PORT", env_int("CLICKHOUSE_PORT", env_int("CLICKHOUSE_HTTP_PORT", 8123)))
    if port == 9000:
        return 8123
    return port


def _user() -> str:
    return env_str("CLICKHOUSE_USER", env_str("CH_USER", "default"))


def _password() -> str:
    return env_str("CLICKHOUSE_PASSWORD", env_str("CH_PASSWORD", ""))


def _base_url() -> str:
    host = _host()
    if host.startswith("http://") or host.startswith("https://"):
        return f"{host}:{_port()}" if ":" not in host.split("//", 1)[1] else host
    return f"http://{host}:{_port()}"


def _auth():
    user = _user()
    password = _password()
    if not user:
        return None
    return (user, password)


def ping(timeout: int = 3) -> None:
    url = f"{_base_url()}/ping"
    try:
        response = requests.get(url, timeout=timeout)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise ServiceError("CLICKHOUSE_UNAVAILABLE", "ClickHouse ping failed.", 503) from exc


def query_rows(sql: str, database: str | None = None, timeout: int = 10) -> list[dict[str, Any]]:
    db_name = database or _db_mart()
    query = sql.strip()
    if "format json" not in query.lower():
        query = f"{query}\nFORMAT JSON"
    url = f"{_base_url()}/"
    try:
        response = requests.post(
            url,
            params={"database": db_name},
            data=query.encode("utf-8"),
            auth=_auth(),
            timeout=timeout,
        )
        response.raise_for_status()
        payload = response.json()
        rows = payload.get("data", [])
        if isinstance(rows, list):
            return rows
        raise ValueError("Unexpected ClickHouse JSON payload.")
    except (requests.RequestException, ValueError, json.JSONDecodeError) as exc:
        raise ServiceError("CLICKHOUSE_QUERY_FAILED", "ClickHouse query failed.", 503) from exc


def query_scalar(sql: str, database: str | None = None, default: Any = None, timeout: int = 10) -> Any:
    rows = query_rows(sql=sql, database=database, timeout=timeout)
    if not rows:
        return default
    first = rows[0]
    if not isinstance(first, dict) or not first:
        return default
    return next(iter(first.values()))


def execute_sql(sql: str, database: str | None = None, timeout: int = 60) -> None:
    db_name = database or _db_mart()
    url = f"{_base_url()}/"
    try:
        response = requests.post(
            url,
            params={"database": db_name, "multiquery": "1"},
            data=sql.encode("utf-8"),
            auth=_auth(),
            timeout=timeout,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise ServiceError("CLICKHOUSE_EXEC_FAILED", "ClickHouse SQL execution failed.", 500) from exc


def db_raw_name() -> str:
    return _db_raw()


def db_mart_name() -> str:
    return _db_mart()
