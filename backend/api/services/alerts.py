from __future__ import annotations

from datetime import timedelta

import requests
from django.utils import timezone

from api.models import AlertEvent
from api.services.settings import env_int, env_str


def _cooldown_minutes() -> int:
    return max(1, env_int("ALERT_EVENT_COOLDOWN_MINUTES", 15))


def _send_telegram_message(token: str, chat_id: str, text: str) -> dict:
    response = requests.post(
        f"https://api.telegram.org/bot{token}/sendMessage",
        json={"chat_id": chat_id, "text": text},
        timeout=10,
    )
    payload = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
    if response.status_code >= 300 or payload.get("ok") is False:
        raise RuntimeError(f"Telegram send failed: status={response.status_code}, body={str(payload)[:300]}")
    return payload


def dispatch_duplicates_ratio_alert(
    *,
    ratio: float,
    threshold: float,
    entity: str = "purchases",
) -> AlertEvent | None:
    if ratio <= threshold:
        return None

    rule_name = "duplicates_ratio_threshold"
    now = timezone.now()
    cooldown_from = now - timedelta(minutes=_cooldown_minutes())

    recent = (
        AlertEvent.objects.filter(
            source="backend",
            channel="telegram",
            rule_name=rule_name,
            entity=entity,
            created_at__gte=cooldown_from,
        )
        .order_by("-created_at")
        .first()
    )
    if recent:
        return recent

    message = (
        f"ProbablyFresh alert: duplicates ratio for '{entity}' is {ratio:.3f}, "
        f"threshold is {threshold:.3f}."
    )
    payload = {"ratio": ratio, "threshold": threshold, "entity": entity, "rule_name": rule_name}

    token = env_str("TELEGRAM_BOT_TOKEN", "")
    chat_id = env_str("TELEGRAM_CHAT_ID", "")

    if not token or not chat_id:
        return AlertEvent.objects.create(
            source="backend",
            channel="telegram",
            rule_name=rule_name,
            entity=entity,
            severity=AlertEvent.Severity.CRITICAL,
            observed_value=ratio,
            threshold_value=threshold,
            message=message,
            payload_json=payload,
            status=AlertEvent.Status.FAILED,
            error_message="Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID for backend alert dispatch.",
        )

    try:
        telegram_payload = _send_telegram_message(token, chat_id, message)
        payload["telegram_response"] = telegram_payload
        return AlertEvent.objects.create(
            source="backend",
            channel="telegram",
            rule_name=rule_name,
            entity=entity,
            severity=AlertEvent.Severity.CRITICAL,
            observed_value=ratio,
            threshold_value=threshold,
            message=message,
            payload_json=payload,
            status=AlertEvent.Status.SENT,
            sent_at=now,
        )
    except Exception as exc:  # noqa: BLE001
        payload["exception"] = str(exc)
        return AlertEvent.objects.create(
            source="backend",
            channel="telegram",
            rule_name=rule_name,
            entity=entity,
            severity=AlertEvent.Severity.CRITICAL,
            observed_value=ratio,
            threshold_value=threshold,
            message=message,
            payload_json=payload,
            status=AlertEvent.Status.FAILED,
            error_message=str(exc)[:500],
        )

