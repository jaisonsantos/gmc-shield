# api/app/scripts/mint_token.py
import os
import datetime
from jose import jwt

EMAIL = os.getenv("EMAIL", "owner@gmcshield.dev")
ROLE = os.getenv("ROLE", "owner")
ACCOUNT_ID = int(os.getenv("ACCOUNT_ID", "1"))
SECRET_KEY = os.getenv("SECRET_KEY", "change_me")

now = datetime.datetime.utcnow()
payload = {
    "sub": EMAIL,
    "role": ROLE,
    "account_id": ACCOUNT_ID,
    "iat": now,
    "exp": now + datetime.timedelta(hours=12),
}
print(jwt.encode(payload, SECRET_KEY, algorithm="HS256"))
