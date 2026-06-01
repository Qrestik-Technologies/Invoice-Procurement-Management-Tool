"""Create the first admin user in production (no demo seed)."""

import argparse
import asyncio

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.passwords import hash_password
from app.models.enums import UserRole
from app.models.users import User


async def main(email: str, password: str, name: str) -> None:
    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(User).where(User.email == email))
        if existing.scalar_one_or_none():
            raise SystemExit(f"User already exists: {email}")
        user = User(
            name=name,
            email=email,
            hashed_password=hash_password(password),
            role=UserRole.admin,
            is_active=True,
        )
        db.add(user)
        await db.commit()
    print(f"Admin user created: {email}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create production admin user")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--name", default="Administrator")
    args = parser.parse_args()
    asyncio.run(main(args.email, args.password, args.name))
