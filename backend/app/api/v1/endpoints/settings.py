"""Application settings — admin only."""
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings as env_settings
from app.core.database import get_db
from app.core.rbac import require_admin
from app.schemas import (
    APIResponse,
    AppSettingsRead,
    EmailSettingsUpdate,
    IntegrationsStatus,
    InvoiceDefaultsUpdate,
    OrganizationSettingsUpdate,
    SettingsBundle,
)
from app.services.app_settings_service import get_or_create_app_settings

router = APIRouter(prefix="/settings", tags=["settings"])


def _integrations_status() -> IntegrationsStatus:
    return IntegrationsStatus(
        sendgrid_configured=bool(env_settings.SENDGRID_API_KEY),
        onedrive_configured=bool(
            env_settings.ONEDRIVE_CLIENT_ID
            and env_settings.ONEDRIVE_CLIENT_SECRET
            and env_settings.ONEDRIVE_TENANT_ID
        ),
        sendgrid_from_env=env_settings.COMPANY_EMAIL if env_settings.SENDGRID_API_KEY else None,
        onedrive_folder_env=env_settings.ONEDRIVE_FOLDER,
    )


@router.get("", response_model=APIResponse[SettingsBundle])
async def get_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(require_admin),
):
    row = await get_or_create_app_settings(db)
    await db.commit()
    return APIResponse(
        data=SettingsBundle(
            settings=AppSettingsRead.model_validate(row),
            integrations=_integrations_status(),
        )
    )


@router.put("/organization", response_model=APIResponse[AppSettingsRead])
async def update_organization_settings(
    body: OrganizationSettingsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(require_admin),
):
    row = await get_or_create_app_settings(db)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(row, field, value)
    await db.commit()
    await db.refresh(row)
    return APIResponse(data=AppSettingsRead.model_validate(row), message="Organization settings saved")


@router.put("/email", response_model=APIResponse[AppSettingsRead])
async def update_email_settings(
    body: EmailSettingsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(require_admin),
):
    row = await get_or_create_app_settings(db)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(row, field, value)
    await db.commit()
    await db.refresh(row)
    return APIResponse(data=AppSettingsRead.model_validate(row), message="Email settings saved")


@router.put("/invoice-defaults", response_model=APIResponse[AppSettingsRead])
async def update_invoice_defaults(
    body: InvoiceDefaultsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(require_admin),
):
    row = await get_or_create_app_settings(db)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(row, field, value)
    await db.commit()
    await db.refresh(row)
    return APIResponse(data=AppSettingsRead.model_validate(row), message="Invoice defaults saved")
