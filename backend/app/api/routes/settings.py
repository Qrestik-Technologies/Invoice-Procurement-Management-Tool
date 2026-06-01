from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr

from app.core.config import settings
from app.core.security import require_roles
from app.models.enums import TemplateType, UserRole
from app.models.users import User
from app.schemas import APIResponse
from app.services.app_settings import load_settings, save_settings

router = APIRouter(prefix="/settings", tags=["settings"])


class CompanySettings(BaseModel):
    company_name: str
    company_email: EmailStr
    business_address: str = ""


class EmailSettings(BaseModel):
    from_email: EmailStr


class TemplateSettings(BaseModel):
    default_template: TemplateType
    default_payment_terms: str = "Net 30"


class SettingsRead(BaseModel):
    company_name: str
    company_email: str
    business_address: str
    from_email: str
    default_template: str
    default_payment_terms: str
    sendgrid_configured: bool


@router.get("", response_model=APIResponse[SettingsRead])
async def get_settings(_: Annotated[User, Depends(require_roles(UserRole.admin))]):
    data = load_settings()
    return APIResponse(
        data=SettingsRead(
            company_name=data["company_name"],
            company_email=data["company_email"],
            business_address=data.get("business_address", ""),
            from_email=data.get("from_email", data["company_email"]),
            default_template=data.get("default_template", TemplateType.standard.value),
            default_payment_terms=data.get("default_payment_terms", "Net 30"),
            sendgrid_configured=bool(settings.SENDGRID_API_KEY),
        )
    )


@router.put("/company", response_model=APIResponse[SettingsRead])
async def update_company(
    body: CompanySettings,
    current: Annotated[User, Depends(require_roles(UserRole.admin))],
):
    save_settings(body.model_dump())
    return await get_settings(current)


@router.put("/email", response_model=APIResponse[SettingsRead])
async def update_email(
    body: EmailSettings,
    current: Annotated[User, Depends(require_roles(UserRole.admin))],
):
    save_settings({"from_email": str(body.from_email), "company_email": str(body.from_email)})
    return await get_settings(current)


@router.put("/template", response_model=APIResponse[SettingsRead])
async def update_template(
    body: TemplateSettings,
    current: Annotated[User, Depends(require_roles(UserRole.admin))],
):
    save_settings(
        {
            "default_template": body.default_template.value,
            "default_payment_terms": body.default_payment_terms,
        }
    )
    return await get_settings(current)
