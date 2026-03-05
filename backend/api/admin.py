from django.contrib import admin

from api.models import AlertEvent, AppSetting, ExportAudit, JobRun, PipelinePreset


@admin.register(JobRun)
class JobRunAdmin(admin.ModelAdmin):
    list_display = ("id", "job_name", "status", "created_at", "started_at", "finished_at")
    list_filter = ("job_name", "status")
    search_fields = ("id", "job_name", "requested_by", "error_message")
    readonly_fields = ("id", "created_at", "started_at", "finished_at", "duration_ms")


@admin.register(AppSetting)
class AppSettingAdmin(admin.ModelAdmin):
    list_display = ("key", "updated_at")
    search_fields = ("key",)


@admin.register(AlertEvent)
class AlertEventAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "source",
        "channel",
        "status",
        "severity",
        "entity",
        "created_at",
        "sent_at",
    )
    list_filter = ("source", "channel", "status", "severity", "entity")
    search_fields = ("rule_name", "message", "error_message", "job_run__id")
    readonly_fields = ("created_at",)


@admin.register(ExportAudit)
class ExportAuditAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "storage_provider",
        "bucket",
        "filename",
        "size_bytes",
        "rows_count",
        "status",
        "exported_at",
    )
    list_filter = ("storage_provider", "status", "bucket")
    search_fields = ("filename", "object_key", "etag", "job_run__id")
    readonly_fields = ("exported_at",)


@admin.register(PipelinePreset)
class PipelinePresetAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "job_name",
        "is_active",
        "updated_at",
        "last_used_at",
    )
    list_filter = ("job_name", "is_active")
    search_fields = ("name", "description", "created_by")
    readonly_fields = ("created_at", "updated_at", "last_used_at")
