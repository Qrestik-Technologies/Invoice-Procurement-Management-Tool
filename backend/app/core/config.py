from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    APP_NAME: str = "Invoice Management API"
    APP_ENV: str = "development"
    DEBUG: bool = False

    DATABASE_URL: str
    REDIS_URL: str = "redis://redis:6379/0"
    SECRET_KEY: str
    CORS_ORIGINS: str = (
        "http://localhost:5173,http://localhost:3000,http://localhost,http://localhost:80"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    SENDGRID_API_KEY: str | None = None
    COMPANY_EMAIL: str = "noreply@qrestik.com"
    COMPANY_NAME: str = "Qrestik"

    ONEDRIVE_CLIENT_ID: str | None = None
    ONEDRIVE_CLIENT_SECRET: str | None = None
    ONEDRIVE_TENANT_ID: str | None = None
    ONEDRIVE_FOLDER: str = "Invoices"

    UPLOAD_DIR: str = "/tmp/invoice_uploads"
    MAX_UPLOAD_BYTES: int = 20 * 1024 * 1024  # 20 MB

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> str:
        if isinstance(value, list):
            return ",".join(value)
        return value

    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
