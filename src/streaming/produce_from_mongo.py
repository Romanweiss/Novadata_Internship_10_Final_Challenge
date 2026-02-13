from __future__ import annotations

import argparse
import json
import logging
import os
import re
from typing import Any

from cryptography.fernet import Fernet
from kafka import KafkaProducer
from pymongo import MongoClient


ENTITY_TO_TOPIC_ENV = {
    "stores": ("KAFKA_TOPIC_STORES", "probablyfresh.stores"),
    "products": ("KAFKA_TOPIC_PRODUCTS", "probablyfresh.products"),
    "customers": ("KAFKA_TOPIC_CUSTOMERS", "probablyfresh.customers"),
    "purchases": ("KAFKA_TOPIC_PURCHASES", "probablyfresh.purchases"),
}

PII_ENTITIES = {"customers", "purchases"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Publish MongoDB documents to Kafka topics.")
    parser.add_argument(
        "--once",
        action="store_true",
        help="Read all documents from Mongo collections once and exit.",
    )
    args = parser.parse_args()

    if not args.once:
        raise SystemExit("This producer currently supports only '--once' mode.")

    return args


def get_required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Environment variable {name} is required")
    return value


def normalize_email(value: str) -> str:
    return value.strip().lower()


def normalize_phone(value: str) -> tuple[str, bool]:
    original = value
    cleaned = re.sub(r"[\s()\-]", "", value.strip())

    if cleaned.startswith("+"):
        return cleaned, True

    if re.fullmatch(r"8\d{10}", cleaned):
        return "+7" + cleaned[1:], True

    if re.fullmatch(r"7\d{10}", cleaned):
        return "+7" + cleaned[1:], True

    return original, False


def encrypt_text(cipher: Fernet, value: str) -> str:
    return cipher.encrypt(value.encode("utf-8")).decode("utf-8")


def transform_pii(value: Any, cipher: Fernet, entity_name: str, doc_id: str) -> Any:
    if isinstance(value, dict):
        transformed: dict[str, Any] = {}
        for key, nested_value in value.items():
            if key == "email" and isinstance(nested_value, str):
                normalized = normalize_email(nested_value)
                transformed[key] = encrypt_text(cipher, normalized)
                continue

            if key == "phone" and isinstance(nested_value, str):
                normalized, ok = normalize_phone(nested_value)
                if not ok:
                    logging.warning(
                        "[%s][%s] Could not normalize phone %r; leaving as-is before encryption",
                        entity_name,
                        doc_id,
                        nested_value,
                    )
                transformed[key] = encrypt_text(cipher, normalized)
                continue

            transformed[key] = transform_pii(nested_value, cipher, entity_name, doc_id)
        return transformed

    if isinstance(value, list):
        return [transform_pii(item, cipher, entity_name, doc_id) for item in value]

    return value


def resolve_topics() -> dict[str, str]:
    topics: dict[str, str] = {}
    for entity_name, (env_name, default_value) in ENTITY_TO_TOPIC_ENV.items():
        topics[entity_name] = os.getenv(env_name, default_value).strip() or default_value
    return topics


def main() -> None:
    parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    mongo_uri = get_required_env("MONGO_URI")
    mongo_db = get_required_env("MONGO_DB")
    bootstrap_servers = get_required_env("KAFKA_BOOTSTRAP_SERVERS")
    fernet_key = get_required_env("FERNET_KEY")

    topics = resolve_topics()
    cipher = Fernet(fernet_key.encode("utf-8"))

    producer = KafkaProducer(bootstrap_servers=bootstrap_servers)
    published: dict[str, int] = {name: 0 for name in ENTITY_TO_TOPIC_ENV}

    try:
        with MongoClient(mongo_uri) as mongo_client:
            db = mongo_client[mongo_db]

            for entity_name, topic_name in topics.items():
                collection = db[entity_name]
                for document in collection.find({}):
                    document.pop("_id", None)

                    if entity_name in PII_ENTITIES:
                        doc_id_key = "customer_id" if entity_name == "customers" else "purchase_id"
                        doc_id = str(document.get(doc_id_key, "unknown"))
                        payload_doc = transform_pii(document, cipher, entity_name, doc_id)
                    else:
                        payload_doc = document

                    payload_json = json.dumps(payload_doc, ensure_ascii=False)
                    producer.send(topic_name, value=payload_json.encode("utf-8"))
                    published[entity_name] += 1

        producer.flush()
    finally:
        producer.close()

    for entity_name, count in published.items():
        logging.info("Published %s records to topic %s", count, topics[entity_name])


if __name__ == "__main__":
    main()
