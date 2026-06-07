from calendar import monthrange
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Annotated, Optional

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.company_scope import get_company_scope
from app.core.database import get_db
from app.core.rbac import require_admin, require_any_role, require_entry_or_above
from app.core.security import get_redis
from app.models.domain import AuditLog, Invoice, Payment, Reminder as InvoiceReminder
from app.models.enums import AuditAction, InvoiceStatus
from app.schemas import (
    APIResponse,
    AuditLogRead,
    CashFlowSummary,
    HealthStatus,
    PaymentCreate,
    PaymentRead,
    ReminderCreate,
    ReminderRead,
)
from app.services.audit_service import write_audit


payments_router = APIRouter(prefix="/payments", tags=["payments"])


@payments_router.get("", response_model=APIResponse[list[PaymentRead]])
async def list_payments(
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(require_any_role),
    company_id: Annotated[int | None, Depends(get_company_scope)] = None,
    invoice_id: Optional[int] = Query(None),
):
    q = select(Payment)
    if company_id is not None:
        q = q.join(Invoice).where(Invoice.company_id == company_id)
    if invoice_id:
        q = q.where(Payment.invoice_id == invoice_id)
    result = await db.execute(q.order_by(Payment.paid_at.desc()))
    return APIResponse(data=[PaymentRead.model_validate(p) for p in result.scalars().all()])


@payments_router.post("", response_model=APIResponse[PaymentRead], status_code=status.HTTP_201_CREATED)
async def create_payment(
    body: PaymentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_entry_or_above),
):
    inv = await db.execute(select(Invoice).where(Invoice.id == body.invoice_id))
    if not inv.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Invoice not found")

    payment = Payment(**body.model_dump(), marked_by=current_user.id)
    db.add(payment)
    await db.flush()
    await write_audit(db, changed_by=current_user.id, entity_type="payment",
                      entity_id=payment.id, action=AuditAction.created)
    await db.commit()
    await db.refresh(payment)
    return APIResponse(data=PaymentRead.model_validate(payment), message="Payment recorded")


# ── Reminders router ──────────────────────────────────────────────────────────

reminders_router = APIRouter(prefix="/reminders", tags=["reminders"])


@reminders_router.get("", response_model=APIResponse[list[ReminderRead]])
async def list_reminders(
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(require_any_role),
    company_id: Annotated[int | None, Depends(get_company_scope)] = None,
    invoice_id: Optional[int] = Query(None),
):
    q = select(InvoiceReminder)
    if company_id is not None:
        q = q.join(Invoice).where(Invoice.company_id == company_id)
    if invoice_id:
        q = q.where(InvoiceReminder.invoice_id == invoice_id)
    result = await db.execute(q.order_by(InvoiceReminder.scheduled_at))
    return APIResponse(data=[ReminderRead.model_validate(r) for r in result.scalars().all()])


@reminders_router.post(
    "/{invoice_id}/trigger",
    response_model=APIResponse[ReminderRead],
    status_code=status.HTTP_201_CREATED,
)
async def trigger_reminder(
    invoice_id: int,
    body: ReminderCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_entry_or_above),
):
    inv = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    if not inv.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Invoice not found")

    reminder = InvoiceReminder(
        invoice_id=invoice_id,
        scheduled_at=body.scheduled_at,
        message=body.message,
        sent_at=datetime.now(timezone.utc) if body.scheduled_at <= datetime.now(timezone.utc) else None,
    )
    db.add(reminder)
    await db.flush()
    await write_audit(db, changed_by=current_user.id, entity_type="reminder",
                      entity_id=reminder.id, action=AuditAction.created)
    await db.commit()
    await db.refresh(reminder)
    return APIResponse(data=ReminderRead.model_validate(reminder), message="Reminder scheduled")


# ── Cash flow router ──────────────────────────────────────────────────────────

cashflow_router = APIRouter(prefix="/cash-flow", tags=["cash-flow"])
@cashflow_router.get("/summary", response_model=APIResponse[CashFlowSummary])
async def cash_flow_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(require_any_role),
    company_id: Annotated[int | None, Depends(get_company_scope)] = None,
    start: Optional[date] = Query(None, description="Period start (YYYY-MM-DD)"),
    end: Optional[date] = Query(None, description="Period end (YYYY-MM-DD)"),
    currency: str = Query("USD"),
):
    today = date.today()
    period_start = start or date(today.year, today.month, 1)
    period_end = end or today

    q = select(Invoice).options(selectinload(Invoice.customer)).where(
        Invoice.currency == currency,
        Invoice.issue_date >= period_start,
        Invoice.issue_date <= period_end,
    )
    if company_id is not None:
        q = q.where(Invoice.company_id == company_id)
    result = await db.execute(q)
    invoices = result.scalars().all()

    total_invoiced = sum((i.total for i in invoices), Decimal("0"))
    received = [i for i in invoices if i.status in (InvoiceStatus.received, InvoiceStatus.paid)]
    total_received = sum((i.total for i in received), Decimal("0"))
    total_outstanding = total_invoiced - total_received

    invoice_rows = [
        {
            "id": i.id,
            "customer": i.customer.name if i.customer else "—",
            "amount": float(i.total),
            "due_date": str(i.due_date),
            "status": i.status.value if hasattr(i.status, "value") else i.status,
        }
        for i in invoices
        if i.status not in (InvoiceStatus.received, InvoiceStatus.paid)
    ]

    return APIResponse(data=CashFlowSummary(
        period_start=period_start,
        period_end=period_end,
        total_invoiced=total_invoiced,
        total_received=total_received,
        total_outstanding=total_outstanding,
        overdue_count=sum(1 for i in invoices if i.status == InvoiceStatus.overdue),
        paid_count=sum(1 for i in invoices if i.status == InvoiceStatus.paid),
        draft_count=sum(1 for i in invoices if i.status == InvoiceStatus.draft),
        currency=currency,
        invoices=invoice_rows,
    ))




# ── Audit log router ──────────────────────────────────────────────────────────

audit_router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


@audit_router.get("", response_model=APIResponse[list[AuditLogRead]])
async def list_audit_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(require_admin),
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[int] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
):
    q = select(AuditLog)
    if entity_type:
        q = q.where(AuditLog.entity_type == entity_type)
    if entity_id:
        q = q.where(AuditLog.entity_id == entity_id)
    q = q.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(q)
    return APIResponse(data=[AuditLogRead.model_validate(a) for a in result.scalars().all()])


# ── Health check router ───────────────────────────────────────────────────────

health_router = APIRouter(prefix="/health", tags=["health"])


@health_router.get("", response_model=HealthStatus)
async def health_check(db: Annotated[AsyncSession, Depends(get_db)]):
    db_status = "ok"
    try:
        await db.execute(select(func.now()))
    except Exception:
        db_status = "error"

    redis_status = "ok"
    try:
        r = await get_redis()
        await r.ping()
    except Exception:
        redis_status = "error"

    celery_status = "not_configured"
    try:
        from celery import current_app as celery_app
        inspect = celery_app.control.inspect(timeout=1)
        stats = inspect.stats()
        celery_status = "ok" if stats else "no_workers"
    except Exception:
        celery_status = "unavailable"

    overall = "ok" if db_status == "ok" and redis_status == "ok" else "degraded"
    return HealthStatus(status=overall, database=db_status, redis=redis_status, celery=celery_status)
