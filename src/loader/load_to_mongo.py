from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from pymongo import MongoClient, UpdateOne


ENTITY_MAP = {
    "stores": {"collection": "stores", "key": "store_id"},
    "products": {"collection": "products", "key": "id"},
    "customers": {"collection": "customers", "key": "customer_id"},
    "purchases": {"collection": "purchases", "key": "purchase_id"},
}


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _read_json_files(directory: Path) -> list[dict[str, Any]]:
    docs: list[dict[str, Any]] = []
    for file_path in sorted(directory.glob("*.json")):
        docs.append(json.loads(file_path.read_text(encoding="utf-8")))
    return docs


def _upsert_documents(
    collection, docs: list[dict[str, Any]], key_field: str
) -> tuple[int, int, int]:
    if not docs:
        return 0, 0, 0

    operations: list[UpdateOne] = []
    for doc in docs:
        if key_field not in doc:
            raise RuntimeError(f"Missing key field {key_field!r} in document: {doc}")
        operations.append(UpdateOne({key_field: doc[key_field]}, {"$set": doc}, upsert=True))

    result = collection.bulk_write(operations, ordered=False)
    inserted = int(result.upserted_count)
    updated = int(result.modified_count)
    processed = len(docs)
    return inserted, updated, processed


def main() -> None:
    mongo_uri = os.getenv("MONGO_URI", "").strip()
    mongo_db = os.getenv("MONGO_DB", "").strip()

    if not mongo_uri:
        raise RuntimeError("MONGO_URI is empty")
    if not mongo_db:
        raise RuntimeError("MONGO_DB is empty")

    data_root = _repo_root() / "data"

    with MongoClient(mongo_uri) as client:
        db = client[mongo_db]

        for entity, cfg in ENTITY_MAP.items():
            collection_name = cfg["collection"]
            key_field = cfg["key"]
            directory = data_root / entity

            if not directory.exists():
                raise RuntimeError(f"Directory does not exist: {directory}")

            docs = _read_json_files(directory)
            inserted, updated, processed = _upsert_documents(db[collection_name], docs, key_field)
            print(
                f"[{collection_name}] processed={processed} inserted={inserted} updated={updated}"
            )


if __name__ == "__main__":
    main()
