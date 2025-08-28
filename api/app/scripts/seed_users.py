# app/scripts/seed_users.py
from app.db import SessionLocal
from sqlalchemy import text
from app import models
from passlib.context import CryptContext

pwd = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")
DEFAULT_PASS = "demo"
USERS = [
    ("owner@gmcshield.dev",   "owner",   1),
    ("manager@gmcshield.dev", "manager", 1),
    ("viewer@gmcshield.dev",  "viewer",  1),
]

db = SessionLocal()
try:
    # Garante a existência de uma conta '1' para desenvolvimento.
    acct = db.query(models.Account).filter_by(id=1).first()
    if not acct:
        acct = models.Account(id=1, name="Default Account", type="merchant")
        db.add(acct)
        db.flush()
        # Ajusta a sequência do Postgres para evitar colisão do próximo INSERT
        try:
            db.execute(text("SELECT setval(pg_get_serial_sequence('accounts','id'), (SELECT COALESCE(MAX(id),1) FROM accounts))"))
        except Exception:
            pass

    for email, role, account_id in USERS:
        u = db.query(models.User).filter_by(email=email).first()
        if not u:
            u = models.User(
                account_id=account_id,
                email=email,
                password_hash=pwd.hash(DEFAULT_PASS),
                role=role,
            )
            db.add(u)
        else:
            u.role = role
            if pwd.needs_update(u.password_hash):  # atualiza para pbkdf2 quando necessário
                u.password_hash = pwd.hash(DEFAULT_PASS)
    db.commit()
    print("Seed OK.")
finally:
    db.close()
