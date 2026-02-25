from __future__ import annotations

from rest_framework import serializers

from api.models import JobRun


class JobRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobRun
        fields = [
            "id",
            "job_name",
            "status",
            "requested_by",
            "created_at",
            "started_at",
            "finished_at",
            "duration_ms",
            "params_json",
            "log_path",
            "stdout_tail",
            "stderr_tail",
            "error_message",
        ]


class SafeModeSerializer(serializers.Serializer):
    enabled = serializers.BooleanField()
