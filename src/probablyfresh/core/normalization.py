from __future__ import annotations

import re


def normalize_email(value: str) -> str:
    return value.strip().lower()



def normalize_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if len(digits) == 10:
        digits = "7" + digits
    if len(digits) == 11 and digits.startswith("8"):
        digits = "7" + digits[1:]
    if digits and not digits.startswith("+"):
        return "+" + digits
    return digits
