from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    APP_NAME: str = "Invoice Management Tool"
    APP_VERSION: str = "0.1.0"
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

    UPLOAD_DIR: str = "/app/uploads"
    MILESTONE_ALERT_EMAILS: list[str] = [
        "vivek@qrestik.com",
        "akhilan@qrestik.com",
        "deepak@qrestik.com",
    ]
    PAYMENT_REMINDER_INTERVAL_DAYS: int = 7

    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000", "http://localhost"]


settings = Settings()
