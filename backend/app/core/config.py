from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Invoice Management API"
    DEBUG: bool = False

    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str
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

    class Config:
        env_file = ".env"


settings = Settings()
