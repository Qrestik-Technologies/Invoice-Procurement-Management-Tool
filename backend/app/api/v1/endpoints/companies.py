"""Company (tenant entity) management — admin only."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rbac import require_admin, require_any_role
from app.models.enums import UserRole
from app.models.organization import Company
from app.schemas import APIResponse, CompanyCreate, CompanyRead, CompanyUpdate

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("", response_model=APIResponse[list[CompanyRead]])
async def list_companies(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_any_role),
):
    q = select(Company).order_by(Company.name)
    if current_user.role != UserRole.admin:
        q = q.where(Company.is_active.is_(True))
    result = await db.execute(q)
    return APIResponse(data=[CompanyRead.model_validate(c) for c in result.scalars().all()])


@router.get("/{company_id}", response_model=APIResponse[CompanyRead])
async def get_company(
    company_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(require_any_role),
):
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return APIResponse(data=CompanyRead.model_validate(company))


@router.post("", response_model=APIResponse[CompanyRead], status_code=status.HTTP_201_CREATED)
async def create_company(
    body: CompanyCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(require_admin),
):
    company = Company(**body.model_dump())
    db.add(company)
    await db.commit()
    await db.refresh(company)
    return APIResponse(data=CompanyRead.model_validate(company), message="Company created")


@router.put("/{company_id}", response_model=APIResponse[CompanyRead])
async def update_company(
    company_id: int,
    body: CompanyUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(require_admin),
):
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(company, field, value)
    await db.commit()
    await db.refresh(company)
    return APIResponse(data=CompanyRead.model_validate(company), message="Company updated")


@router.delete("/{company_id}", response_model=APIResponse[None])
async def delete_company(
    company_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(require_admin),
):
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    await db.delete(company)
    await db.commit()
    return APIResponse(message="Company deleted")
