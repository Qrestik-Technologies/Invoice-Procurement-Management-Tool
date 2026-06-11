import pytest

from app.core.config import Settings
from app.core.passwords import hash_password, verify_password


def test_password_hash_and_verify():
    hashed = hash_password("secret-password")
    assert hashed != "secret-password"
    assert verify_password("secret-password", hashed)
    assert not verify_password("wrong", hashed)


def test_settings_load_with_secret_key():
    loaded = Settings(
        DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/invoice_tool",
        SECRET_KEY="a-long-random-production-secret-key",
    )
    assert loaded.SECRET_KEY.startswith("a-long")
