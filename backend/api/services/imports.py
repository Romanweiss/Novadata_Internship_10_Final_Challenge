from __future__ import annotations

import csv
import json
import threading
import uuid
from pathlib import Path
from typing import Any

from django.core.files.uploadedfile import UploadedFile
from django.db import transaction
from django.utils import timezone

from api.models import ImportBatch, ImportRowError, ImportStagingRecord
from api.services.errors import ServiceError
from api.services.settings import env_int, env_str

# Safe first step: the batch performs dry-run parsing/validation only and does not
# push uploaded data into MongoDB/Kafka, so the existing production path stays untouched.
SUPPORTED_IMPORT_FORMATS = {
    ".json": "json",
    ".jsonl": "jsonl",
    ".ndjson": "ndjson",
    ".csv": "csv",
}

# Minimal schema contract for the first iteration: every entity must include its business id.
REQUIRED_ENTITY_FIELDS: dict[str, tuple[tuple[str, ...], ...]] = {
    ImportBatch.EntityType.STORES: (("store_id",),),
    ImportBatch.EntityType.PRODUCTS: (("product_id", "id"),),
    ImportBatch.EntityType.CUSTOMERS: (("customer_id",),),
    ImportBatch.EntityType.PURCHASES: (("purchase_id",),),
}

MAX_RAW_FRAGMENT_LENGTH = 1000
MAX_STORED_ERRORS = env_int("IMPORT_MAX_STORED_ERRORS", 500)


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _imports_dir() -> Path:
    target = Path(env_str("IMPORTS_STORAGE_DIR", str(_repo_root() / "backend" / "import_uploads"))).resolve()
    target.mkdir(parents=True, exist_ok=True)
    return target


def _normalize_file_name(name: str) -> str:
    safe_name = Path(name or "upload").name.strip()
    return safe_name or "upload"


def _detect_file_format(file_name: str) -> tuple[str, str]:
    suffix = Path(file_name).suffix.lower()
    file_format = SUPPORTED_IMPORT_FORMATS.get(suffix)
    if not file_format:
        raise ServiceError(
            "IMPORT_UNSUPPORTED_FILE",
            "Supported import formats: .json, .jsonl, .ndjson, .csv.",
            400,
        )
    return suffix, file_format


def _store_uploaded_file(uploaded_file: UploadedFile, batch_id: uuid.UUID, file_name: str) -> Path:
    suffix = Path(file_name).suffix.lower()
    stored_name = f"{batch_id}{suffix}"
    destination = _imports_dir() / stored_name
    with destination.open("wb") as handle:
        for chunk in uploaded_file.chunks():
            handle.write(chunk)
    return destination


def enqueue_import(
    *,
    entity_type: str,
    uploaded_file: UploadedFile,
    requested_by: str | None = None,
) -> ImportBatch:
    file_name = _normalize_file_name(uploaded_file.name)
    _, file_format = _detect_file_format(file_name)
    batch_id = uuid.uuid4()
    stored_path = _store_uploaded_file(uploaded_file, batch_id, file_name)

    with transaction.atomic():
        batch = ImportBatch.objects.create(
            id=batch_id,
            entity_type=entity_type,
            file_name=file_name,
            file_format=file_format,
            file_path=str(stored_path),
            status=ImportBatch.Status.QUEUED,
            requested_by=requested_by or None,
        )

    thread = threading.Thread(target=_process_import_batch, args=(str(batch.id), False), daemon=True)
    thread.start()
    return batch


def enqueue_replay(*, batch_id: str, requested_by: str | None = None) -> ImportBatch:
    batch = ImportBatch.objects.filter(id=batch_id).first()
    if not batch:
        raise ServiceError("IMPORT_BATCH_NOT_FOUND", "Import batch was not found.", 404)
    if batch.status in {ImportBatch.Status.QUEUED, ImportBatch.Status.RUNNING}:
        raise ServiceError("IMPORT_BATCH_BUSY", "Import batch is already queued or running.", 409)
    if not Path(batch.file_path).exists():
        raise ServiceError("IMPORT_FILE_MISSING", "Stored batch file is missing, replay is unavailable.", 404)

    batch.status = ImportBatch.Status.QUEUED
    batch.started_at = None
    batch.finished_at = None
    batch.error_message = None
    if requested_by:
        batch.requested_by = requested_by
    batch.save(update_fields=["status", "started_at", "finished_at", "error_message", "requested_by"])

    thread = threading.Thread(target=_process_import_batch, args=(str(batch.id), True), daemon=True)
    thread.start()
    return batch


