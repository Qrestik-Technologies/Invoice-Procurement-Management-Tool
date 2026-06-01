from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

WEAK_JWT_SECRETS = frozenset(
    {
        "change-me-in-production",
        "change-me-in-production-use-a-long-random-string",
        "secret",
        "dev",
    }
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    APP_NAME: str = "Invoice Management Tool"
    APP_VERSION: str = "0.1.0"
    APP_ENV: str = "development"
    DEBUG: bool = False

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/invoice_tool"
    REDIS_URL: str = "redis://localhost:6379/0"

    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    SENDGRID_API_KEY: str = ""
    COMPANY_EMAIL: str = ""
    COMPANY_NAME: str = "Qrestik Services LLC"

    ONEDRIVE_CLIENT_ID: str = ""
    ONEDRIVE_CLIENT_SECRET: str = ""
    ONEDRIVE_TENANT_ID: str = ""
    ONEDRIVE_DRIVE_ID: str = ""

    UPLOAD_DIR: str = "/app/uploads"
    MAX_UPLOAD_BYTES: int = 10 * 1024 * 1024
    MILESTONE_ALERT_EMAILS: list[str] = [
        "vivek@qrestik.com",
        "akhilan@qrestik.com",
        "deepak@qrestik.com",
    ]
    PAYMENT_REMINDER_INTERVAL_DAYS: int = 7
    LOGIN_RATE_LIMIT: int = 10
    LOGIN_RATE_WINDOW_SECONDS: int = 300

    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000", "http://localhost"]

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() == "production"

    @field_validator("JWT_SECRET")
    @classmethod
    def jwt_secret_not_empty(cls, v: str) -> str:
        if not v or len(v.strip()) < 16:
            raise ValueError("JWT_SECRET must be at least 16 characters")
        return v

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        if self.is_production:
            if self.JWT_SECRET.lower() in WEAK_JWT_SECRETS or len(self.JWT_SECRET) < 32:
                raise ValueError(
                    "JWT_SECRET must be a strong random string (32+ chars) in production"
                )
        return self


settings = Settings()
