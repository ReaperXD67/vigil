from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "sqlite:///./vigil.db"
    app_env: Literal["development", "test", "production"] = "development"
    allowed_origins: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173"
    cookie_secure: bool = False
    check_worker_enabled: bool = False
    check_interval_seconds: int = Field(default=300, ge=60, le=86400)
    session_hours: int = Field(default=24, ge=1, le=720)
    demo_hours: int = Field(default=24, ge=1, le=168)
    max_demo_workspaces: int = Field(default=200, ge=1, le=10000)
    max_registered_workspaces: int = Field(default=500, ge=1, le=100000)

    @model_validator(mode="after")
    def validate_origins(self):
        if not self.origins:
            raise ValueError("At least one ALLOWED_ORIGINS value is required")
        for origin in self.origins:
            parsed = urlsplit(origin)
            if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment or "*" in origin:
                raise ValueError("ALLOWED_ORIGINS must contain exact HTTP(S) origins without paths or wildcards")
            if self.app_env == "production" and parsed.scheme != "https":
                raise ValueError("Production ALLOWED_ORIGINS must use HTTPS")
        return self

    @property
    def origins(self) -> list[str]:
        return [x.strip().rstrip("/") for x in self.allowed_origins.split(",") if x.strip()]

    @property
    def secure_cookies(self) -> bool:
        return self.cookie_secure or self.app_env == "production"


settings = Settings()
