"""Admin user management — admin only."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rbac import require_admin
from app.core.security import hash_password
from app.models.organization import Company
from app.models.users import User
from app.schemas import APIResponse, UserCreate, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=APIResponse[list[UserRead]])
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(require_admin),
):
    result = await db.execute(select(User).order_by(User.id))
    users = result.scalars().all()
    return APIResponse(data=[UserRead.model_validate(u) for u in users])


@router.post("", response_model=APIResponse[UserRead], status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(require_admin),
):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    if body.company_id is not None:
        company = await db.get(Company, body.company_id)
        if not company:
            raise HTTPException(status_code=400, detail="Company not found")

    user = User(
        name=body.name,
        email=body.email,
        hashed_password=hash_password(body.password),
        role=body.role,
        company_id=body.company_id,
        is_active=True,  # admin-created accounts are active by default
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return APIResponse(data=UserRead.model_validate(user), message="User created")


@router.put("/{user_id}", response_model=APIResponse[UserRead])
async def update_user(
    user_id: int,
    body: UserUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    updates = body.model_dump(exclude_unset=True)
    if "company_id" in updates and updates["company_id"] is not None:
        company = await db.get(Company, updates["company_id"])
        if not company:
            raise HTTPException(status_code=400, detail="Company not found")

    password = updates.pop("password", None)
    for field, value in updates.items():
        setattr(user, field, value)
    if password:
        user.hashed_password = hash_password(password)
    await db.commit()
    await db.refresh(user)
    return APIResponse(data=UserRead.model_validate(user), message="User updated")


@router.delete("/{user_id}", response_model=APIResponse[None])
async def delete_user(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_admin),
):
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()
    return APIResponse(message="User deleted")
