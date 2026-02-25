from __future__ import annotations

from datetime import timedelta

import pendulum
from airflow import DAG
from airflow.operators.bash import BashOperator

LOCAL_TZ = pendulum.timezone("Europe/Moscow")
DOCKER_COMPOSE = "docker compose --env-file /workspace/.env -f /workspace/docker-compose.yml"

RESOLVE_APP_CONTAINER = f"""
if docker compose version >/dev/null 2>&1; then
  APP_CID=$({DOCKER_COMPOSE} ps -q app)
else
  PROJECT_NAME=$(grep -E '^PROJECT_NAME=' /workspace/.env | cut -d= -f2- | tr -d '\\r' || true)
  if [ -z "$PROJECT_NAME" ]; then
    PROJECT_NAME="probablyfresh-analytics-platform"
  fi
  APP_CID=$(docker ps \
    --filter "label=com.docker.compose.project=$PROJECT_NAME" \
    --filter "label=com.docker.compose.service=app" \
    -q \
    | head -n 1)
fi
if [ -z "$APP_CID" ]; then
  echo "ERROR: app container is not found. Ensure service 'app' is running."
  exit 1
fi
echo "Resolved app container id: $APP_CID"
"""

WAIT_CLICKHOUSE_CMD = f"""
set -euo pipefail
{RESOLVE_APP_CONTAINER}

for i in $(seq 1 30); do
  if docker exec "$APP_CID" sh -lc "curl -fsS http://clickhouse:8123/ping | grep -q '^Ok\\\\.$'"; then
    echo "ClickHouse ping is OK"
    exit 0
  fi
  echo "ClickHouse is not ready yet ($i/30), sleeping 5s..."
  sleep 5
done

echo "ERROR: ClickHouse did not become ready in time"
exit 1
"""

RUN_ETL_CMD = f"""
set -euo pipefail
{RESOLVE_APP_CONTAINER}

echo "Starting ETL inside app container..."
docker exec "$APP_CID" sh -lc "cd /workspace && python jobs/features_etl.py"
echo "ETL finished successfully"
"""

VERIFY_MINIO_CMD = f"""
set -euo pipefail
{RESOLVE_APP_CONTAINER}

echo "Verifying daily ETL object in MinIO/S3..."
cat <<'PY' | docker exec -i "$APP_CID" python -
from datetime import datetime, timezone
import csv
import os

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv("/workspace/.env")

def required_any(*names: str) -> str:
    for name in names:
        value = os.getenv(name, "").strip()
        if value:
            return value
    raise RuntimeError(f"One of environment variables {{names}} is required")

def optional_any(default: str, *names: str) -> str:
    for name in names:
        value = os.getenv(name)
        if value is not None and value.strip():
            return value.strip()
    return default

endpoint = required_any("MINIO_ENDPOINT", "S3_ENDPOINT_URL")
if not endpoint.startswith(("http://", "https://")):
    endpoint = f"https://{{endpoint}}"

region = optional_any("ru-3", "MINIO_REGION", "S3_REGION")
bucket = required_any("MINIO_BUCKET", "S3_BUCKET")
access_key = required_any("MINIO_ACCESS_KEY", "S3_ACCESS_KEY")
secret_key = required_any("MINIO_SECRET_KEY", "S3_SECRET_KEY")
prefix = optional_any("", "MINIO_OBJECT_PREFIX", "S3_OBJECT_PREFIX").strip("/")

object_name = f"analytic_result_{{datetime.now(timezone.utc):%Y_%m_%d}}.csv"
object_key = f"{{prefix}}/{{object_name}}" if prefix else object_name
print(f"Expected object: s3://{{bucket}}/{{object_key}}")

client = boto3.client(
    "s3",
    endpoint_url=endpoint,
    region_name=region,
    aws_access_key_id=access_key,
    aws_secret_access_key=secret_key,
)

try:
    head = client.head_object(Bucket=bucket, Key=object_key)
except ClientError as exc:
    raise SystemExit(f"Object not found: s3://{{bucket}}/{{object_key}}; {{exc}}")

size = int(head.get("ContentLength", 0))
print(f"Object size: {{size}} bytes")
if size <= 1024:
    raise SystemExit(f"Object size is too small (<=1KB): {{size}}")

obj = client.get_object(Bucket=bucket, Key=object_key)
lines = []
for raw in obj["Body"].iter_lines():
    if raw is None:
        continue
    line = raw.decode("utf-8-sig").strip()
    if not line:
        continue
    lines.append(line)
    if len(lines) >= 6:
        break
obj["Body"].close()

if len(lines) < 6:
    raise SystemExit("CSV must contain header + 5 rows at minimum")

parsed = list(csv.reader(lines))
header = parsed[0]
rows = parsed[1:6]

if len(header) != 31:
    raise SystemExit(f"Header column count must be 31, got {{len(header)}}")

for i, row in enumerate(rows, start=1):
    if len(row) != 31:
        raise SystemExit(f"Row #{{i}} column count must be 31, got {{len(row)}}")
    if not row[0].strip():
        raise SystemExit(f"Row #{{i}} has empty customer_id")
    bad_values = [value for value in row[1:] if value not in ("0", "1")]
    if bad_values:
        raise SystemExit(f"Row #{{i}} contains non-binary feature values: {{bad_values}}")

print("verify_minio: object exists, size > 1KB, CSV shape and feature values are valid")
PY
"""

with DAG(
    dag_id="etl_to_s3_daily",
    description="Daily ETL to S3 with ClickHouse availability and object verification checks",
    schedule="0 10 * * *",
    start_date=pendulum.datetime(2026, 1, 1, tz=LOCAL_TZ),
    catchup=False,
    max_active_runs=1,
    default_args={
        "owner": "probablyfresh",
        "depends_on_past": False,
        "retries": 1,
        "retry_delay": timedelta(minutes=5),
    },
    tags=["probablyfresh", "etl", "s3", "daily"],
) as dag:
    wait_clickhouse = BashOperator(
        task_id="wait_clickhouse",
        bash_command=WAIT_CLICKHOUSE_CMD,
    )

    run_etl = BashOperator(
        task_id="run_etl",
        bash_command=RUN_ETL_CMD,
    )

    verify_minio = BashOperator(
        task_id="verify_minio",
        bash_command=VERIFY_MINIO_CMD,
    )

    wait_clickhouse >> run_etl >> verify_minio
