from probablyfresh.config import get_settings
from probablyfresh.integrations.mongo_loader import load_to_mongodb


if __name__ == "__main__":
    settings = get_settings()
    counters = load_to_mongodb(settings)
    print("Loaded JSON into MongoDB:", counters)
