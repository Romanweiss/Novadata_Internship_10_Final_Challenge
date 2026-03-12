from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Callable

import boto3
import requests
from kafka import KafkaAdminClient
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from api.services.clickhouse import ping as clickhouse_ping
from api.services.settings import env_str
from api.services.storage import (
    storage_access_key,
    storage_bucket,
    storage_endpoint,
    storage_region,
    storage_secret_key,
)


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _service_result(name: str, checker: Callable[[], None]) -> dict:
    started = time.perf_counter()
    status = "ok"
    message = ""
    try:
        checker()
    except Exception as exc:  # noqa: BLE001
        status = "down"
        message = str(exc)
    latency_ms = int((time.perf_counter() - started) * 1000)
    if status == "ok" and latency_ms > 1500:
        status = "warn"
    payload = {
        "name": name,
        "status": status,
        "checked_at": _iso_now(),
        "latency_ms": latency_ms,
    }
    if message:
        payload["message"] = message[:200]
    return payload


def _check_clickhouse() -> None:
    clickhouse_ping(timeout=3)


def _check_mongo() -> None:
    mongo_uri = env_str(
        "MONGO_URI",
        f"mongodb://{env_str('MONGO_INITDB_ROOT_USERNAME', 'admin')}:"
        f"{env_str('MONGO_INITDB_ROOT_PASSWORD', 'admin')}@mongodb:27017/"
        f"{env_str('MONGO_DB', 'probablyfresh')}?authSource=admin",
    )
    try:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=2000)
        client.admin.command("ping")
    except PyMongoError as exc:
        raise RuntimeError("Mongo ping failed") from exc
    finally:
        try:
            client.close()
        except Exception:  # noqa: BLE001
            pass


def _check_kafka() -> None:
    bootstrap = env_str("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
    client = KafkaAdminClient(bootstrap_servers=bootstrap, client_id="probablyfresh-health")
    try:
        client.list_topics()
    finally:
        client.close()


def _check_grafana() -> None:
    grafana_url = env_str("GRAFANA_URL", "http://grafana:3000").rstrip("/")
    response = requests.get(f"{grafana_url}/api/health", timeout=3)
    if response.status_code >= 500:
        raise RuntimeError("Grafana health endpoint returned 5xx")


def _check_airflow() -> None:
    base_url = env_str("AIRFLOW_BASE_URL", "http://airflow:8080").rstrip("/")
    user = env_str("AIRFLOW_USER", env_str("AIRFLOW_ADMIN_USER", "admin"))
    password = env_str("AIRFLOW_PASSWORD", env_str("AIRFLOW_ADMIN_PASSWORD", "admin"))
    auth = (user, password) if user else None
    response = requests.get(f"{base_url}/api/v1/health", auth=auth, timeout=4)
    if response.status_code not in {200, 401, 403}:
        raise RuntimeError(f"Airflow health status {response.status_code}")


def _check_storage() -> None:
    client = boto3.client(
        "s3",
        endpoint_url=storage_endpoint() or None,
        aws_access_key_id=storage_access_key() or None,
        aws_secret_access_key=storage_secret_key() or None,
        region_name=storage_region(),
    )
    client.list_objects_v2(Bucket=storage_bucket(), MaxKeys=1)


def collect_services_health() -> dict:
    services = [
        _service_result("ClickHouse", _check_clickhouse),
        _service_result("Kafka", _check_kafka),
        _service_result("MongoDB", _check_mongo),
        _service_result("Grafana", _check_grafana),
        _service_result("Airflow", _check_airflow),
        _service_result("S3", _check_storage),
    ]
    return {"services": services}
