from __future__ import annotations

from uuid import UUID

from django.shortcuts import get_object_or_404
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from api.models import ImportBatch, PipelinePreset, JobRun, get_safe_mode
from api.serializers import (
    ImportBatchCreateSerializer,
    ImportBatchSerializer,
    ImportRowErrorSerializer,
    ImportStagingRecordSerializer,
    JobRunSerializer,
    PipelinePresetSerializer,
    SafeModeSerializer,
)
from api.services.actions import enqueue_action
from api.services.errors import ServiceError
from api.services.exports import list_exports, presign_export
from api.services.feature_mart import get_feature_mart_payload
from api.services.health import collect_services_health
from api.services.imports import enqueue_import, enqueue_replay
from api.services.metrics import (
    get_ingestion_series,
    get_last_runs,
    get_overview_kpis,
    get_payments_breakdown,
    get_pipeline_map,
    get_quality_mart_stats,
    get_quality_overall,
    get_quality_trend,
)
from api.services.system_settings import get_connections_payload, update_safe_mode
from config.response import fail, ok


def _parse_positive_int(value: str | None, default: int, min_value: int = 1, max_value: int = 200) -> int:
    if value is None:
        return default
    try:
        parsed = int(value)
    except ValueError:
        return default
    return max(min(parsed, max_value), min_value)


def _parse_bool(value: str | None, default: bool | None = None) -> bool | None:
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default


class PublicPingView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        return ok({"service": "backend", "status": "ok"})


class OverviewKpisView(APIView):
    def get(self, request):
        return ok(get_overview_kpis())


class OverviewIngestionSeriesView(APIView):
    def get(self, request):
        days = _parse_positive_int(request.query_params.get("days"), default=7, min_value=1, max_value=30)
        return ok(get_ingestion_series(days=days))


class OverviewPaymentsBreakdownView(APIView):
    def get(self, request):
        days = _parse_positive_int(request.query_params.get("days"), default=7, min_value=1, max_value=90)
        return ok(get_payments_breakdown(days=days))


class OverviewServicesHealthView(APIView):
    def get(self, request):
        return ok(collect_services_health())


class OverviewLastRunsView(APIView):
    def get(self, request):
        limit = _parse_positive_int(request.query_params.get("limit"), default=10, min_value=1, max_value=100)
        return ok(get_last_runs(limit=limit))


class PipelinesMapView(APIView):
    def get(self, request):
        return ok(get_pipeline_map())


class PipelinePresetListCreateView(APIView):
    def get(self, request):
        active_only = _parse_bool(request.query_params.get("active"), default=None)
        queryset = PipelinePreset.objects.all().order_by("name")
        if active_only is not None:
            queryset = queryset.filter(is_active=active_only)
        serializer = PipelinePresetSerializer(queryset, many=True)
        return ok({"items": serializer.data})

    def post(self, request):
        serializer = PipelinePresetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        created_by = (
            request.user.username
            if request.user and request.user.is_authenticated
            else "api"
        )
        preset = serializer.save(created_by=created_by)
        return ok(PipelinePresetSerializer(preset).data, status=201)


