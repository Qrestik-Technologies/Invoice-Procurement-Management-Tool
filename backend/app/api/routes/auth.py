from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import check_rate_limit, reset_rate_limit
from app.core.security import create_access_token, get_current_user, verify_password
from app.models.users import User
from app.schemas import APIResponse, LoginRequest, TokenResponse, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/login", response_model=APIResponse[TokenResponse])
async def login(
    body: LoginRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ip = _client_ip(request)
    rate_key = f"login:{ip}:{body.email.lower()}"
    allowed, retry_after = check_rate_limit(
        rate_key,
        settings.LOGIN_RATE_LIMIT,
        settings.LOGIN_RATE_WINDOW_SECONDS,
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many login attempts. Try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    reset_rate_limit(rate_key)
    token = create_access_token(user.email, {"role": user.role.value, "user_id": user.id})
    return APIResponse(data=TokenResponse(access_token=token))


@router.get("/me", response_model=APIResponse[UserRead])
async def me(user: Annotated[User, Depends(get_current_user)]):
    return APIResponse(data=UserRead.model_validate(user))
