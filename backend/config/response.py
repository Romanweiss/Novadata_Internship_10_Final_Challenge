from __future__ import annotations

from typing import Any

from rest_framework.response import Response


def ok(data: Any = None, meta: dict[str, Any] | None = None, status: int = 200) -> Response:
    payload: dict[str, Any] = {"ok": True, "data": data}
    if meta:
        payload["meta"] = meta
    return Response(payload, status=status)


def fail(
    code: str,
    message: str,
    details: dict[str, Any] | list[Any] | str | None = None,
    status: int = 400,
) -> Response:
    payload: dict[str, Any] = {
        "ok": False,
        "error": {
            "code": code,
            "message": message,
            "details": details or {},
        },
    }
    return Response(payload, status=status)
