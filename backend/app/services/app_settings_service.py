from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings as env_settings
from app.models.organization import AppSettings


async def get_or_create_app_settings(db: AsyncSession) -> AppSettings:
    result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    row = result.scalar_one_or_none()
    if row:
        return row

    row = AppSettings(
        id=1,
        organization_name=env_settings.COMPANY_NAME,
        organization_email=env_settings.COMPANY_EMAIL,
        from_email=env_settings.COMPANY_EMAIL,
        onedrive_folder=env_settings.ONEDRIVE_FOLDER,
    )
    db.add(row)
    await db.flush()
    return row
