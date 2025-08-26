# scripts/mint_token.py
import datetime
import os
from jose import jwt
email = os.getenv("EMAIL", "owner@gmcshield.dev")
role = os.getenv("ROLE", "owner")
account_id = int(os.getenv("ACCOUNT_ID", "1"))
secret = os.getenv("SECRET_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJvd25lckBnbWNzaGllbGQuZGV2Iiwicm9sZSI6Im93bmVyIiwiYWNjb3VudF9pZCI6MSwiaWF0IjoxNzU0OTk3MTcwLCJleHAiOjE3NTUwNDAzNzB9.VA1tZdZUVWK7AvBktBQvvEO01KploYDEllK4nanlQ28")
payload = {
    "sub": email,
    "role": role,
    "account_id": account_id,
    "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=12),
}
print(jwt.encode(payload, secret, algorithm="HS256"))
