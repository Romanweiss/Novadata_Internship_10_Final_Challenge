from django.contrib import admin

from api.models import AppSetting, JobRun


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
