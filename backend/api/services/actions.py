from __future__ import annotations

import json
import os
import re
import subprocess
import threading
import uuid
from pathlib import Path
from time import sleep
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError
import requests
from django.db import transaction
from django.utils import timezone

from api.models import ExportAudit, JobRun
from api.services.clickhouse import execute_sql, ping as clickhouse_ping
from api.services.errors import ServiceError
from api.services.settings import env_int, env_str
from api.services.storage import (
    storage_access_key,
    storage_bucket,
    storage_endpoint,
    storage_region,
    storage_secret_key,
)

ALLOWED_ACTIONS = {
    JobRun.JobName.GENERATE_DATA,
    JobRun.JobName.LOAD_NOSQL,
    JobRun.JobName.RUN_PRODUCER,
    JobRun.JobName.MART_REFRESH,
    JobRun.JobName.RUN_ETL,
    JobRun.JobName.TRIGGER_AIRFLOW_DAG,
}


def _job_workdir() -> Path:
    return Path(env_str("JOB_WORKDIR", "/workspace")).resolve()


def _job_timeout_seconds() -> int:
    return env_int("JOB_TIMEOUT_SECONDS", 1800)


def _logs_dir() -> Path:
    logs_dir = _job_workdir() / "backend" / "run_logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    return logs_dir


def _tail_text(text: str | None, max_lines: int = 40, max_chars: int = 8000) -> str:
    if not text:
        return ""
    lines = text.strip().splitlines()
    tail = "\n".join(lines[-max_lines:])
    return tail[-max_chars:]


_UPLOADED_FILE_PATTERN = re.compile(r"Uploaded features file:\s*(?P<key>\S+)")


def enqueue_action(job_name: str, params: dict[str, Any] | None, requested_by: str | None = None) -> JobRun:
    if job_name not in ALLOWED_ACTIONS:
        raise ServiceError("ACTION_UNKNOWN", f"Unsupported action '{job_name}'.", 400)

    with transaction.atomic():
        run = JobRun.objects.create(
            job_name=job_name,
            status=JobRun.Status.QUEUED,
            requested_by=requested_by or None,
            params_json=params or {},
        )

    thread = threading.Thread(target=_execute_job_run, args=(str(run.id),), daemon=True)
    thread.start()
    return run


def _execute_job_run(run_id: str) -> None:
    run = JobRun.objects.filter(id=run_id).first()
    if not run:
        return

    run.status = JobRun.Status.RUNNING
    run.started_at = timezone.now()
    run.save(update_fields=["status", "started_at"])

    stdout_text = ""
    stderr_text = ""
    error_message = ""
    status = JobRun.Status.SUCCESS

    try:
        if run.job_name == JobRun.JobName.TRIGGER_AIRFLOW_DAG:
            stdout_text = _trigger_airflow_dag(run)
        elif run.job_name == JobRun.JobName.MART_REFRESH:
            stdout_text = _refresh_mart(run)
        else:
            command = _build_command(run.job_name, run.params_json or {})
            stdout_text, stderr_text, returncode = _run_subprocess(command)
            if returncode != 0:
                status = JobRun.Status.FAILED
                error_message = f"Command exited with code {returncode}"
    except ServiceError as exc:
        status = JobRun.Status.FAILED
        error_message = exc.message
        if exc.details:
            details_json = json.dumps(exc.details, ensure_ascii=True)
            stderr_text = f"{stderr_text}\n{details_json}" if stderr_text else details_json
    except Exception as exc:  # noqa: BLE001
        status = JobRun.Status.FAILED
        error_message = str(exc)

    if run.job_name == JobRun.JobName.RUN_ETL:
        _record_export_audit_for_etl(
            run=run,
            status=status,
            stdout_text=stdout_text,
            stderr_text=stderr_text,
            error_message=error_message,
        )

    finished_at = timezone.now()
    log_path = _write_run_log(run.id, run.job_name, stdout_text, stderr_text, error_message)
    stdout_tail = _tail_text(stdout_text)
    stderr_tail = _tail_text(stderr_text)

    run.status = status
    run.finished_at = finished_at
    run.stdout_tail = stdout_tail
    run.stderr_tail = stderr_tail
    run.error_message = error_message or None
    run.log_path = str(log_path)
    run.update_duration()
    run.save(
        update_fields=[
            "status",
            "finished_at",
            "stdout_tail",
            "stderr_tail",
            "error_message",
            "log_path",
            "duration_ms",
        ]
    )


