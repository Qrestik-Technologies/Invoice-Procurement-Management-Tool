
from typing import Annotated

from fastapi import Depends, HTTPException, status

from app.core.security import get_current_user
from app.models.enums import UserRole
from app.models.users import User


def _role_checker(*allowed: UserRole):

    async def dep(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {[r.value for r in allowed]}",
            )
        return user

    return dep



require_admin = _role_checker(UserRole.admin)
require_entry_or_above = _role_checker(UserRole.admin, UserRole.entry)
require_any_role = _role_checker(UserRole.admin, UserRole.entry, UserRole.readonly)

require_authenticated = get_current_user
