from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl
from typing import Optional


class Settings(BaseSettings):
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000

    JWT_SECRET: Optional[str] = None
    SECRET_KEY: Optional[str] = None  # legacy fallback

    DATABASE_URL: str = "sqlite+aiosqlite:///./dev.db"
    REDIS_URL: str = "redis://redis:6379/0"

    ARTIFACTS_BASE_PATH: str = "artifacts/"
    CRAWLER_REWRITE_FROM: Optional[str] = None
    CRAWLER_REWRITE_TO: Optional[str] = None
    HEADLESS: bool = True

    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_OAUTH_REDIRECT_URI: Optional[AnyHttpUrl] = None
    GOOGLE_OAUTH_SCOPES_BASE: str = "openid email profile"
    GOOGLE_OAUTH_SCOPES_CONTENT: str = (
        "openid email profile https://www.googleapis.com/auth/content"
    )
    GOOGLE_OAUTH_ISSUER: str = "https://accounts.google.com"
    GOOGLE_API_BASE: str = "https://www.googleapis.com"

    class Config:
        env_file = ".env"
        case_sensitive = True

    @property
    def effective_jwt_secret(self) -> str:
        return self.JWT_SECRET or self.SECRET_KEY or "changeme"
