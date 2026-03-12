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
            models.Index(fields=["job_name", "created_at"], name="api_jobrun_job_nam_ea9c6b_idx"),
            models.Index(fields=["status", "created_at"], name="api_jobrun_status_1b1636_idx"),
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


class AlertEvent(models.Model):
    class Severity(models.TextChoices):
        INFO = "info", "info"
        WARNING = "warning", "warning"
        CRITICAL = "critical", "critical"

    class Status(models.TextChoices):
        SENT = "sent", "sent"
        FAILED = "failed", "failed"

    source = models.CharField(max_length=64, default="grafana")
    channel = models.CharField(max_length=32, default="telegram")
    rule_name = models.CharField(max_length=128, blank=True, null=True)
    entity = models.CharField(max_length=64, blank=True, null=True)
    severity = models.CharField(max_length=16, choices=Severity.choices, default=Severity.WARNING)
    observed_value = models.FloatField(blank=True, null=True)
    threshold_value = models.FloatField(blank=True, null=True)
    message = models.TextField()
    payload_json = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.SENT)
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)
    job_run = models.ForeignKey(
        JobRun,
        on_delete=models.SET_NULL,
        related_name="alert_events",
        blank=True,
        null=True,
    )

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["status", "created_at"], name="api_alertev_status_13fbee_idx"),
            models.Index(fields=["source", "channel", "created_at"], name="api_alertev_source_52d5ca_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.source}:{self.channel}:{self.status}:{self.created_at.isoformat()}"


class ExportAudit(models.Model):
    class Status(models.TextChoices):
        UPLOADED = "uploaded", "uploaded"
        FAILED = "failed", "failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    storage_provider = models.CharField(max_length=32, default="s3")
    bucket = models.CharField(max_length=255)
    object_key = models.CharField(max_length=512)
    filename = models.CharField(max_length=255)
    rows_count = models.BigIntegerField(blank=True, null=True)
    size_bytes = models.BigIntegerField(default=0)
    etag = models.CharField(max_length=128, blank=True, null=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.UPLOADED)
    exported_at = models.DateTimeField(auto_now_add=True)
    error_message = models.TextField(blank=True, null=True)
    job_run = models.ForeignKey(
        JobRun,
        on_delete=models.SET_NULL,
        related_name="export_audits",
        blank=True,
        null=True,
    )

    class Meta:
        ordering = ("-exported_at",)
        indexes = [
            models.Index(fields=["status", "exported_at"], name="api_exporta_status_93803f_idx"),
            models.Index(fields=["bucket", "object_key"], name="api_exporta_bucket_35be90_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.bucket}/{self.object_key} ({self.status})"


class PipelinePreset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=128, unique=True)
    job_name = models.CharField(max_length=64, choices=JobRun.JobName.choices)
    description = models.TextField(blank=True)
    params_json = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.CharField(max_length=150, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_used_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ("name",)
        indexes = [
            models.Index(fields=["job_name", "is_active"], name="api_pipelin_job_nam_e83350_idx"),
            models.Index(fields=["updated_at"], name="api_pipelin_updated_9fe030_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.job_name})"


SAFE_MODE_SETTING_KEY = "safe_mode"


def get_safe_mode(default: bool = True) -> bool:
    return AppSetting.get_bool(SAFE_MODE_SETTING_KEY, default=default)


def set_safe_mode(enabled: bool) -> None:
    AppSetting.set_bool(SAFE_MODE_SETTING_KEY, enabled)
