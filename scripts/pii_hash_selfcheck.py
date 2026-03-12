from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "src"))

from probablyfresh.core.crypto_utils import PIIHasher
from probablyfresh.core.normalization import normalize_email, normalize_phone


def _assert(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def _required_salt() -> str:
    salt = os.getenv("PII_HASH_SALT", "").strip()
    if salt:
        return salt

    legacy = os.getenv("FERNET_KEY", "").strip()
    if legacy:
        print("PII_HASH_SALT is empty, fallback to FERNET_KEY for this self-check")
        return legacy

    raise RuntimeError("Set PII_HASH_SALT (min 16 chars) in .env")


def main() -> None:
    load_dotenv(REPO_ROOT / ".env")
    hasher = PIIHasher(_required_salt())

    email_a = "  User@Test.Com  "
    email_b = "user@test.com"
    email_hash_a = hasher.hash_value(normalize_email(email_a))
    email_hash_b = hasher.hash_value(normalize_email(email_b))
    _assert(email_hash_a == email_hash_b, "Normalized equal emails must produce identical hashes")

    diff_hash_1 = hasher.hash_value(normalize_email("alpha@example.com"))
    diff_hash_2 = hasher.hash_value(normalize_email("beta@example.com"))
    _assert(diff_hash_1 != diff_hash_2, "Different values must produce different hashes")

    _assert(len(email_hash_a) == 64, "SHA-256 hex hash length must be 64")

    phone_a = "8 (999) 123-45-67"
    phone_b = "+79991234567"
    phone_hash_a = hasher.hash_value(normalize_phone(phone_a))
    phone_hash_b = hasher.hash_value(normalize_phone(phone_b))
    _assert(phone_hash_a == phone_hash_b, "Normalized equal phones must produce identical hashes")
    _assert(len(phone_hash_a) in (0, 64), "Phone hash length must be 64 or 0 for empty")

    empty_hash = hasher.hash_value("")
    _assert(empty_hash == "", "Empty source value must hash to empty string")

    print("PII hash self-check passed")


if __name__ == "__main__":
    main()
