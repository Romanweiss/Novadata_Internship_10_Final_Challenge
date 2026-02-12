from __future__ import annotations

import time

import requests

from probablyfresh.config import get_settings


if __name__ == "__main__":
    settings = get_settings()
    health_url = f"http://localhost:{settings.grafana_port}/api/health"

    for attempt in range(1, 31):
        try:
            response = requests.get(health_url, timeout=2)
            if response.ok:
                print("Grafana is healthy. Provisioned dashboard and datasource are mounted from infra/grafana.")
                break
        except requests.RequestException:
            pass

        if attempt == 30:
            raise RuntimeError("Grafana health check failed after 30 attempts")

        time.sleep(2)
