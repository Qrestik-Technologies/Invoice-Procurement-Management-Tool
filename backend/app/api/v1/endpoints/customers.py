"""Customer CRUD endpoints."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rbac import require_admin, require_any_role, require_entry_or_above
from app.models.domain import Customer
from app.models.enums import AuditAction
from app.schemas import APIResponse, CustomerCreate, CustomerRead, CustomerUpdate
from app.services.audit_service import write_audit

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("", response_model=APIResponse[list[CustomerRead]])
async def list_customers(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_any_role),
):
    result = await db.execute(select(Customer).order_by(Customer.name))
    return APIResponse(data=[CustomerRead.model_validate(c) for c in result.scalars().all()])


@router.get("/{customer_id}", response_model=APIResponse[CustomerRead])
async def get_customer(
    customer_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(require_any_role),
):
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return APIResponse(data=CustomerRead.model_validate(customer))


@router.post("", response_model=APIResponse[CustomerRead], status_code=status.HTTP_201_CREATED)
async def create_customer(
    body: CustomerCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_entry_or_above),
):
    customer = Customer(**body.model_dump())
    db.add(customer)
    await db.flush()
    await write_audit(db, changed_by=current_user.id, entity_type="customer",
                      entity_id=customer.id, action=AuditAction.created)
    await db.commit()
    await db.refresh(customer)
    return APIResponse(data=CustomerRead.model_validate(customer), message="Customer created")


@router.put("/{customer_id}", response_model=APIResponse[CustomerRead])
async def update_customer(
    customer_id: int,
    body: CustomerUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_entry_or_above),
):
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(customer, field, value)
    await write_audit(db, changed_by=current_user.id, entity_type="customer",
                      entity_id=customer_id, action=AuditAction.updated)
    await db.commit()
    await db.refresh(customer)
    return APIResponse(data=CustomerRead.model_validate(customer), message="Customer updated")


@router.delete("/{customer_id}", response_model=APIResponse[None])
async def delete_customer(
    customer_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_admin),
):
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    await write_audit(db, changed_by=current_user.id, entity_type="customer",
                      entity_id=customer_id, action=AuditAction.deleted)
    await db.delete(customer)
    await db.commit()
    return APIResponse(message="Customer deleted")
