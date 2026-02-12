from __future__ import annotations

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



def generate_key() -> str:
    return Fernet.generate_key().decode("utf-8")
