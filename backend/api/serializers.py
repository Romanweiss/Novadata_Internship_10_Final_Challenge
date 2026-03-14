from __future__ import annotations

from rest_framework import serializers

from api.models import ImportBatch, ImportRowError, ImportStagingRecord, JobRun, PipelinePreset


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


class ImportBatchCreateSerializer(serializers.Serializer):
    entity_type = serializers.ChoiceField(choices=ImportBatch.EntityType.choices)
    file = serializers.FileField()

    def validate_file(self, value):
        if not value:
            raise serializers.ValidationError("file is required.")
        if getattr(value, "size", 0) <= 0:
            raise serializers.ValidationError("Uploaded file is empty.")
        return value


class ImportBatchSerializer(serializers.ModelSerializer):
    entity = serializers.CharField(source="entity_type", read_only=True)

    class Meta:
        model = ImportBatch
        fields = [
            "id",
            "entity",
            "entity_type",
            "file_name",
            "file_format",
            "status",
            "total_rows",
            "valid_rows",
            "invalid_rows",
            "staged_rows",
            "replay_count",
            "error_message",
            "created_at",
            "started_at",
            "finished_at",
            "last_replayed_at",
        ]


class ImportRowErrorSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportRowError
        fields = [
            "id",
            "row_number",
            "field_name",
            "error_code",
            "message",
            "raw_fragment",
            "created_at",
        ]


class ImportStagingRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportStagingRecord
        fields = [
            "id",
            "row_number",
            "business_key",
            "payload_json",
            "created_at",
        ]
