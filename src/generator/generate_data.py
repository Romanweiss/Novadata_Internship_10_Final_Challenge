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
PRODUCT_NAMES_BY_CATEGORY = {
    CATEGORIES[0]: [
        "Батон нарезной",
        "Хлеб ржаной",
        "Гречка ядрица",
        "Рис длиннозерный",
        "Овсяные хлопья",
        "Макароны из твердых сортов",
        "Булгур",
        "Кускус",
        "Пшено",
        "Перловка",
        "Хлеб цельнозерновой",
        "Лаваш тонкий",
        "Сушки ванильные",
        "Хлебцы ржаные",
        "Мука пшеничная",
        "Крупа манная",
        "Рис круглозерный",
        "Спагетти",
        "Вермишель",
        "Гранола классическая",
    ],
    CATEGORIES[1]: [
        "Куриное филе",
        "Яйца куриные",
        "Филе индейки",
        "Фарш говяжий",
        "Филе трески",
        "Лосось охлажденный",
        "Говядина для тушения",
        "Свинина лопатка",
        "Печень куриная",
        "Котлеты из индейки",
        "Фасоль красная",
        "Нут сухой",
        "Чечевица зеленая",
        "Тунец консервированный",
        "Сардины в масле",
        "Крабовые палочки",
        "Креветки очищенные",
        "Яйца перепелиные",
        "Горох колотый",
        "Тофу натуральный",
    ],
    CATEGORIES[2]: [
        "Творог 5%",
        "Молоко пастеризованное",
        "Кефир 1%",
        "Сметана 15%",
        "Йогурт натуральный",
        "Ряженка 2.5%",
        "Сливки 10%",
        "Сыр гауда",
        "Сыр моцарелла",
        "Сыр творожный",
        "Масло сливочное 82.5%",
        "Молоко ультрапастеризованное",
        "Кефир 2.5%",
        "Йогурт греческий",
        "Творог зерненый",
        "Снежок классический",
        "Ацидофилин",
        "Сметана 20%",
        "Простокваша",
        "Сыр российский",
    ],
    CATEGORIES[3]: [
        "Яблоки сезонные",
        "Бананы",
        "Груши",
        "Апельсины",
        "Клубника свежая",
        "Мандарины",
        "Лимоны",
        "Киви",
        "Виноград белый",
        "Виноград красный",
        "Черника",
        "Малина",
        "Ежевика",
        "Персики",
        "Нектарины",
        "Сливы",
        "Гранат",
        "Ананас",
        "Манго",
        "Черешня",
    ],
    CATEGORIES[4]: [
        "Огурцы свежие",
        "Томаты сливовидные",
        "Картофель молодой",
        "Морковь мытая",
        "Салат листовой",
        "Капуста белокочанная",
        "Капуста брокколи",
        "Цветная капуста",
        "Свекла",
        "Лук репчатый",
        "Лук зеленый",
        "Чеснок",
        "Кабачки",
        "Баклажаны",
        "Перец сладкий",
        "Редис",
        "Шпинат",
        "Руккола",
        "Укроп свежий",
        "Петрушка свежая",
    ],
}

