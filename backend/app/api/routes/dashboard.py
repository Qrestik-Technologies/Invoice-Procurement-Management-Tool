from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.enums import InvoiceStatus, POStatus
from app.models.purchase_orders import PurchaseOrder
from app.models.invoices import Invoice
from app.models.milestones import Milestone
from app.models.payments import Payment
from app.models.users import User
from app.schemas import APIResponse

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=APIResponse[dict])
async def dashboard_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    total = await db.scalar(select(func.count(Invoice.id)))
    pending_amount = await db.scalar(
        select(func.coalesce(func.sum(Invoice.total), 0)).where(
            Invoice.status.in_([InvoiceStatus.pending, InvoiceStatus.dispatched])
        )
    )
    overdue = await db.scalar(
        select(func.count(Invoice.id)).where(Invoice.status == InvoiceStatus.overdue)
    )
    from datetime import date

    today = date.today()
    received_month = await db.scalar(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            func.extract("month", Payment.received_date) == today.month,
            func.extract("year", Payment.received_date) == today.year,
        )
    )
    status_breakdown = {}
    for status in InvoiceStatus:
        count = await db.scalar(select(func.count(Invoice.id)).where(Invoice.status == status))
        if count:
            status_breakdown[status.value] = count

    # PO stats
    from datetime import timedelta
    total_active_pos = await db.scalar(
        select(func.count(PurchaseOrder.id)).where(PurchaseOrder.status == POStatus.active)
    )
    total_po_value = await db.scalar(
        select(func.coalesce(func.sum(PurchaseOrder.total_value), 0)).where(
            PurchaseOrder.status == POStatus.active
        )
    )
    pos_expiring_this_month = await db.scalar(
        select(func.count(PurchaseOrder.id)).where(
            PurchaseOrder.expiry_date >= today,
            PurchaseOrder.expiry_date <= today + timedelta(days=30),
            PurchaseOrder.status.in_([POStatus.active, POStatus.partially_invoiced]),
        )
    )
    pos_not_invoiced = await db.scalar(
        select(func.count(PurchaseOrder.id)).where(
            PurchaseOrder.status == POStatus.active,
        )
    )

    return APIResponse(
        data={
            "total_invoices": total or 0,
            "pending_amount": float(pending_amount or 0),
            "overdue_count": overdue or 0,
            "received_this_month": float(received_month or 0),
            "status_breakdown": status_breakdown,
            "total_active_pos": total_active_pos or 0,
            "total_po_value": float(total_po_value or 0),
            "pos_expiring_this_month": pos_expiring_this_month or 0,
            "pos_not_invoiced": pos_not_invoiced or 0,
        }
    )


@router.get("/upcoming-milestones", response_model=APIResponse[list[dict]])
async def upcoming_milestones(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    days: int = 7,
):
    from datetime import date, timedelta
    from sqlalchemy.orm import selectinload

    today = date.today()
    end = today + timedelta(days=days)
    result = await db.execute(
        select(Milestone)
        .options(selectinload(Milestone.customer), selectinload(Milestone.invoices))
        .where(Milestone.end_date >= today, Milestone.end_date <= end)
        .order_by(Milestone.end_date)
    )
    items = []
    for m in result.scalars().all():
        linked = m.invoices[0].invoice_number if m.invoices else None
        items.append(
            {
                "id": m.id,
                "project_name": m.project_name,
                "customer_name": m.customer.name if m.customer else None,
                "end_date": m.end_date.isoformat(),
                "alert_status": m.alert_status.value,
                "linked_invoice_number": linked,
            }
        )
    return APIResponse(data=items)
