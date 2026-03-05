from __future__ import annotations

from rest_framework import serializers

from api.models import PipelinePreset, JobRun


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


class PipelinePresetSerializer(serializers.ModelSerializer):
    class Meta:
        model = PipelinePreset
        fields = [
            "id",
            "name",
            "job_name",
            "description",
            "params_json",
            "is_active",
            "created_by",
            "created_at",
            "updated_at",
            "last_used_at",
        ]
        read_only_fields = ("id", "created_at", "updated_at", "last_used_at", "created_by")

    def validate_params_json(self, value):
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("params_json must be a JSON object.")
        return value