PRODUCT_DESCRIPTION_BY_NAME = {
    "Творог 5%": [
        "Натуральный творог 5% жирности из коровьего молока.",
        "Классический творог 5%: мягкий вкус и нежная текстура.",
    ],
    "Хлеб ржаной": [
        "Ароматный ржаной хлеб на натуральной закваске.",
        "Ржаной хлеб с плотным мякишем и насыщенным вкусом.",
    ],
    "Яйца куриные": [
        "Свежие куриные яйца категории С1 для ежедневного рациона.",
        "Куриные яйца с чистой скорлупой и отборным качеством.",
    ],
    "Молоко пастеризованное": [
        "Пастеризованное молоко с мягким сливочным вкусом.",
        "Натуральное пастеризованное молоко для каш и напитков.",
    ],
    "Яблоки сезонные": [
        "Сочные сезонные яблоки с приятной кисло-сладкой ноткой.",
        "Свежие сезонные яблоки для перекуса и выпечки.",
    ],
    "Огурцы свежие": [
        "Хрустящие свежие огурцы, собранные в сезон.",
        "Свежие огурцы с тонкой кожицей для салатов и закусок.",
    ],
    "Куриное филе": [
        "Охлаждённое куриное филе без кожи и лишнего жира.",
        "Нежное куриное филе для запекания и обжарки.",
    ],
    "Гречка ядрица": [
        "Гречка ядрица высшего качества, быстро и равномерно варится.",
        "Отборная гречка ядрица с насыщенным вкусом и ароматом.",
    ],
    "Кефир 1%": [
        "Кефир 1% жирности с мягким кисломолочным вкусом.",
        "Лёгкий кефир 1% для сбалансированного рациона.",
    ],
    "Батон нарезной": [
        "Батон из пшеничной муки 1 сорта.",
        "Свежий нарезной батон с мягким мякишем и хрустящей корочкой.",
    ],
    "Рис длиннозерный": [
        "Длиннозерный рис с рассыпчатой текстурой после варки.",
    ],
    "Овсяные хлопья": [
        "Овсяные хлопья быстрого приготовления для каш и выпечки.",
    ],
    "Филе индейки": [
        "Нежное филе индейки с высоким содержанием белка.",
    ],
    "Фарш говяжий": [
        "Охлаждённый говяжий фарш для котлет и соусов.",
    ],
    "Филе трески": [
        "Филе трески без костей для запекания и тушения.",
    ],
    "Сметана 15%": [
        "Классическая сметана 15% с мягким сливочным вкусом.",
    ],
    "Йогурт натуральный": [
        "Натуральный йогурт без добавок для полезного перекуса.",
    ],
    "Бананы": [
        "Спелые бананы с мягкой сладостью и кремовой текстурой.",
    ],
    "Груши": [
        "Сочные груши с деликатным ароматом и сладким вкусом.",
    ],
    "Апельсины": [
        "Апельсины с ярким цитрусовым вкусом и сочной мякотью.",
    ],
    "Клубника свежая": [
        "Свежая клубника с насыщенным ягодным ароматом.",
    ],
    "Томаты сливовидные": [
        "Сливовидные томаты с плотной мякотью для салатов и соусов.",
    ],
    "Картофель молодой": [
        "Молодой картофель с тонкой кожицей и нежным вкусом.",
    ],
    "Морковь мытая": [
        "Мытая морковь для супов, гарниров и свежих салатов.",
    ],
    "Салат листовой": [
        "Листовой салат с нежными хрустящими листьями.",
    ],
}

PRODUCT_UNIT_BY_NAME = {
    # Зерновые и хлебобулочные изделия
    "Батон нарезной": "шт",
    "Хлеб ржаной": "шт",
    "Гречка ядрица": "кг",
    "Рис длиннозерный": "кг",
    "Овсяные хлопья": "кг",
    "Макароны из твердых сортов": "кг",
    "Булгур": "кг",
    "Кускус": "кг",
    "Пшено": "кг",
    "Перловка": "кг",
    "Хлеб цельнозерновой": "шт",
    "Лаваш тонкий": "шт",
    "Сушки ванильные": "упаковка",
    "Хлебцы ржаные": "упаковка",
    "Мука пшеничная": "кг",
    "Крупа манная": "кг",
    "Рис круглозерный": "кг",
    "Спагетти": "упаковка",
    "Вермишель": "упаковка",
    "Гранола классическая": "упаковка",
    # Мясо, рыба, яйца и бобовые
    "Куриное филе": "кг",
    "Яйца куриные": "упаковка",
    "Филе индейки": "кг",
    "Фарш говяжий": "кг",
    "Филе трески": "кг",
    "Лосось охлажденный": "кг",
    "Говядина для тушения": "кг",
    "Свинина лопатка": "кг",
    "Печень куриная": "кг",
    "Котлеты из индейки": "упаковка",
    "Фасоль красная": "кг",
    "Нут сухой": "кг",
    "Чечевица зеленая": "кг",
    "Тунец консервированный": "упаковка",
    "Сардины в масле": "упаковка",
    "Крабовые палочки": "упаковка",
    "Креветки очищенные": "упаковка",
    "Яйца перепелиные": "упаковка",
    "Горох колотый": "кг",
    "Тофу натуральный": "упаковка",
    # Молочные продукты
    "Творог 5%": "упаковка",
    "Молоко пастеризованное": "л",
    "Кефир 1%": "л",
    "Сметана 15%": "упаковка",
    "Йогурт натуральный": "упаковка",
    "Ряженка 2.5%": "л",
    "Сливки 10%": "л",
    "Сыр гауда": "кг",
    "Сыр моцарелла": "кг",
    "Сыр творожный": "упаковка",
    "Масло сливочное 82.5%": "упаковка",
    "Молоко ультрапастеризованное": "л",
    "Кефир 2.5%": "л",
    "Йогурт греческий": "упаковка",
    "Творог зерненый": "упаковка",
    "Снежок классический": "л",
    "Ацидофилин": "л",
    "Сметана 20%": "упаковка",
    "Простокваша": "л",
    "Сыр российский": "кг",
    # Фрукты и ягоды
    "Яблоки сезонные": "кг",
    "Бананы": "кг",
    "Груши": "кг",
    "Апельсины": "кг",
    "Клубника свежая": "кг",
    "Мандарины": "кг",
    "Лимоны": "кг",
    "Киви": "кг",
    "Виноград белый": "кг",
    "Виноград красный": "кг",
    "Черника": "упаковка",
    "Малина": "упаковка",
    "Ежевика": "упаковка",
    "Персики": "кг",
    "Нектарины": "кг",
    "Сливы": "кг",
    "Гранат": "шт",
    "Ананас": "шт",
    "Манго": "шт",
    "Черешня": "кг",
    # Овощи и зелень
    "Огурцы свежие": "кг",
    "Томаты сливовидные": "кг",
    "Картофель молодой": "кг",
    "Морковь мытая": "кг",
    "Салат листовой": "упаковка",
    "Капуста белокочанная": "кг",
    "Капуста брокколи": "кг",
    "Цветная капуста": "кг",
    "Свекла": "кг",
    "Лук репчатый": "кг",
    "Лук зеленый": "упаковка",
    "Чеснок": "кг",
    "Кабачки": "кг",
    "Баклажаны": "кг",
    "Перец сладкий": "кг",
    "Редис": "упаковка",
    "Шпинат": "упаковка",
    "Руккола": "упаковка",
    "Укроп свежий": "упаковка",
    "Петрушка свежая": "упаковка",
}

