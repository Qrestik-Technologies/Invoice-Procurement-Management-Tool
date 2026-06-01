from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.enums import ReminderType, UserRole
from app.models.invoices import Invoice
from app.models.reminder_logs import ReminderLog
from app.models.users import User
from app.schemas import APIResponse, ReminderRead
from app.services.pagination import paginate
from app.tasks.reminder_tasks import send_reminder

router = APIRouter(prefix="/reminders", tags=["reminders"])

REMINDER_TYPE_MAP = {
    "milestone_alert": ReminderType.milestone_alert,
    "payment_reminder": ReminderType.payment_reminder,
    "overdue": ReminderType.overdue,
}


@router.get("", response_model=APIResponse[list[ReminderRead]])
async def list_reminders(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    stmt = (
        select(ReminderLog)
        .options(selectinload(ReminderLog.invoice).selectinload(Invoice.customer))
        .order_by(ReminderLog.sent_at.desc())
    )
    rows, meta = await paginate(db, stmt, page=page, page_size=page_size)
    items = []
    for r in rows:
        item = ReminderRead.model_validate(r)
        if r.invoice:
            item.invoice_number = r.invoice.invoice_number
            item.customer_name = r.invoice.customer.name if r.invoice.customer else None
        items.append(item)
    return APIResponse(data=items, pagination=meta)


@router.post("/{invoice_id}/send", response_model=APIResponse[dict])
async def send_invoice_reminder(
    invoice_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(require_roles(UserRole.admin, UserRole.entry))],
    reminder_type: str = "payment_reminder",
    recipient_emails: str | None = None,
):
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    rtype = REMINDER_TYPE_MAP.get(reminder_type, ReminderType.payment_reminder)
    emails = [e.strip() for e in (recipient_emails or "").split(",") if e.strip()]
    if not emails and invoice.customer:
        from sqlalchemy.orm import selectinload as sil

        inv_full = await db.execute(
            select(Invoice).options(sil(Invoice.customer)).where(Invoice.id == invoice_id)
        )
        inv = inv_full.scalar_one()
        if inv.customer:
            emails = [inv.customer.email]
    task = send_reminder.delay(invoice_id, rtype.value, emails)
    return APIResponse(data={"task_id": task.id, "status": "queued"})
