from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pymongo import MongoClient

from probablyfresh.config import Settings


ENTITY_TO_COLLECTION = {
    "stores": "stores",
    "products": "products",
    "customers": "customers",
    "purchases": "purchases",
}



def _read_json_files(folder: Path) -> list[dict[str, Any]]:
    documents: list[dict[str, Any]] = []
    for file_path in sorted(folder.glob("*.json")):
        documents.append(json.loads(file_path.read_text(encoding="utf-8")))
    return documents



def load_to_mongodb(settings: Settings) -> dict[str, int]:
    inserted_counts: dict[str, int] = {}

    with MongoClient(settings.mongo_uri) as client:
        db = client[settings.mongo_db]

        for entity_name, collection_name in ENTITY_TO_COLLECTION.items():
            folder = settings.data_dir / entity_name
            docs = _read_json_files(folder)
            collection = db[collection_name]

            collection.delete_many({})
            if docs:
                collection.insert_many(docs)
            inserted_counts[entity_name] = len(docs)

    return inserted_counts
