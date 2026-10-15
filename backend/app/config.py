from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "sqlite:///./vigil.db"
    app_env: str = "development"
    allowed_origins: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173"
    cookie_secure: bool = False
    check_worker_enabled: bool = False
    check_interval_seconds: int = 300
    session_hours: int = 24
    demo_hours: int = 24
    max_demo_workspaces: int = 200

    @property
    def origins(self) -> list[str]:
        return [x.strip().rstrip("/") for x in self.allowed_origins.split(",") if x.strip()]

    @property
    def secure_cookies(self) -> bool:
        return self.cookie_secure or self.app_env == "production"


settings = Settings()
