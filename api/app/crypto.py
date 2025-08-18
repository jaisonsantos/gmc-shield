import os
from cryptography.fernet import Fernet, InvalidToken

_key = os.getenv("FERNET_KEY")
_fernet = Fernet(_key.encode()) if _key else None


def _require_fernet():
    if _fernet is None:
        raise RuntimeError("FERNET_KEY not set")


def encrypt_str(s: str) -> str:
    _require_fernet()
    return _fernet.encrypt(s.encode()).decode()


def decrypt_str(s: str) -> str:
    _require_fernet()
    try:
        return _fernet.decrypt(s.encode()).decode()
    except InvalidToken as e:
        raise ValueError("invalid token") from e
