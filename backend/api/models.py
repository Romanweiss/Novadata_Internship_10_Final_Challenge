from __future__ import annotations

import uuid
from datetime import timedelta

from django.db import models
from django.utils import timezone


class JobRun(models.Model):
    class JobName(models.TextChoices):
        GENERATE_DATA = "generate-data", "generate-data"
        LOAD_NOSQL = "load-nosql", "load-nosql"
        RUN_PRODUCER = "run-producer", "run-producer"
        MART_REFRESH = "mart-refresh", "mart-refresh"
        RUN_ETL = "run-etl", "run-etl"
        TRIGGER_AIRFLOW_DAG = "trigger-airflow-dag", "trigger-airflow-dag"

    class Status(models.TextChoices):
        QUEUED = "queued", "queued"
        RUNNING = "running", "running"
        SUCCESS = "success", "success"
        FAILED = "failed", "failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job_name = models.CharField(max_length=64, choices=JobName.choices)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.QUEUED)
    requested_by = models.CharField(max_length=150, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(blank=True, null=True)
    finished_at = models.DateTimeField(blank=True, null=True)
    duration_ms = models.BigIntegerField(blank=True, null=True)
    params_json = models.JSONField(default=dict, blank=True)
    log_path = models.CharField(max_length=512, blank=True, null=True)
    stdout_tail = models.TextField(blank=True, null=True)
    stderr_tail = models.TextField(blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["job_name", "created_at"]),
            models.Index(fields=["status", "created_at"]),
        ]

    def update_duration(self) -> None:
        if self.started_at and self.finished_at:
            delta: timedelta = self.finished_at - self.started_at
            self.duration_ms = int(delta.total_seconds() * 1000)


class AppSetting(models.Model):
    key = models.CharField(max_length=128, unique=True)
    value_json = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("key",)

    @classmethod
    def get_bool(cls, key: str, default: bool) -> bool:
        row = cls.objects.filter(key=key).first()
        if not row:
            return default
        value = row.value_json
        if isinstance(value, bool):
            return value
        if isinstance(value, dict):
            raw = value.get("enabled")
            if isinstance(raw, bool):
                return raw
        return default

    @classmethod
    def set_bool(cls, key: str, enabled: bool) -> None:
        cls.objects.update_or_create(key=key, defaults={"value_json": {"enabled": enabled}})


SAFE_MODE_SETTING_KEY = "safe_mode"


def get_safe_mode(default: bool = True) -> bool:
    return AppSetting.get_bool(SAFE_MODE_SETTING_KEY, default=default)


def set_safe_mode(enabled: bool) -> None:
    AppSetting.set_bool(SAFE_MODE_SETTING_KEY, enabled)
