from __future__ import annotations

import argparse
import json
import os
import random
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from faker import Faker


CATEGORIES = [
    "🥖 Зерновые и хлебобулочные изделия",
    "🥩 Мясо, рыба, яйца и бобовые",
    "🥛 Молочные продукты",
    "🍏 Фрукты и ягоды",
    "🥦 Овощи и зелень",
]

ALMOST_DESC = "Large format store, probably 200+ m². Part of a 30-store network."
MAYBE_DESC = "Neighborhood store, probably under 100 m². Part of a 15-store network."
UNITS = ["упаковка", "шт", "кг", "л", "булка"]
PRODUCT_NAMES = [
    "Творог 5%",
    "Хлеб ржаной",
    "Яйца куриные",
    "Молоко пастеризованное",
    "Яблоки сезонные",
    "Огурцы свежие",
    "Куриное филе",
    "Гречка ядрица",
    "Кефир 1%",
    "Батон нарезной",
]


def parse_seed() -> int:
    parser = argparse.ArgumentParser(description="Generate ProbablyFresh demo JSON dataset.")
    parser.add_argument("--seed", type=int, default=None, help="Random seed (overrides SEED env var).")
    args = parser.parse_args()

    if args.seed is not None:
        return args.seed

    raw_seed = os.getenv("SEED", "42").strip()
    try:
        return int(raw_seed)
    except ValueError as exc:
        raise ValueError(f"SEED must be an integer, got {raw_seed!r}") from exc


def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def iso_z(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def clean_json_files(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)
    for file_path in path.glob("*.json"):
        file_path.unlink()


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def random_phone() -> str:
    return f"+7-{random.randint(900, 999)}-{random.randint(100, 999)}-{random.randint(10, 99)}-{random.randint(10, 99)}"


def random_barcode() -> str:
    return "".join(str(random.randint(0, 9)) for _ in range(13))


def random_inn() -> str:
    return "".join(str(random.randint(0, 9)) for _ in range(10))


def generate_stores(fake: Faker, stores_dir: Path, base_date: datetime) -> list[dict[str, Any]]:
    stores: list[dict[str, Any]] = []
    specs = [
        ("ProbablyFresh Almost", 30, ALMOST_DESC),
        ("ProbablyFresh Maybe", 15, MAYBE_DESC),
    ]

    for network, count, description in specs:
        for _ in range(count):
            index = len(stores) + 1
            store_id = f"store-{index:03d}"
            city = fake.city()
            store = {
                "store_id": store_id,
                "store_name": f"{network} — {fake.street_name()}",
                "store_network": network,
                "store_type_description": description,
                "type": "offline",
                "categories": CATEGORIES,
                "manager": {
                    "name": fake.name(),
                    "phone": random_phone(),
                    "email": fake.email(),
                },
                "location": {
                    "country": "Россия",
                    "city": city,
                    "street": fake.street_name(),
                    "house": str(fake.building_number()),
                    "postal_code": fake.postcode(),
                    "coordinates": {
                        "latitude": round(float(fake.latitude()), 6),
                        "longitude": round(float(fake.longitude()), 6),
                    },
                },
                "opening_hours": {
                    "mon_fri": "09:00-21:00",
                    "sat": "10:00-20:00",
                    "sun": "10:00-18:00",
                },
                "accepts_online_orders": random.choice([True, False]),
                "delivery_available": random.choice([True, False]),
                "warehouse_connected": random.choice([True, False]),
                "last_inventory_date": (base_date - timedelta(days=random.randint(1, 60))).date().isoformat(),
            }
            stores.append(store)
            write_json(stores_dir / f"{store_id}.json", store)

    return stores


def generate_products(fake: Faker, products_dir: Path) -> list[dict[str, Any]]:
    products: list[dict[str, Any]] = []
    product_index = 1

    for category in CATEGORIES:
        for _ in range(20):
            product_id = f"prd-{product_index:04d}"
            product = {
                "id": product_id,
                "name": random.choice(PRODUCT_NAMES),
                "group": category,
                "description": fake.sentence(nb_words=8),
                "kbju": {
                    "calories": round(random.uniform(40, 350), 1),
                    "protein": round(random.uniform(0.2, 30), 1),
                    "fat": round(random.uniform(0.1, 30), 1),
                    "carbohydrates": round(random.uniform(0.2, 70), 1),
                },
                "price": round(random.uniform(20, 500), 2),
                "unit": random.choice(UNITS),
                "origin_country": random.choice(["Россия", "Беларусь", "Казахстан", "Армения"]),
                "expiry_days": random.randint(3, 180),
                "is_organic": random.choice([True, False]),
                "barcode": random_barcode(),
                "manufacturer": {
                    "name": fake.company(),
                    "country": "Россия",
                    "website": f"https://{fake.domain_name()}",
                    "inn": random_inn(),
                },
            }
            products.append(product)
            write_json(products_dir / f"{product_id}.json", product)
            product_index += 1

    return products


def generate_customers(
    fake: Faker, customers_dir: Path, stores: list[dict[str, Any]], base_date: datetime
) -> list[dict[str, Any]]:
    customers: list[dict[str, Any]] = []

    for store in stores:
        customers_per_store = random.randint(2, 5)
        for _ in range(customers_per_store):
            customer_id = f"cus-{len(customers) + 1:06d}"
            registration_dt = base_date - timedelta(days=random.randint(10, 900), minutes=random.randint(0, 1439))
            customer = {
                "customer_id": customer_id,
                "first_name": fake.first_name(),
                "last_name": fake.last_name(),
                "email": fake.email(),
                "phone": random_phone(),
                "birth_date": fake.date_of_birth(minimum_age=18, maximum_age=75).isoformat(),
                "gender": random.choice(["male", "female", "other", None]),
                "registration_date": iso_z(registration_dt),
                "is_loyalty_member": random.choice([True, False]),
                "loyalty_card_number": f"LOYAL-{random.randint(100000000, 999999999)}",
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
                    "country": "Россия",
                    "city": fake.city(),
                    "street": fake.street_name(),
                    "house": str(fake.building_number()),
                    "apartment": str(random.randint(1, 250)),
                    "postal_code": fake.postcode(),
                },
                "preferences": {
                    "preferred_language": "ru",
                    "preferred_payment_method": random.choice(["card", "cash", "online_wallet"]),
                    "receive_promotions": random.choice([True, False]),
                },
            }
            customers.append(customer)
            write_json(customers_dir / f"{customer_id}.json", customer)

    return customers


