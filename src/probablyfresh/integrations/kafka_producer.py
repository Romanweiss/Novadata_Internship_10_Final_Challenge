from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from kafka import KafkaProducer

from probablyfresh.config import Settings
from probablyfresh.core.crypto_utils import Encryptor
from probablyfresh.core.normalization import normalize_email, normalize_phone


ENTITY_TO_TOPIC = {
    "stores": "kafka_topic_stores",
    "products": "kafka_topic_products",
    "customers": "kafka_topic_customers",
    "purchases": "kafka_topic_purchases",
}

SENSITIVE_KEYS = {"phone", "email"}



def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))



def _object_id(entity_name: str, payload: dict[str, Any]) -> str:
    if entity_name == "stores":
        return str(payload.get("store_id", ""))
    if entity_name == "products":
        return str(payload.get("id", ""))
    if entity_name == "customers":
        return str(payload.get("customer_id", ""))
    if entity_name == "purchases":
        return str(payload.get("purchase_id", ""))
    return ""



def _encrypt_sensitive_fields(value: Any, encryptor: Encryptor) -> Any:
    if isinstance(value, dict):
        output: dict[str, Any] = {}
        for key, nested_value in value.items():
            if key in SENSITIVE_KEYS and isinstance(nested_value, str):
                normalized = normalize_email(nested_value) if key == "email" else normalize_phone(nested_value)
                output[key] = encryptor.encrypt(normalized)
            else:
                output[key] = _encrypt_sensitive_fields(nested_value, encryptor)
        return output

    if isinstance(value, list):
        return [_encrypt_sensitive_fields(item, encryptor) for item in value]

    return value



def publish_raw_events(settings: Settings) -> dict[str, int]:
    encryptor = Encryptor(settings.fernet_key)
    counters: dict[str, int] = {name: 0 for name in ENTITY_TO_TOPIC}

    producer = KafkaProducer(
        bootstrap_servers=settings.kafka_bootstrap_servers,
        client_id=settings.kafka_client_id,
        value_serializer=lambda data: json.dumps(data, ensure_ascii=False).encode("utf-8"),
        linger_ms=50,
    )

    try:
        for entity_name, topic_attr in ENTITY_TO_TOPIC.items():
            topic_name = getattr(settings, topic_attr)
            folder = settings.data_dir / entity_name

            for file_path in sorted(folder.glob("*.json")):
                payload = _load_json(file_path)
                payload = _encrypt_sensitive_fields(payload, encryptor)
                object_id = _object_id(entity_name, payload)

                event = {
                    "source": entity_name,
                    "object_id": object_id,
                    "payload": json.dumps(payload, ensure_ascii=False),
                    "event_ts": datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z"),
                }

                producer.send(topic_name, key=object_id.encode("utf-8"), value=event)
                counters[entity_name] += 1

        producer.flush()
    finally:
        producer.close()

    return counters
