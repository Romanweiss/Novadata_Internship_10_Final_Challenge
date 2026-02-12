from probablyfresh.config import get_settings
from probablyfresh.integrations.kafka_producer import publish_raw_events


if __name__ == "__main__":
    settings = get_settings()
    counters = publish_raw_events(settings)
    print("Published events to Kafka topics:", counters)