class PipelinePresetDetailView(APIView):
    def get(self, request, preset_id: UUID):
        preset = get_object_or_404(PipelinePreset, id=preset_id)
        return ok(PipelinePresetSerializer(preset).data)

    def patch(self, request, preset_id: UUID):
        preset = get_object_or_404(PipelinePreset, id=preset_id)
        serializer = PipelinePresetSerializer(preset, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return ok(serializer.data)

    def delete(self, request, preset_id: UUID):
        preset = get_object_or_404(PipelinePreset, id=preset_id)
        preset.delete()
        return ok({"deleted": True})


class QualityOverallView(APIView):
    def get(self, request):
        return ok(get_quality_overall())


class QualityDuplicatesTrendView(APIView):
    def get(self, request):
        runs = _parse_positive_int(request.query_params.get("runs"), default=10, min_value=1, max_value=50)
        return ok(get_quality_trend(runs=runs))


class QualityMartStatsView(APIView):
    def get(self, request):
        return ok(get_quality_mart_stats())


class ExportsListView(APIView):
    def get(self, request):
        query = request.query_params.get("query", "")
        limit = _parse_positive_int(request.query_params.get("limit"), default=50, min_value=1, max_value=200)
        offset = _parse_positive_int(request.query_params.get("offset"), default=0, min_value=0, max_value=100000)
        return ok(list_exports(query=query, limit=limit, offset=offset))


class ExportsPresignView(APIView):
    def get(self, request):
        key = request.query_params.get("key", "")
        try:
            return ok(presign_export(key))
        except ServiceError as exc:
            return fail(exc.code, exc.message, exc.details, status=exc.status_code)


class FeatureMartView(APIView):
    def get(self, request):
        try:
            return ok(get_feature_mart_payload())
        except ServiceError as exc:
            return fail(exc.code, exc.message, exc.details, status=exc.status_code)


class ImportBatchCreateView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = ImportBatchCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        requested_by = request.user.username if request.user and request.user.is_authenticated else None

        try:
            batch = enqueue_import(
                entity_type=serializer.validated_data["entity_type"],
                uploaded_file=serializer.validated_data["file"],
                requested_by=requested_by,
            )
        except ServiceError as exc:
            return fail(exc.code, exc.message, exc.details, status=exc.status_code)

        return ok(ImportBatchSerializer(batch).data, status=202)


class ImportBatchStatusView(APIView):
    def get(self, request, batch_id: UUID):
        batch = get_object_or_404(ImportBatch, id=batch_id)
        return ok(ImportBatchSerializer(batch).data)


class ImportBatchErrorsView(APIView):
    def get(self, request, batch_id: UUID):
        batch = get_object_or_404(ImportBatch, id=batch_id)
        limit = _parse_positive_int(request.query_params.get("limit"), default=200, min_value=1, max_value=1000)
        queryset = batch.row_errors.all().order_by("row_number", "id")
        serializer = ImportRowErrorSerializer(queryset[:limit], many=True)
        return ok({"items": serializer.data, "total": batch.invalid_rows})


class ImportBatchStagingView(APIView):
    def get(self, request, batch_id: UUID):
        batch = get_object_or_404(ImportBatch, id=batch_id)
        limit = _parse_positive_int(request.query_params.get("limit"), default=100, min_value=1, max_value=500)
        queryset = batch.staging_records.all().order_by("row_number", "id")
        serializer = ImportStagingRecordSerializer(queryset[:limit], many=True)
        return ok({"items": serializer.data, "total": batch.staged_rows})


class ImportBatchReplayView(APIView):
    def post(self, request, batch_id: UUID):
        requested_by = request.user.username if request.user and request.user.is_authenticated else None
        try:
            batch = enqueue_replay(batch_id=str(batch_id), requested_by=requested_by)
        except ServiceError as exc:
            return fail(exc.code, exc.message, exc.details, status=exc.status_code)
        return ok(ImportBatchSerializer(batch).data, status=202)


class SettingsConnectionsView(APIView):
    def get(self, request):
        return ok(get_connections_payload())


class SettingsSafeModeView(APIView):
    def post(self, request):
        serializer = SafeModeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return ok(update_safe_mode(enabled=serializer.validated_data["enabled"]))


class ActionTriggerView(APIView):
    action_name: str | None = None

    def post(self, request):
        if not self.action_name:
            return fail("ACTION_UNKNOWN", "Action is not configured.", status=404)

        params = dict(request.data) if isinstance(request.data, dict) else {}

        if self.action_name == JobRun.JobName.MART_REFRESH and get_safe_mode(default=True):
            return fail(
                "SAFE_MODE_BLOCKED",
                "mart-refresh is blocked while safe mode is enabled.",
                details={"safe_mode": True},
                status=403,
            )

        requested_by = request.user.username if request.user and request.user.is_authenticated else None
        try:
            run = enqueue_action(job_name=self.action_name, params=params, requested_by=requested_by)
        except ServiceError as exc:
            return fail(exc.code, exc.message, exc.details, status=exc.status_code)

        return ok({"run_id": str(run.id), "status": run.status}, status=202)


class RunStatusView(APIView):
    def get(self, request, run_id: UUID):
        run = get_object_or_404(JobRun, id=run_id)
        return ok(JobRunSerializer(run).data)
