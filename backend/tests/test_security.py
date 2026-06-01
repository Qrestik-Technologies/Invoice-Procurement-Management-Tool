import pytest

from app.core.config import Settings
from app.core.passwords import hash_password, verify_password


def test_password_hash_and_verify():
    hashed = hash_password("secret-password")
    assert hashed != "secret-password"
    assert verify_password("secret-password", hashed)
    assert not verify_password("wrong", hashed)


def test_production_rejects_weak_jwt():
    with pytest.raises(ValueError, match="JWT_SECRET"):
        Settings(
            APP_ENV="production",
            JWT_SECRET="change-me-in-production",
        )
