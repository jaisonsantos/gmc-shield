import os
import re
import contextvars
from typing import Optional
from fastapi import Depends, Request
from babel.dates import format_datetime as _fmt_dt
from babel.numbers import format_currency as _fmt_curr, format_decimal as _fmt_dec
from jinja2 import Environment, FileSystemLoader, select_autoescape, TemplateNotFound

# Environment / defaults
DEFAULT_LOCALE = os.getenv('DEFAULT_LOCALE', 'en_US')
SUPPORTED_LOCALES = [s.strip() for s in os.getenv('SUPPORTED_LOCALES', 'en_US,pt_BR,es_ES').split(',') if s.strip()]

current_locale_var: contextvars.ContextVar[str] = contextvars.ContextVar('current_locale', default=DEFAULT_LOCALE)

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "..", "templates")
_env = Environment(loader=FileSystemLoader(TEMPLATE_DIR), autoescape=select_autoescape())

def normalize_accept_language(val: Optional[str]) -> Optional[str]:
    if not val:
        return None
    # pick first language tag
    tag = val.split(',')[0].strip()
    if not tag:
        return None
    # Convert en-US -> en_US, pt-br -> pt_BR
    parts = re.split('[-_]', tag)
    if not parts:
        return None
    lang = parts[0].lower()
    region = parts[1].upper() if len(parts) > 1 else None
    candidate = f"{lang}_{region}" if region else None
    # direct match or by language fallback
    if candidate and candidate in SUPPORTED_LOCALES:
        return candidate
    # try language-only mapping
    for sl in SUPPORTED_LOCALES:
        if sl.lower().startswith(lang + '_'):
            return sl
    return None

def get_locale(request: Request) -> str:
    # user preference from request.state if any
    user_locale = getattr(request.state, 'user_locale', None)
    if user_locale:
        current_locale_var.set(user_locale)
        return user_locale
    # Accept-Language
    al = request.headers.get('accept-language') or request.headers.get('Accept-Language')
    cand = normalize_accept_language(al)
    if cand:
        current_locale_var.set(cand)
        return cand
    current_locale_var.set(DEFAULT_LOCALE)
    return DEFAULT_LOCALE

def resolve_locale(request: Request) -> str:
    return get_locale(request)

# Optional dependency to load user locale from DB when authenticated
try:
    from .auth import get_current_user, Principal  # type: ignore
    from .db import get_db  # type: ignore
    from sqlalchemy.orm import Session  # type: ignore

    def inject_user_locale(
        request: Request,
        principal: 'Principal' = Depends(get_current_user),
        db: 'Session' = Depends(get_db),
    ) -> str:
        try:
            from . import models  # local import to avoid cycles
            user = db.query(models.User).filter(models.User.email == principal['email']).first()
            if user and user.locale:
                request.state.user_locale = user.locale
        except Exception:
            pass
        return get_locale(request)
except Exception:
    # In migrations or contexts where deps aren't available
    def inject_user_locale(request: Request) -> str:  # type: ignore
        return get_locale(request)

def format_currency(value: float, currency: str, locale: Optional[str] = None) -> str:
    loc = locale or current_locale_var.get()
    return _fmt_curr(value, currency, locale=loc)

def format_decimal(value: float, locale: Optional[str] = None) -> str:
    loc = locale or current_locale_var.get()
    return _fmt_dec(value, locale=loc)

def format_datetime(dt, locale: Optional[str] = None) -> str:
    loc = locale or current_locale_var.get()
    return _fmt_dt(dt, locale=loc, format='medium')

def render_template(name: str, locale: str, ctx: dict) -> str:
    """Render a template with locale fallback.
    name example: 'policies/refund.md.j2' (base). This function will try
    'policies/refund.pt.md.j2' when locale starts with 'pt', then fallback to 'en'.
    """
    # split name
    base, ext = (name.split('.md.j2')[0], '.md.j2') if name.endswith('.md.j2') else (name, '')
    # map locale to language code
    lang = (locale or DEFAULT_LOCALE).split('_')[0]
    candidates = [f"{base}.{lang}{ext}", f"{base}.en{ext}", name]
    for cand in candidates:
        try:
            tmpl = _env.get_template(cand)
            return tmpl.render(**ctx)
        except TemplateNotFound:
            continue
    raise TemplateNotFound(name)
