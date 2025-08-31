# api/app/core/settings.py
from typing import Optional, List
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000

    # Chaves de segurança e JWT
    JWT_SECRET: Optional[str] = None
    SECRET_KEY: Optional[str] = None  # Legacy fallback
    FERNET_KEY: Optional[str] = None
    FERNET_KEYS: Optional[str] = None

    # Conexões de base de dados e cache
    DATABASE_URL: str = "sqlite+aiosqlite:///./dev.db"
    REDIS_URL: str = "redis://redis:6379/0"

    # Configurações do Crawler e Artefactos
    ARTIFACTS_BASE_PATH: str = "artifacts/"
    CRAWLER_REWRITE_FROM: Optional[str] = None
    CRAWLER_REWRITE_TO: Optional[str] = None
    HEADLESS: bool = True

    # Configurações de CORS
    ALLOWED_ORIGINS: Optional[str] = None
    CORS_ORIGINS: Optional[str] = None # Legacy fallback/alias

    # Google OAuth
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_OAUTH_REDIRECT_URI: Optional[AnyHttpUrl] = None
    GOOGLE_OAUTH_SCOPES_BASE: str = "openid email profile"
    GOOGLE_OAUTH_SCOPES_CONTENT: str = (
        "openid email profile https://www.googleapis.com/auth/content"
    )
    GOOGLE_OAUTH_ISSUER: str = "https://accounts.google.com"
    GOOGLE_API_BASE: str = "https://www.googleapis.com"
    GOOGLE_AUTH_ENDPOINT: Optional[AnyHttpUrl] = None
    GOOGLE_TOKEN_ENDPOINT: Optional[AnyHttpUrl] = None
    GOOGLE_USERINFO_ENDPOINT: Optional[AnyHttpUrl] = None

    # Integração S3 (MinIO)
    S3_BUCKET: Optional[str] = None
    S3_ENDPOINT: Optional[AnyHttpUrl] = None
    S3_ACCESS_KEY: Optional[str] = None
    S3_SECRET_KEY: Optional[str] = None

    # Integração Stripe
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None


    # i18n
    DEFAULT_LOCALE: str = "en_US"
    SUPPORTED_LOCALES: List[str] = ["en_US", "pt_BR", "es_ES"]

    # pydantic-settings v2
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )

    # permite SUPPORTED_LOCALES como "en_US,pt_BR,es_ES" no .env
    @field_validator("SUPPORTED_LOCALES", mode="before")
    @classmethod
    def _coerce_supported_locales(cls, v):
        if isinstance(v, str):
            return [s.strip() for s in v.split(",") if s.strip()]
        return v

    @property
    def effective_jwt_secret(self) -> str:
        return self.JWT_SECRET or self.SECRET_KEY or "changeme"