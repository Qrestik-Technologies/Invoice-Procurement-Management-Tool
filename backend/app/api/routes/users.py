from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, hash_password, require_roles
from app.models.enums import UserRole
from app.models.users import User
from app.schemas import APIResponse, UserCreate, UserRead, UserUpdate
from app.services.audit_service import write_audit_log
from app.services.invoice_helpers import model_to_dict

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=APIResponse[list[UserRead]])
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.admin))],
):
    result = await db.execute(select(User).order_by(User.name))
    users = result.scalars().all()
    return APIResponse(data=[UserRead.model_validate(u) for u in users])


@router.post("", response_model=APIResponse[UserRead], status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(require_roles(UserRole.admin))],
):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        name=body.name,
        email=body.email,
        hashed_password=hash_password(body.password),
        role=body.role,
        is_active=body.is_active,
    )
    db.add(user)
    await db.flush()
    await write_audit_log(
        db,
        table_name="users",
        record_id=user.id,
        action="create",
        changed_by=current.id,
        new_value=model_to_dict(user, ["name", "email", "role", "is_active"]),
    )
    await db.commit()
    await db.refresh(user)
    return APIResponse(data=UserRead.model_validate(user))


@router.put("/{user_id}", response_model=APIResponse[UserRead])
async def update_user(
    user_id: int,
    body: UserUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(require_roles(UserRole.admin))],
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    old = model_to_dict(user, ["name", "email", "role", "is_active"])
    data = body.model_dump(exclude_unset=True)
    if "password" in data:
        user.hashed_password = hash_password(data.pop("password"))
    for k, v in data.items():
        setattr(user, k, v)
    await write_audit_log(
        db,
        table_name="users",
        record_id=user.id,
        action="update",
        changed_by=current.id,
        old_value=old,
        new_value=model_to_dict(user, ["name", "email", "role", "is_active"]),
    )
    await db.commit()
    await db.refresh(user)
    return APIResponse(data=UserRead.model_validate(user))


@router.delete("/{user_id}", response_model=APIResponse[None])
async def delete_user(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(require_roles(UserRole.admin))],
):
    if user_id == current.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    old = model_to_dict(user, ["name", "email", "role", "is_active"])
    await db.delete(user)
    await write_audit_log(
        db,
        table_name="users",
        record_id=user_id,
        action="delete",
        changed_by=current.id,
        old_value=old,
    )
    await db.commit()
    return APIResponse(message="User deleted")
