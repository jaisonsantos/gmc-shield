# api/app/crypto.py
import os
import logging
from typing import List
from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)

def _read_keys() -> List[bytes]:
    """
    Lê chaves do ambiente com suporte a rotação.

    - FERNET_KEY  : chave primária (usada para ENCRYPT)
    - FERNET_KEYS : lista adicional de chaves aceitas para DECRYPT
                    (separadas por vírgula, espaço ou quebra de linha)
    Ordem importa: tentamos descriptografar na ordem fornecida.
    """
    keys: List[bytes] = []

    k1 = (os.getenv("FERNET_KEY") or "").strip()
    if k1:
        keys.append(k1.encode())

    ks = (os.getenv("FERNET_KEYS") or "").strip()
    if ks:
        raw = [s.strip() for s in ks.replace("\n", ",").replace(" ", ",").split(",") if s.strip()]
        for s in raw:
            keys.append(s.encode())

    # dedup preservando ordem
    seen = set()
    ordered: List[bytes] = []
    for k in keys:
        if k not in seen:
            ordered.append(k)
            seen.add(k)

    return ordered

_KEYS = _read_keys()

if _KEYS:
    _PRIMARY = Fernet(_KEYS[0])       # usada para encrypt()
    _ALL = [Fernet(k) for k in _KEYS] # usadas para decrypt() (tenta todas)
else:
    _PRIMARY = None
    _ALL = []

def _require():
    if not _ALL:
        raise RuntimeError("FERNET_KEY/FERNET_KEYS not set")

def encrypt_str(s: str) -> str:
    """Criptografa SEMPRE com a chave primária."""
    _require()
    return _PRIMARY.encrypt(s.encode()).decode()

def decrypt_str(token: str) -> str:
    """Tenta descriptografar com TODAS as chaves em ordem."""
    _require()
    last_exc = None
    for idx, f in enumerate(_ALL):
        try:
            plain = f.decrypt(token.encode()).decode()
            if idx != 0:
                logger.warning("decrypt_str: token descriptografado com chave NÃO-primária (index=%d). Considere rotacionar.", idx)
            return plain
        except InvalidToken as e:
            last_exc = e
            continue
    raise ValueError("invalid token") from last_exc

def needs_rotation(token: str) -> bool:
    """
    True  -> descriptografou com alguma chave secundária.
    False -> já está na primária.
    ValueError -> token inválido para TODAS as chaves.
    """
    _require()
    try:
        _ALL[0].decrypt(token.encode())
        return False
    except InvalidToken:
        for f in _ALL[1:]:
            try:
                f.decrypt(token.encode())
                return True
            except InvalidToken:
                pass
        raise ValueError("invalid token")

def reencrypt_to_primary(token: str) -> str:
    """Convenience: decifra (com qualquer chave) e re-cripta na primária."""
    s = decrypt_str(token)
    return encrypt_str(s)