def _build_command(job_name: str, params: dict[str, Any]) -> str:
    if job_name == JobRun.JobName.GENERATE_DATA:
        seed = params.get("seed")
        if seed is not None:
            return f"python src/generator/generate_data.py --seed {int(seed)}"
        return "python src/generator/generate_data.py"
    if job_name == JobRun.JobName.LOAD_NOSQL:
        return "python src/loader/load_to_mongo.py"
    if job_name == JobRun.JobName.RUN_PRODUCER:
        return "python src/streaming/produce_from_mongo.py --once"
    if job_name == JobRun.JobName.RUN_ETL:
        return "python jobs/features_etl.py"
    raise ServiceError("ACTION_BUILD_FAILED", f"No command mapping for '{job_name}'.", 400)


def _run_subprocess(command: str) -> tuple[str, str, int]:
    popen_kwargs = {
        "cwd": _job_workdir(),
        "stdout": subprocess.PIPE,
        "stderr": subprocess.PIPE,
        "text": True,
        "shell": True,
        "env": os.environ.copy(),
    }
    if os.name != "nt":
        popen_kwargs["executable"] = "/bin/bash"

    process = subprocess.Popen(command, **popen_kwargs)  # noqa: S603
    try:
        stdout_text, stderr_text = process.communicate(timeout=_job_timeout_seconds())
    except subprocess.TimeoutExpired:
        process.kill()
        stdout_text, stderr_text = process.communicate()
        stderr_text = f"{stderr_text}\nTimed out after {_job_timeout_seconds()} seconds."
        return stdout_text, stderr_text, 124
    return stdout_text, stderr_text, process.returncode


def _s3_client():
    return boto3.client(
        "s3",
        endpoint_url=storage_endpoint() or None,
        aws_access_key_id=storage_access_key() or None,
        aws_secret_access_key=storage_secret_key() or None,
        region_name=storage_region(),
    )


def _extract_uploaded_key(stdout_text: str, params_json: dict[str, Any] | None) -> str:
    matches = _UPLOADED_FILE_PATTERN.findall(stdout_text or "")
    if matches:
        return matches[-1]

    if isinstance(params_json, dict):
        for key in ("object_key", "s3_key", "export_key"):
            value = params_json.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()

    return ""


def _record_export_audit_for_etl(
    *,
    run: JobRun,
    status: str,
    stdout_text: str,
    stderr_text: str,
    error_message: str,
) -> None:
    object_key = _extract_uploaded_key(stdout_text, run.params_json)
    bucket = storage_bucket()
    default_key = object_key or f"run-etl/{run.id}.csv"
    filename = default_key.split("/")[-1]

    if status != JobRun.Status.SUCCESS:
        ExportAudit.objects.create(
            storage_provider="s3",
            bucket=bucket,
            object_key=default_key,
            filename=filename,
            size_bytes=0,
            status=ExportAudit.Status.FAILED,
            error_message=(error_message or _tail_text(stderr_text, max_lines=10, max_chars=400))[:500],
            job_run=run,
        )
        return

    if not object_key:
        ExportAudit.objects.create(
            storage_provider="s3",
            bucket=bucket,
            object_key=default_key,
            filename=filename,
            size_bytes=0,
            status=ExportAudit.Status.FAILED,
            error_message="ETL completed but object key was not detected in stdout.",
            job_run=run,
        )
        return

    try:
        head = _s3_client().head_object(Bucket=bucket, Key=object_key)
        ExportAudit.objects.create(
            storage_provider="s3",
            bucket=bucket,
            object_key=object_key,
            filename=object_key.split("/")[-1],
            rows_count=None,
            size_bytes=int(head.get("ContentLength", 0) or 0),
            etag=str(head.get("ETag", "")).strip('"') or None,
            status=ExportAudit.Status.UPLOADED,
            job_run=run,
        )
    except (BotoCoreError, ClientError, ValueError) as exc:
        ExportAudit.objects.create(
            storage_provider="s3",
            bucket=bucket,
            object_key=object_key,
            filename=object_key.split("/")[-1],
            size_bytes=0,
            status=ExportAudit.Status.FAILED,
            error_message=f"Unable to head_object for ETL export: {str(exc)[:450]}",
            job_run=run,
        )


