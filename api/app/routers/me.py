from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from ..db import get_db
from ..auth import get_current_user, Principal
from .. import models, schemas

router = APIRouter()

@router.get('/me/preferences', response_model=schemas.Preferences)
def get_preferences(
    request: Request,
    principal: Principal = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.email == principal['email']).first()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    return schemas.Preferences(locale=user.locale)


@router.put('/me/preferences', response_model=schemas.Preferences)
def put_preferences(
    request: Request,
    body: schemas.Preferences,
    principal: Principal = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.email == principal['email']).first()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    user.locale = body.locale
    db.add(user)
    db.commit()
    # make available to request scope for this request
    request.state.user_locale = body.locale
    return schemas.Preferences(locale=user.locale)

