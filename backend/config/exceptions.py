from __future__ import annotations

from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is None:
        return response

    if isinstance(exc, ValidationError):
        code = "VALIDATION_ERROR"
        message = "Validation failed."
    elif isinstance(exc, APIException):
        code = "API_ERROR"
        message = str(exc.detail)
    else:
        code = "UNKNOWN_ERROR"
        message = "Unexpected error."

    if response.status_code >= status.HTTP_500_INTERNAL_SERVER_ERROR:
        code = "INTERNAL_ERROR"
        message = "Internal server error."

    response.data = {
        "ok": False,
        "error": {
            "code": code,
            "message": message,
            "details": response.data,
        },
    }
    return response