def generate_purchases(
    purchases_dir: Path,
    stores: list[dict[str, Any]],
    products: list[dict[str, Any]],
    customers: list[dict[str, Any]],
    base_date: datetime,
) -> list[dict[str, Any]]:
    purchases: list[dict[str, Any]] = []

    target_count = 200
    for index in range(1, target_count + 1):
        customer = customers[(index - 1) % len(customers)]
        store = random.choice(stores)
        line_count = random.randint(1, 3)
        chosen_products = random.sample(products, line_count)

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

        purchase_dt = base_date - timedelta(days=random.randint(0, 120), minutes=random.randint(0, 1439))
        is_delivery = random.choice([True, False])
        purchase = {
            "purchase_id": f"ord-{index:06d}",
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
            "is_delivery": is_delivery,
            "purchase_datetime": iso_z(purchase_dt),
        }

        if is_delivery:
            purchase["delivery_address"] = customer["delivery_address"]

        purchases.append(purchase)
        write_json(purchases_dir / f"ord-{index:06d}.json", purchase)

    return purchases


def self_check(stores: list[dict[str, Any]], products: list[dict[str, Any]], customers: list[dict[str, Any]], purchases: list[dict[str, Any]]) -> None:
    if len(stores) != 45:
        raise RuntimeError(f"Self-check failed: stores must be 45, got {len(stores)}")

    if len(products) != 100:
        raise RuntimeError(f"Self-check failed: products must be 100, got {len(products)}")

    grouped = Counter(product["group"] for product in products)
    for category in CATEGORIES:
        if grouped.get(category, 0) != 20:
            raise RuntimeError(
                f"Self-check failed: category {category!r} must contain 20 products, got {grouped.get(category, 0)}"
            )

    if len(customers) < 45:
        raise RuntimeError(f"Self-check failed: customers must be >= 45, got {len(customers)}")

    if len(purchases) < 200:
        raise RuntimeError(f"Self-check failed: purchases must be >= 200, got {len(purchases)}")


def main() -> None:
    seed = parse_seed()
    random.seed(seed)

    fake = Faker("ru_RU")
    Faker.seed(seed)
    fake.seed_instance(seed)

    root = project_root()
    data_root = root / "data"
    stores_dir = data_root / "stores"
    products_dir = data_root / "products"
    customers_dir = data_root / "customers"
    purchases_dir = data_root / "purchases"

    for folder in (stores_dir, products_dir, customers_dir, purchases_dir):
        clean_json_files(folder)

    base_date = datetime(2025, 7, 10, 12, 0, 0, tzinfo=timezone.utc)
    stores = generate_stores(fake, stores_dir, base_date)
    products = generate_products(fake, products_dir)
    customers = generate_customers(fake, customers_dir, stores, base_date)
    purchases = generate_purchases(purchases_dir, stores, products, customers, base_date)

    self_check(stores, products, customers, purchases)
    print(
        f"Generated: stores={len(stores)}, products={len(products)}, "
        f"customers={len(customers)}, purchases={len(purchases)}, seed={seed}"
    )


if __name__ == "__main__":
    main()
