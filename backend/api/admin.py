from django.contrib import admin

from api.models import AlertEvent, AppSetting, ExportAudit, ImportBatch, ImportRowError, ImportStagingRecord, JobRun, PipelinePreset


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


class ImportRowErrorInline(admin.TabularInline):
    model = ImportRowError
    extra = 0
    can_delete = False
    readonly_fields = ("row_number", "field_name", "error_code", "message", "raw_fragment", "created_at")


@admin.register(ImportBatch)
class ImportBatchAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "entity_type",
        "file_name",
        "status",
        "total_rows",
        "valid_rows",
        "invalid_rows",
        "staged_rows",
        "replay_count",
        "created_at",
        "finished_at",
    )
    list_filter = ("entity_type", "status")
    search_fields = ("file_name", "requested_by", "error_message")
    readonly_fields = (
        "id",
        "created_at",
        "started_at",
        "finished_at",
        "total_rows",
        "valid_rows",
        "invalid_rows",
        "staged_rows",
        "replay_count",
        "last_replayed_at",
        "error_message",
        "file_path",
        "file_format",
    )
    inlines = [ImportRowErrorInline]


@admin.register(ImportStagingRecord)
class ImportStagingRecordAdmin(admin.ModelAdmin):
    list_display = ("id", "entity_type", "business_key", "row_number", "batch", "created_at")
    list_filter = ("entity_type",)
    search_fields = ("business_key", "batch__id")
    readonly_fields = ("created_at",)
