from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name, str(default)).strip()
    try:
        return int(raw)
    except ValueError as exc:
        raise ValueError(f"Environment variable {name} must be int, got {raw!r}") from exc


@dataclass(frozen=True)
class Settings:
    project_root: Path
    data_dir: Path

    stores_almost_count: int
    stores_maybe_count: int
    products_per_category: int
    customers_per_store: int
    purchases_count: int
    random_seed: int

    mongo_uri: str
    mongo_db: str

    kafka_bootstrap_servers: str
    kafka_client_id: str
    kafka_topic_stores: str
    kafka_topic_products: str
    kafka_topic_customers: str
    kafka_topic_purchases: str

    clickhouse_host: str
    clickhouse_port: int
    clickhouse_db: str
    clickhouse_user: str
    clickhouse_password: str

    grafana_port: int
    grafana_admin_user: str
    grafana_admin_password: str

    fernet_key: str



def get_settings() -> Settings:
    project_root = PROJECT_ROOT
    data_dir = (project_root / os.getenv("DATA_DIR", "./data").strip()).resolve()

    return Settings(
        project_root=project_root,
        data_dir=data_dir,
        stores_almost_count=_env_int("STORES_ALMOST_COUNT", 30),
        stores_maybe_count=_env_int("STORES_MAYBE_COUNT", 15),
        products_per_category=_env_int("PRODUCTS_PER_CATEGORY", 20),
        customers_per_store=_env_int("CUSTOMERS_PER_STORE", 1),
        purchases_count=_env_int("PURCHASES_COUNT", 200),
        random_seed=_env_int("RANDOM_SEED", 42),
        mongo_uri=os.getenv(
            "MONGO_URI", "mongodb://admin:admin@localhost:27017/probablyfresh?authSource=admin"
        ).strip(),
        mongo_db=os.getenv("MONGO_DB", "probablyfresh").strip(),
        kafka_bootstrap_servers=os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:29092").strip(),
        kafka_client_id=os.getenv("KAFKA_CLIENT_ID", "probablyfresh-producer").strip(),
        kafka_topic_stores=os.getenv("KAFKA_TOPIC_STORES", "stores_raw").strip(),
        kafka_topic_products=os.getenv("KAFKA_TOPIC_PRODUCTS", "products_raw").strip(),
        kafka_topic_customers=os.getenv("KAFKA_TOPIC_CUSTOMERS", "customers_raw").strip(),
        kafka_topic_purchases=os.getenv("KAFKA_TOPIC_PURCHASES", "purchases_raw").strip(),
        clickhouse_host=os.getenv("CLICKHOUSE_HOST", "localhost").strip(),
        clickhouse_port=_env_int("CLICKHOUSE_PORT", 9000),
        clickhouse_db=os.getenv("CLICKHOUSE_DB", "probablyfresh_raw").strip(),
        clickhouse_user=os.getenv("CLICKHOUSE_USER", "default").strip(),
        clickhouse_password=os.getenv("CLICKHOUSE_PASSWORD", "").strip(),
        grafana_port=_env_int("GRAFANA_PORT", 3000),
        grafana_admin_user=os.getenv("GRAFANA_ADMIN_USER", "admin").strip(),
        grafana_admin_password=os.getenv("GRAFANA_ADMIN_PASSWORD", "admin").strip(),
        fernet_key=os.getenv("FERNET_KEY", "").strip(),
    )