def _refresh_mart(run: JobRun) -> str:
    sql_path = _job_workdir() / "docker" / "clickhouse" / "init" / "02_mart.sql"
    if not sql_path.exists():
        raise ServiceError("MART_SQL_MISSING", f"File not found: {sql_path}", 500)
    sql = sql_path.read_text(encoding="utf-8")

    # Wait for ClickHouse readiness similar to existing shell workflow.
    for _ in range(10):
        try:
            clickhouse_ping(timeout=2)
            break
        except Exception:  # noqa: BLE001
            sleep(2)
    else:
        raise ServiceError("CLICKHOUSE_UNAVAILABLE", "ClickHouse is not ready for mart-refresh.", 503)

    execute_sql(sql=sql, database=env_str("CLICKHOUSE_DB_MART", env_str("CH_DATABASE", "probablyfresh_mart")), timeout=120)
    return "MART refresh SQL executed successfully."


def _trigger_airflow_dag(run: JobRun) -> str:
    base_url = env_str("AIRFLOW_BASE_URL", "http://airflow:8080").rstrip("/")
    dag_id = env_str("AIRFLOW_DAG_ID", "etl_to_s3_daily")
    user = env_str("AIRFLOW_USER", env_str("AIRFLOW_ADMIN_USER", "admin"))
    password = env_str("AIRFLOW_PASSWORD", env_str("AIRFLOW_ADMIN_PASSWORD", "admin"))

    dag_run_id = f"ui__{timezone.now().strftime('%Y%m%dT%H%M%S')}__{uuid.uuid4().hex[:8]}"
    payload = {
        "dag_run_id": dag_run_id,
        "conf": run.params_json.get("dag_conf", run.params_json if isinstance(run.params_json, dict) else {}),
    }

    response = requests.post(
        f"{base_url}/api/v1/dags/{dag_id}/dagRuns",
        auth=(user, password) if user else None,
        json=payload,
        timeout=20,
    )
    if response.status_code >= 300:
        raise ServiceError(
            "AIRFLOW_TRIGGER_FAILED",
            f"Airflow trigger failed with status {response.status_code}",
            502,
            details={"body": response.text[:500]},
        )

    response_json = response.json() if response.text else {}
    run.params_json = {
        **(run.params_json or {}),
        "airflow_dag_id": dag_id,
        "airflow_dag_run_id": response_json.get("dag_run_id", dag_run_id),
    }
    run.save(update_fields=["params_json"])
    return json.dumps(response_json, ensure_ascii=True)


def _write_run_log(run_id, job_name: str, stdout_text: str, stderr_text: str, error_message: str) -> Path:
    log_path = _logs_dir() / f"{run_id}_{job_name}.log"
    payload = [
        f"job_name={job_name}",
        f"run_id={run_id}",
        "",
        "===== STDOUT =====",
        stdout_text or "",
        "",
        "===== STDERR =====",
        stderr_text or "",
    ]
    if error_message:
        payload.extend(["", "===== ERROR =====", error_message])
    log_path.write_text("\n".join(payload), encoding="utf-8")
    return log_path
