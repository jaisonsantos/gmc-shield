from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import User
from app.schemas import UserLogin, Token
from app.auth import create_token, get_current_user, verify_password

router = APIRouter()

@router.post("/login", response_model=Token)
def login(body: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_token(user.email, user.role, user.account_id)
    return {"access_token": token, "token_type": "bearer"}

@router.get("/whoami")
def whoami(current = Depends(get_current_user)):
    return current
