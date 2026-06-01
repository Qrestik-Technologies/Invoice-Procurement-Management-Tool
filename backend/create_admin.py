"""B3 FIX: Bootstrap script to seed the first admin user.
/register hard-codes role=entry and is_active=False, so no admin can be
created via the API. Run this once after `alembic upgrade head`.

Usage:
    python create_admin.py --email admin@qrestik.com --password admin123 --name "Admin"
"""
import argparse, asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.core.security import hash_password
from app.models.users import User
from app.models.enums import UserRole


async def create_admin(email: str, password: str, name: str) -> None:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        result = await session.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none():
            print(f"[create_admin] '{email}' already exists — no changes made.")
            await engine.dispose()
            return
        admin = User(name=name, email=email, hashed_password=hash_password(password),
                     role=UserRole.admin, is_active=True)
        session.add(admin)
        await session.commit()
        print(f"[create_admin] ✅ Admin created: {email}")
    await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", default="admin@qrestik.com")
    parser.add_argument("--password", default="admin123")
    parser.add_argument("--name", default="Admin")
    args = parser.parse_args()
    asyncio.run(create_admin(args.email, args.password, args.name))