CATEGORY_ORIGIN_COUNTRIES = {
    CATEGORIES[0]: ["Россия", "Казахстан", "Беларусь", "Армения", "Турция"],
    CATEGORIES[1]: ["Россия", "Беларусь", "Казахстан", "Армения", "Бразилия"],
    CATEGORIES[2]: ["Россия", "Беларусь", "Казахстан", "Армения", "Сербия"],
    CATEGORIES[3]: ["Россия", "Турция", "Азербайджан", "Молдова", "Узбекистан", "Сербия"],
    CATEGORIES[4]: ["Россия", "Узбекистан", "Азербайджан", "Казахстан", "Турция", "Армения"],
}

PRODUCT_ORIGIN_COUNTRIES_BY_NAME = {
    # Зерновые и хлебобулочные изделия
    "Спагетти": ["Италия", "Россия", "Казахстан"],
    "Макароны из твердых сортов": ["Италия", "Россия", "Казахстан"],
    "Кускус": ["Турция", "Марокко", "Россия"],
    "Булгур": ["Турция", "Россия", "Казахстан"],
    "Гранола классическая": ["Россия", "Германия", "Польша"],
    # Мясо, рыба, яйца и бобовые
    "Лосось охлажденный": ["Норвегия", "Чили", "Россия"],
    "Филе трески": ["Россия", "Норвегия", "Исландия"],
    "Тунец консервированный": ["Таиланд", "Вьетнам", "Испания"],
    "Сардины в масле": ["Португалия", "Марокко", "Испания"],
    "Крабовые палочки": ["Россия", "Южная Корея", "Китай"],
    "Креветки очищенные": ["Индия", "Вьетнам", "Эквадор"],
    "Тофу натуральный": ["Китай", "Вьетнам", "Россия"],
    # Молочные продукты
    "Сыр гауда": ["Россия", "Беларусь", "Нидерланды"],
    "Сыр моцарелла": ["Россия", "Беларусь", "Италия"],
    "Сыр творожный": ["Россия", "Беларусь", "Сербия"],
    "Сыр российский": ["Россия", "Беларусь", "Казахстан"],
    # Фрукты и ягоды
    "Бананы": ["Эквадор", "Колумбия", "Коста-Рика", "Филиппины"],
    "Манго": ["Индия", "Пакистан", "Перу", "Бразилия"],
    "Ананас": ["Коста-Рика", "Филиппины", "Таиланд"],
    "Апельсины": ["Египет", "Турция", "Марокко", "ЮАР"],
    "Лимоны": ["Турция", "Аргентина", "Египет", "Узбекистан"],
    "Мандарины": ["Турция", "Марокко", "Египет", "Китай"],
    "Киви": ["Иран", "Турция", "Новая Зеландия"],
    "Виноград белый": ["Узбекистан", "Турция", "Молдова"],
    "Виноград красный": ["Узбекистан", "Турция", "Молдова"],
    "Клубника свежая": ["Россия", "Сербия", "Турция"],
    "Черника": ["Россия", "Беларусь", "Сербия"],
    "Малина": ["Россия", "Сербия", "Польша"],
    "Ежевика": ["Сербия", "Польша", "Россия"],
    "Черешня": ["Россия", "Турция", "Узбекистан"],
    # Овощи и зелень
    "Огурцы свежие": ["Россия", "Узбекистан", "Турция"],
    "Томаты сливовидные": ["Россия", "Узбекистан", "Азербайджан", "Турция"],
    "Перец сладкий": ["Россия", "Турция", "Узбекистан"],
    "Баклажаны": ["Россия", "Турция", "Азербайджан"],
    "Шпинат": ["Россия", "Турция", "Узбекистан"],
    "Руккола": ["Россия", "Италия", "Турция"],
}


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


