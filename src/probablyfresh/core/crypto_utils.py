from __future__ import annotations

from hashlib import sha256

from cryptography.fernet import Fernet


class Encryptor:
    def __init__(self, key: str) -> None:
        if not key:
            raise ValueError(
                "FERNET_KEY is empty. Generate one with: "
                "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            )
        self._fernet = Fernet(key.encode("utf-8"))

    def encrypt(self, value: str) -> str:
        return self._fernet.encrypt(value.encode("utf-8")).decode("utf-8")


class PIIHasher:
    def __init__(self, salt: str) -> None:
        normalized_salt = (salt or "").strip()
        if len(normalized_salt) < 16:
            raise ValueError("PII_HASH_SALT must be at least 16 characters long")
        self._salt = normalized_salt

    def hash_value(self, value: str | None) -> str:
        if value is None:
            return ""
        normalized = value.strip()
        if not normalized:
            return ""
        raw = f"{self._salt}:{normalized}".encode("utf-8")
        return sha256(raw).hexdigest()


def generate_key() -> str:
    return Fernet.generate_key().decode("utf-8")
