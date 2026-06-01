import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    pwd_context,
    verify_password,
)
from app.models.enums import UserRole
from app.models.users import User
from app.schemas import (
    APIResponse,
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResendCodeRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserRead,
    VerifyEmailRequest,
)
from app.services.email_service import send_code_email

router = APIRouter(prefix="/auth", tags=["auth"])

CODE_TTL_MINUTES = 10


def _generate_code() -> str:
    """Cryptographically-random 6-digit code, e.g. '048213'."""
    return f"{secrets.randbelow(1_000_000):06d}"


def _set_code(user: User) -> str:
    """Generate a fresh code, store it hashed with an expiry, return the plain code."""
    code = _generate_code()
    user.verification_code = pwd_context.hash(code)
    user.verification_code_expires = datetime.now(timezone.utc) + timedelta(minutes=CODE_TTL_MINUTES)
    return code


def _code_valid(user: User, code: str) -> bool:
    if not user.verification_code or not user.verification_code_expires:
        return False
    expires = user.verification_code_expires
    if expires.tzinfo is None:  # stored as naive UTC by some drivers
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        return False
    return pwd_context.verify(code, user.verification_code)


@router.post("/register", response_model=APIResponse[None], status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=body.name,
        email=body.email,
        hashed_password=hash_password(body.password),
        role=UserRole.entry,  # public sign-ups can never self-assign admin
        is_active=False,       # inactive until the email is verified
    )
    code = _set_code(user)
    db.add(user)
    await db.commit()

    await run_in_threadpool(send_code_email, body.email, code, "verify")
    return APIResponse(message="Verification code sent to your email")


@router.post("/verify-email", response_model=APIResponse[None])
async def verify_email(body: VerifyEmailRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Account not found")
    if user.is_active:
        return APIResponse(message="Email already verified")
    if not _code_valid(user, body.code):
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    user.is_active = True
    user.verification_code = None
    user.verification_code_expires = None
    await db.commit()
    return APIResponse(message="Email verified \u2014 you can now sign in")


@router.post("/resend-code", response_model=APIResponse[None])
async def resend_code(body: ResendCodeRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if user and not user.is_active:
        code = _set_code(user)
        await db.commit()
        await run_in_threadpool(send_code_email, body.email, code, "verify")
    # Generic response so the endpoint can't be used to probe which emails exist.
    return APIResponse(message="If the account needs verification, a new code has been sent")


@router.post("/login", response_model=APIResponse[TokenResponse])
async def login(body: LoginRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        # 403 lets the frontend route the user to the verify screen.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please verify your email to sign in.",
        )
    token = create_access_token(user.email, {"role": user.role.value, "user_id": user.id})
    return APIResponse(data=TokenResponse(access_token=token))


@router.post("/forgot-password", response_model=APIResponse[None])
async def forgot_password(body: ForgotPasswordRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if user and user.is_active:
        code = _set_code(user)
        await db.commit()
        await run_in_threadpool(send_code_email, body.email, code, "reset")
    # Always generic to avoid account enumeration.
    return APIResponse(message="If an account exists for that email, a reset code has been sent")


@router.post("/reset-password", response_model=APIResponse[None])
async def reset_password(body: ResetPasswordRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if user is None or not _code_valid(user, body.code):
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    user.hashed_password = hash_password(body.new_password)
    user.verification_code = None
    user.verification_code_expires = None
    await db.commit()
    return APIResponse(message="Password updated \u2014 you can now sign in")


@router.get("/me", response_model=APIResponse[UserRead])
async def me(user: Annotated[User, Depends(get_current_user)]):
    return APIResponse(data=UserRead.model_validate(user))
