# app/auth.py

import os
import datetime
from typing import TypedDict
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.hash import pbkdf2_sha256, bcrypt

SECRET_KEY    = os.getenv("SECRET_KEY","change_me")
ALGORITHM     = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

class Principal(TypedDict):
    email: str
    role: str
    account_id: int

def create_token(email: str, role: str, account_id: int) -> str:
    now = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "sub": email,
        "role": role,
        "account_id": account_id,
        "iat": now,
        "exp": now + datetime.timedelta(hours=12),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme)) -> Principal:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return {  # type: ignore[return-value]
            "email": payload.get("sub"),
            "role": payload.get("role"),
            "account_id": payload.get("account_id"),
        }
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

def verify_password(plain: str, password_hash: str) -> bool:
    try:
        if password_hash.startswith("$pbkdf2-sha256$"):
            return pbkdf2_sha256.verify(plain, password_hash)
        if password_hash.startswith(("$2b$", "$2a$", "$2y$")):
            return bcrypt.verify(plain, password_hash)
        # fallback (tenta ambos)
        return pbkdf2_sha256.verify(plain, password_hash) or bcrypt.verify(plain, password_hash)
    except Exception:
        return False

def require_roles(*roles: str):
    def _inner(principal: Principal = Depends(get_current_user)) -> Principal:
        if roles and principal["role"] not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return principal
    return _inner

