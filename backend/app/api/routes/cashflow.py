from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.enums import InvoiceStatus
from app.models.invoices import Invoice
from app.models.payments import Payment
from app.models.users import User
from app.schemas import APIResponse, CashFlowMonth, CashFlowSummary

router = APIRouter(prefix="/cashflow", tags=["cashflow"])


@router.get("/summary", response_model=APIResponse[CashFlowSummary])
async def cashflow_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    months: int = 6,
):
    today = date.today()
    monthly: list[CashFlowMonth] = []

    for i in range(months - 1, -1, -1):
        d = today.replace(day=1) - timedelta(days=i * 28)
        month_start = d.replace(day=1)
        if month_start.month == 12:
            month_end = month_start.replace(year=month_start.year + 1, month=1, day=1)
        else:
            month_end = month_start.replace(month=month_start.month + 1, day=1)

        expected_q = await db.execute(
            select(func.coalesce(func.sum(Invoice.total), 0)).where(
                Invoice.invoice_date >= month_start,
                Invoice.invoice_date < month_end,
            )
        )
        received_q = await db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.received_date >= month_start,
                Payment.received_date < month_end,
            )
        )
        label = month_start.strftime("%b %Y")
        monthly.append(
            CashFlowMonth(
                month=label,
                expected=float(expected_q.scalar() or 0),
                received=float(received_q.scalar() or 0),
            )
        )

    inv_result = await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.customer))
        .where(Invoice.status.in_([InvoiceStatus.pending, InvoiceStatus.dispatched, InvoiceStatus.overdue, InvoiceStatus.received]))
        .order_by(Invoice.invoice_date.desc())
        .limit(20)
    )
    invoice_rows = []
    for inv in inv_result.scalars().all():
        expected_date = inv.invoice_date + timedelta(days=30)
        invoice_rows.append(
            {
                "invoice_id": inv.id,
                "invoice_number": inv.invoice_number,
                "customer_name": inv.customer.name if inv.customer else None,
                "expected_date": expected_date.isoformat(),
                "amount": float(inv.total),
                "status": inv.status.value,
            }
        )

    return APIResponse(data=CashFlowSummary(monthly=monthly, invoices=invoice_rows))