def _process_import_batch(batch_id: str, is_replay: bool = False) -> None:
    batch = ImportBatch.objects.filter(id=batch_id).first()
    if not batch:
        return

    batch.status = ImportBatch.Status.RUNNING
    batch.started_at = timezone.now()
    batch.save(update_fields=["status", "started_at"])

    total_rows = 0
    valid_rows = 0
    invalid_rows = 0
    staged_rows = 0
    batch_errors: list[ImportRowError] = []
    staging_records: list[ImportStagingRecord] = []
    status = ImportBatch.Status.SUCCESS
    error_message = ""

    try:
        rows = _load_rows(Path(batch.file_path), batch.file_format)
        for row_number, row in rows:
            total_rows += 1
            errors = _validate_row(batch.entity_type, row)
            if errors:
                invalid_rows += 1
                for field_name, error_code, message in errors:
                    if len(batch_errors) < MAX_STORED_ERRORS:
                        batch_errors.append(
                            ImportRowError(
                                batch=batch,
                                row_number=max(row_number, 0),
                                field_name=field_name,
                                error_code=error_code,
                                message=message,
                                raw_fragment=_raw_fragment(row),
                            )
                        )
            else:
                valid_rows += 1
                staging_records.append(
                    ImportStagingRecord(
                        batch=batch,
                        entity_type=batch.entity_type,
                        row_number=max(row_number, 0),
                        business_key=_extract_business_key(batch.entity_type, row),
                        payload_json=row,
                    )
                )

        if total_rows == 0:
            status = ImportBatch.Status.FAILED
            error_message = "Uploaded file does not contain data rows."
        elif valid_rows == 0:
            status = ImportBatch.Status.FAILED
            error_message = "No valid rows matched the schema contract."
        elif invalid_rows > 0:
            status = ImportBatch.Status.PARTIAL
        staged_rows = valid_rows
    except ServiceError as exc:
        status = ImportBatch.Status.FAILED
        error_message = exc.message
        batch_errors = [
            ImportRowError(
                batch=batch,
                row_number=0,
                field_name="",
                error_code=exc.code.lower(),
                message=exc.message,
                raw_fragment=None,
            )
        ]
        total_rows = 0
        valid_rows = 0
        invalid_rows = 1
    except Exception as exc:  # noqa: BLE001
        status = ImportBatch.Status.FAILED
        error_message = str(exc)
        batch_errors = [
            ImportRowError(
                batch=batch,
                row_number=0,
                field_name="",
                error_code="processing_error",
                message=str(exc),
                raw_fragment=None,
            )
        ]
        total_rows = 0
        valid_rows = 0
        invalid_rows = 1
        staged_rows = 0

    with transaction.atomic():
        ImportRowError.objects.filter(batch=batch).delete()
        ImportStagingRecord.objects.filter(batch=batch).delete()
        if batch_errors:
            ImportRowError.objects.bulk_create(batch_errors)
        if staging_records:
            ImportStagingRecord.objects.bulk_create(staging_records)

        batch.status = status
        batch.total_rows = total_rows
        batch.valid_rows = valid_rows
        batch.invalid_rows = invalid_rows
        batch.staged_rows = staged_rows
        batch.error_message = error_message or None
        batch.finished_at = timezone.now()
        if is_replay:
            batch.replay_count += 1
            batch.last_replayed_at = batch.finished_at
        batch.save(
            update_fields=[
                "status",
                "total_rows",
                "valid_rows",
                "invalid_rows",
                "staged_rows",
                "replay_count",
                "error_message",
                "finished_at",
                "last_replayed_at",
            ]
        )


def _load_rows(path: Path, file_format: str) -> list[tuple[int, Any]]:
    if not path.exists():
        raise ServiceError("IMPORT_FILE_MISSING", f"Uploaded file not found: {path.name}", 500)
    if file_format == "csv":
        return _load_csv_rows(path)
    return _load_json_rows(path)


def _load_csv_rows(path: Path) -> list[tuple[int, dict[str, Any]]]:
    rows: list[tuple[int, dict[str, Any]]] = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise ServiceError("IMPORT_INVALID_CSV", "CSV file must include a header row.", 400)
        for line_number, row in enumerate(reader, start=2):
            rows.append((line_number, dict(row or {})))
    return rows


def _load_json_rows(path: Path) -> list[tuple[int, Any]]:
    raw_text = path.read_text(encoding="utf-8-sig")
    stripped = raw_text.strip()
    if not stripped:
        return []

    try:
        payload = json.loads(stripped)
    except json.JSONDecodeError:
        return _load_json_lines(stripped)

    if isinstance(payload, list):
        return [(index, row) for index, row in enumerate(payload, start=1)]
    if isinstance(payload, dict):
        return [(1, payload)]
    raise ServiceError(
        "IMPORT_INVALID_JSON",
        "JSON file must contain an object, an array of objects, or JSON Lines.",
        400,
    )


def _load_json_lines(raw_text: str) -> list[tuple[int, Any]]:
    rows: list[tuple[int, Any]] = []
    for line_number, line in enumerate(raw_text.splitlines(), start=1):
        stripped = line.strip()
        if not stripped:
            continue
        try:
            rows.append((line_number, json.loads(stripped)))
        except json.JSONDecodeError as exc:
            raise ServiceError(
                "IMPORT_INVALID_JSON",
                f"Invalid JSON on line {line_number}: {exc.msg}.",
                400,
            ) from exc
    return rows


def _validate_row(entity_type: str, row: Any) -> list[tuple[str, str, str]]:
    if not isinstance(row, dict):
        return [("", "invalid_row_type", "Each imported row must be a JSON object or CSV record.")]

    errors: list[tuple[str, str, str]] = []
    for field_group in REQUIRED_ENTITY_FIELDS.get(entity_type, ()):
        if not any(_has_non_empty_value(row, field_name) for field_name in field_group):
            field_label = " / ".join(field_group)
            errors.append(
                (
                    field_label,
                    "required_field_missing",
                    f"Required field is missing: {field_label}.",
                )
            )
    return errors


def _extract_business_key(entity_type: str, row: dict[str, Any]) -> str:
    field_groups = REQUIRED_ENTITY_FIELDS.get(entity_type, ())
    for field_group in field_groups:
        for field_name in field_group:
            value = row.get(field_name)
            if value is None:
                continue
            text = value.strip() if isinstance(value, str) else str(value)
            if text:
                return text
    return f"row-{uuid.uuid4().hex}"


def _has_non_empty_value(row: dict[str, Any], field_name: str) -> bool:
    value = row.get(field_name)
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    return True


def _raw_fragment(row: Any) -> str | None:
    if row is None:
        return None
    try:
        serialized = json.dumps(row, ensure_ascii=False)
    except TypeError:
        serialized = str(row)
    return serialized[:MAX_RAW_FRAGMENT_LENGTH]