def product_description(name: str, category: str) -> str:
    by_name = PRODUCT_DESCRIPTION_BY_NAME.get(name)
    if by_name:
        return by_name[0]

    normalized = category.lower()
    if "молоч" in normalized:
        return f"{name} — натуральный молочный продукт для ежедневного рациона."
    if "зернов" in normalized or "хлеб" in normalized:
        return f"{name} — продукт из злаков с насыщенным вкусом и ароматом."
    if "мясо" in normalized or "рыб" in normalized or "яйц" in normalized:
        return f"{name} — белковый продукт для полноценного и сбалансированного питания."
    if "фрукт" in normalized or "ягод" in normalized:
        return f"{name} — свежий фруктовый продукт с натуральным вкусом."
    if "овощ" in normalized or "зелень" in normalized:
        return f"{name} — свежий овощной продукт для салатов и гарниров."
    return f"{name} — качественный продукт для ежедневного рациона."


def pick_product_names_for_category(category: str, count: int) -> list[str]:
    names_pool = PRODUCT_NAMES_BY_CATEGORY.get(category, [])
    if not names_pool:
        names_pool = list(PRODUCT_DESCRIPTION_BY_NAME.keys())

    if count <= len(names_pool):
        # Prefer unique names inside category to minimize duplicates.
        return random.sample(names_pool, count)

    # Fallback if the pool is smaller than requested count.
    selected = list(names_pool)
    while len(selected) < count:
        selected.append(random.choice(names_pool))
    random.shuffle(selected)
    return selected[:count]


def product_unit(name: str, category: str) -> str:
    unit = PRODUCT_UNIT_BY_NAME.get(name)
    if unit:
        return unit

    normalized = category.lower()
    if "молоч" in normalized:
        return "л"
    if "мясо" in normalized or "рыб" in normalized:
        return "кг"
    if "фрукт" in normalized or "ягод" in normalized or "овощ" in normalized:
        return "кг"
    return "шт"


def product_origin_countries(name: str, category: str) -> list[str]:
    by_name = PRODUCT_ORIGIN_COUNTRIES_BY_NAME.get(name)
    if by_name:
        return by_name

    by_category = CATEGORY_ORIGIN_COUNTRIES.get(category)
    if by_category:
        return by_category

    return ["Россия", "Беларусь", "Казахстан", "Армения"]


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
        category_names = pick_product_names_for_category(category, 20)
        for product_name in category_names:
            product_id = f"prd-{product_index:04d}"
            # Preserve RNG progression for downstream generators (customers/purchases).
            _ = random.choice(UNITS)
            product = {
                "id": product_id,
                "name": product_name,
                "group": category,
                "description": product_description(product_name, category),
                "kbju": {
                    "calories": round(random.uniform(40, 350), 1),
                    "protein": round(random.uniform(0.2, 30), 1),
                    "fat": round(random.uniform(0.1, 30), 1),
                    "carbohydrates": round(random.uniform(0.2, 70), 1),
                },
                "price": round(random.uniform(20, 500), 2),
                "unit": product_unit(product_name, category),
                "origin_country": random.choice(product_origin_countries(product_name, category)),
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
                    "preferred_payment_method": random.choice(["card", "cash", "sbp"]),
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
            "payment_method": random.choice(["card", "cash", "sbp"]),
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
