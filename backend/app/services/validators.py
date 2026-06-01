from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customers import Customer
from app.models.invoices import Invoice
from app.models.milestones import Milestone


async def require_customer(db: AsyncSession, customer_id: int) -> Customer:
    from fastapi import HTTPException

    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if customer is None:
        raise HTTPException(status_code=400, detail=f"Customer {customer_id} not found")
    return customer


async def require_milestone(db: AsyncSession, milestone_id: int) -> Milestone:
    from fastapi import HTTPException

    result = await db.execute(select(Milestone).where(Milestone.id == milestone_id))
    milestone = result.scalar_one_or_none()
    if milestone is None:
        raise HTTPException(status_code=400, detail=f"Milestone {milestone_id} not found")
    return milestone


async def require_invoice(db: AsyncSession, invoice_id: int) -> Invoice:
    from fastapi import HTTPException

    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if invoice is None:
        raise HTTPException(status_code=400, detail=f"Invoice {invoice_id} not found")
    return invoice
