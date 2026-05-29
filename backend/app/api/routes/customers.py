from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.customers import Customer
from app.models.enums import UserRole
from app.models.invoices import Invoice
from app.models.users import User
from app.schemas import APIResponse, CustomerCreate, CustomerRead, CustomerUpdate
from app.services.audit_service import write_audit_log
from app.services.invoice_helpers import model_to_dict

router = APIRouter(prefix="/customers", tags=["customers"])


async def _customer_read(db: AsyncSession, customer: Customer) -> CustomerRead:
    total_q = await db.execute(
        select(func.coalesce(func.sum(Invoice.total), 0)).where(Invoice.customer_id == customer.id)
    )
    total = float(total_q.scalar() or 0)
    data = CustomerRead.model_validate(customer)
    data.total_invoiced = total
    return data


@router.get("", response_model=APIResponse[list[CustomerRead]])
async def list_customers(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(select(Customer).order_by(Customer.name))
    customers = result.scalars().all()
    return APIResponse(data=[await _customer_read(db, c) for c in customers])


@router.post("", response_model=APIResponse[CustomerRead], status_code=status.HTTP_201_CREATED)
async def create_customer(
    body: CustomerCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(require_roles(UserRole.admin, UserRole.entry))],
):
    customer = Customer(**body.model_dump())
    db.add(customer)
    await db.flush()
    await write_audit_log(
        db,
        table_name="customers",
        record_id=customer.id,
        action="create",
        changed_by=current.id,
        new_value=body.model_dump(mode="json"),
    )
    await db.commit()
    await db.refresh(customer)
    return APIResponse(data=await _customer_read(db, customer))


@router.put("/{customer_id}", response_model=APIResponse[CustomerRead])
async def update_customer(
    customer_id: int,
    body: CustomerUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(require_roles(UserRole.admin, UserRole.entry))],
):
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    old = model_to_dict(customer, ["name", "email", "phone", "template_type", "ship_to_address"])
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(customer, k, v)
    await write_audit_log(
        db,
        table_name="customers",
        record_id=customer.id,
        action="update",
        changed_by=current.id,
        old_value=old,
        new_value=model_to_dict(customer, ["name", "email", "phone", "template_type", "ship_to_address"]),
    )
    await db.commit()
    await db.refresh(customer)
    return APIResponse(data=await _customer_read(db, customer))
