from __future__ import annotations

import json
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from faker import Faker

from probablyfresh.config import Settings


CATEGORIES = [
    "Grains and Bakery",
    "Protein Foods",
    "Dairy",
    "Fruits and Berries",
    "Vegetables and Greens",
]


@dataclass
class GenerationResult:
    stores: int
    products: int
    customers: int
    purchases: int



def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)



def _clear_json_files(path: Path) -> None:
    for file_path in path.glob("*.json"):
        file_path.unlink()



def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")



def generate_data(settings: Settings) -> GenerationResult:
    fake = Faker("ru_RU")
    random.seed(settings.random_seed)

    stores_dir = settings.data_dir / "stores"
    products_dir = settings.data_dir / "products"
    customers_dir = settings.data_dir / "customers"
    purchases_dir = settings.data_dir / "purchases"

    for directory in (stores_dir, products_dir, customers_dir, purchases_dir):
        _ensure_dir(directory)
        _clear_json_files(directory)

    stores: list[dict[str, Any]] = []
    store_specs = [
        ("ProbablyFresh Almost", settings.stores_almost_count, "Large format store in a network of 30 locations."),
        ("ProbablyFresh Maybe", settings.stores_maybe_count, "Small format store in a network of 15 locations."),
    ]

    for network_name, count, store_type_desc in store_specs:
        for _ in range(count):
            store_number = len(stores) + 1
            store_id = f"store-{store_number:03d}"
            city = fake.city()
            payload = {
                "store_id": store_id,
                "store_name": f"{network_name} Store #{store_number}",
                "store_network": network_name,
                "store_type_description": store_type_desc,
                "type": "offline",
                "categories": CATEGORIES,
                "manager": {
                    "name": fake.name(),
                    "phone": fake.phone_number(),
                    "email": fake.email(),
                },
                "location": {
                    "country": "Russia",
                    "city": city,
                    "street": fake.street_name(),
                    "house": str(fake.building_number()),
                    "postal_code": fake.postcode(),
                    "coordinates": {
                        "latitude": float(fake.latitude()),
                        "longitude": float(fake.longitude()),
                    },
                },
                "opening_hours": {
                    "mon_fri": "09:00-21:00",
                    "sat": "10:00-20:00",
                    "sun": "10:00-18:00",
                },
                "accepts_online_orders": True,
                "delivery_available": True,
                "warehouse_connected": random.choice([True, False]),
                "last_inventory_date": datetime.now(tz=timezone.utc).date().isoformat(),
            }
            stores.append(payload)
            _write_json(stores_dir / f"{store_id}.json", payload)

    products: list[dict[str, Any]] = []
    product_index = 1
    for category in CATEGORIES:
        for _ in range(settings.products_per_category):
            product_id = f"prd-{product_index:04d}"
            payload = {
                "id": product_id,
                "name": fake.word().capitalize(),
                "group": category,
                "description": fake.sentence(nb_words=8),
                "kbju": {
                    "calories": round(random.uniform(40, 300), 1),
                    "protein": round(random.uniform(0.5, 30), 1),
                    "fat": round(random.uniform(0.2, 20), 1),
                    "carbohydrates": round(random.uniform(0.2, 60), 1),
                },
                "price": round(random.uniform(25, 450), 2),
                "unit": random.choice(["piece", "pack", "kg", "liter"]),
                "origin_country": random.choice(["Russia", "Belarus", "Kazakhstan"]),
                "expiry_days": random.randint(3, 60),
                "is_organic": random.choice([True, False]),
                "barcode": fake.ean(length=13),
                "manufacturer": {
                    "name": fake.company(),
                    "country": "Russia",
                    "website": f"https://{fake.domain_name()}",
                    "inn": "".join(random.choice("0123456789") for _ in range(10)),
                },
            }
            products.append(payload)
            _write_json(products_dir / f"{product_id}.json", payload)
            product_index += 1

    customers: list[dict[str, Any]] = []
    customer_index = 1
    for store in stores:
        for _ in range(max(1, settings.customers_per_store)):
            customer_id = f"cus-{customer_index:06d}"
            payload = {
                "customer_id": customer_id,
                "first_name": fake.first_name(),
                "last_name": fake.last_name(),
                "email": fake.email(),
                "phone": fake.phone_number(),
                "birth_date": fake.date_of_birth(minimum_age=18, maximum_age=75).isoformat(),
                "gender": random.choice(["male", "female", "other", None]),
                "registration_date": datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z"),
                "is_loyalty_member": random.choice([True, False]),
                "loyalty_card_number": f"LOYAL-{uuid4().hex[:10].upper()}",
                "purchase_location": {
                    "store_id": store["store_id"],
                    "store_name": store["store_name"],
                    "store_network": store["store_network"],
                    "store_type_description": store["store_type_description"],
                    "country": store["location"]["country"],
                    "city": store["location"]["city"],
                    "street": store["location"]["street"],
                    "house": store["location"]["house"],
                    "postal_code": store["location"]["postal_code"],
                },
                "delivery_address": {
                    "country": "Russia",
                    "city": store["location"]["city"],
                    "street": fake.street_name(),
                    "house": str(fake.building_number()),
                    "apartment": str(random.randint(1, 180)),
                    "postal_code": fake.postcode(),
                },
                "preferences": {
                    "preferred_language": "ru",
                    "preferred_payment_method": random.choice(["card", "cash", "online_wallet"]),
                    "receive_promotions": random.choice([True, False]),
                },
            }
            customers.append(payload)
            _write_json(customers_dir / f"{customer_id}.json", payload)
            customer_index += 1

    purchases_created = 0
    min_purchases = max(200, settings.purchases_count)
    while purchases_created < min_purchases:
        customer = customers[purchases_created % len(customers)]
        store = stores[purchases_created % len(stores)] if purchases_created < len(stores) else random.choice(stores)

        items_count = random.randint(1, 4)
        chosen_products = random.sample(products, k=items_count)
        items: list[dict[str, Any]] = []
        total_amount = 0.0

        for product in chosen_products:
            quantity = random.randint(1, 5)
            total_price = round(product["price"] * quantity, 2)
            total_amount += total_price
            items.append(
                {
                    "product_id": product["id"],
                    "name": product["name"],
                    "category": product["group"],
                    "quantity": quantity,
                    "unit": product["unit"],
                    "price_per_unit": product["price"],
                    "total_price": total_price,
                    "kbju": product["kbju"],
                    "manufacturer": product["manufacturer"],
                }
            )

        purchase_id = f"ord-{datetime.now(tz=timezone.utc):%Y%m%d}-{purchases_created + 1:04d}"
        purchase_datetime = (
            datetime.now(tz=timezone.utc) - timedelta(days=random.randint(0, 120), minutes=random.randint(0, 1440))
        ).isoformat().replace("+00:00", "Z")

        payload = {
            "purchase_id": purchase_id,
            "customer": {
                "customer_id": customer["customer_id"],
                "first_name": customer["first_name"],
                "last_name": customer["last_name"],
                "email": customer["email"],
                "phone": customer["phone"],
                "is_loyalty_member": customer["is_loyalty_member"],
                "loyalty_card_number": customer["loyalty_card_number"],
            },
            "store": {
                "store_id": store["store_id"],
                "store_name": store["store_name"],
                "store_network": store["store_network"],
                "store_type_description": store["store_type_description"],
                "location": {
                    "city": store["location"]["city"],
                    "street": store["location"]["street"],
                    "house": store["location"]["house"],
                    "postal_code": store["location"]["postal_code"],
                },
            },
            "items": items,
            "total_amount": round(total_amount, 2),
            "payment_method": random.choice(["card", "cash", "online_wallet"]),
            "is_delivery": random.choice([True, False]),
            "delivery_address": customer["delivery_address"],
            "purchase_datetime": purchase_datetime,
        }

        _write_json(purchases_dir / f"{purchase_id}.json", payload)
        purchases_created += 1

    return GenerationResult(
        stores=len(stores),
        products=len(products),
        customers=len(customers),
        purchases=purchases_created,
    )
