"""Purchase Order CRUD, parse, confirm, create-invoice, close."""
import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.company_scope import get_company_scope
from app.core.config import settings
from app.core.database import get_db
from app.core.rbac import require_any_role, require_entry_or_above
from app.models.domain import Invoice, Milestone
from app.models.purchase_orders import PurchaseOrder
from app.models.enums import (
    AuditAction, InvoiceStatus, MilestoneSource,
    MilestoneStatus, POStatus,
)
from app.parsers.po_parser import parse_po
from app.schemas import (
    APIResponse, InvoiceRead, POCreate, PODetail, POParseUploadResponse,
    PORead, POUpdate,
)
from app.services.audit_service import write_audit

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/purchase-orders", tags=["purchase-orders"])

UPLOAD_DIR = Path(settings.UPLOAD_DIR)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

_ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc"}


async def _get_po_or_404(
    db: AsyncSession, po_id: int, company_id: int | None
) -> PurchaseOrder:
    q = (
        select(PurchaseOrder)
        .options(
            selectinload(PurchaseOrder.invoices),
            selectinload(PurchaseOrder.milestones),
        )
        .where(PurchaseOrder.id == po_id)
    )
    if company_id is not None:
        q = q.where(PurchaseOrder.company_id == company_id)
    result = await db.execute(q)
    po = result.scalar_one_or_none()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return po


# ── Parse ─────────────────────────────────────────────────────────────────────

@router.post("/parse", response_model=APIResponse[POParseUploadResponse])
async def upload_and_parse_po(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_entry_or_above),
):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type {ext} not supported")
    unique_name = f"po_{uuid.uuid4().hex}{ext}"
    save_path = UPLOAD_DIR / unique_name
    content = await file.read()
    save_path.write_bytes(content)
    parsed = await run_in_threadpool(parse_po, str(save_path))
    return APIResponse(data=POParseUploadResponse(parsed=parsed, file_path=str(save_path)))


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("", response_model=APIResponse[PORead], status_code=status.HTTP_201_CREATED)
async def create_purchase_order(
    body: POCreate,
    file_path: str = Query(..., description="file_path returned from /parse"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_entry_or_above),
    company_id: int | None = Depends(get_company_scope),
):
    po = PurchaseOrder(
        company_id=company_id or current_user.company_id,
        uploaded_by=current_user.id,
        file_path=file_path,
        status=POStatus.draft,
        **body.model_dump(),
    )
    db.add(po)
    await db.flush()
    await write_audit(db, current_user.id, "purchase_order", po.id, AuditAction.created)
    await db.commit()
    await db.refresh(po)
    return APIResponse(data=PORead.model_validate(po))


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=APIResponse[list[PORead]])
async def list_purchase_orders(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_any_role),
    company_id: int | None = Depends(get_company_scope),
    status_filter: POStatus | None = Query(None, alias="status"),
    customer: str | None = Query(None),
    expiring_within_days: int | None = Query(None),
):
    q = select(PurchaseOrder)
    if company_id is not None:
        q = q.where(PurchaseOrder.company_id == company_id)
    if status_filter:
        q = q.where(PurchaseOrder.status == status_filter)
    if customer:
        q = q.where(PurchaseOrder.customer_name.ilike(f"%{customer}%"))
    if expiring_within_days is not None:
        import datetime as dt
        cutoff = date.today() + dt.timedelta(days=expiring_within_days)
        q = q.where(
            PurchaseOrder.expiry_date <= cutoff,
            PurchaseOrder.expiry_date >= date.today(),
        )
    result = await db.execute(q.order_by(PurchaseOrder.created_at.desc()))
    return APIResponse(data=[PORead.model_validate(p) for p in result.scalars().all()])


# ── Get single (with linked invoices + milestones) ────────────────────────────

@router.get("/{po_id}", response_model=APIResponse[PODetail])
async def get_purchase_order(
    po_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_any_role),
    company_id: int | None = Depends(get_company_scope),
):
    po = await _get_po_or_404(db, po_id, company_id)
    return APIResponse(data=PODetail.model_validate(po))


# ── Update / Confirm ──────────────────────────────────────────────────────────

@router.put("/{po_id}", response_model=APIResponse[PORead])
async def update_purchase_order(
    po_id: int,
    body: POUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_entry_or_above),
    company_id: int | None = Depends(get_company_scope),
):
    po = await _get_po_or_404(db, po_id, company_id)
    old_status = po.status  # capture BEFORE applying updates
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(po, field, value)

    # ── Confirm PO → set active, auto-create milestone, send alert ────────────
    if body.status == POStatus.active and old_status == POStatus.draft:
        po.confirmed_by = current_user.id
        milestone_date = getattr(po, "delivery_date", None) or po.expiry_date
        if milestone_date:
            milestone = Milestone(
                invoice_id=None,
                title=f"PO {po.po_number} — {po.customer_name}",
                description=f"Auto-created from PO {po.po_number}. Value: {po.total_value} {getattr(po, 'currency', 'AED')}",
                end_date=milestone_date,
                amount=po.total_value,
                status=MilestoneStatus.pending,
                po_id=po.id,
                source=MilestoneSource.po_generated,
            )
            db.add(milestone)
        # Auto-create reminder 7 days before milestone end date
        if milestone_date:
            from app.models.domain import Reminder
            reminder_dt = datetime.combine(
                milestone_date - timedelta(days=7), datetime.min.time()
            ).replace(tzinfo=timezone.utc)
            reminder = Reminder(
                po_id=po.id,
                invoice_id=None,
                scheduled_at=reminder_dt,
                reminder_type="po_milestone",
                message=f"PO {po.po_number} milestone due in 7 days — {po.customer_name}",
            )
            db.add(reminder)

        # Send internal alert to Vivek, Akhilan, Deepak
        try:
            from app.services.email_service import send_internal_alert
            send_internal_alert(
                subject=f"New PO received from {po.customer_name}",
                body=(
                    f"PO {po.po_number} from {po.customer_name} has been confirmed.\n"
                    f"Value: {po.total_value} {getattr(po, 'currency', 'AED')}\n"
                    f"Milestone end date: {milestone_date}\n"
                    f"Payment terms: {po.payment_terms}"
                ),
                recipients=settings.MILESTONE_ALERT_EMAILS,
            )
        except Exception as e:
            logger.warning("PO confirm alert failed (non-fatal): %s", e)

    await write_audit(db, current_user.id, "purchase_order", po.id, AuditAction.updated)
    await db.commit()
    await db.refresh(po)
    return APIResponse(data=PORead.model_validate(po))


# ── Close ─────────────────────────────────────────────────────────────────────

@router.post("/{po_id}/close", response_model=APIResponse[PORead])
async def close_purchase_order(
    po_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_entry_or_above),
    company_id: int | None = Depends(get_company_scope),
):
    po = await _get_po_or_404(db, po_id, company_id)
    po.status = POStatus.closed
    await write_audit(db, current_user.id, "purchase_order", po.id, AuditAction.updated)
    await db.commit()
    await db.refresh(po)
    return APIResponse(data=PORead.model_validate(po))


# ── Raise Invoice from PO ─────────────────────────────────────────────────────

@router.post("/{po_id}/create-invoice", response_model=APIResponse[InvoiceRead])
async def create_invoice_from_po(
    po_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_entry_or_above),
    company_id: int | None = Depends(get_company_scope),
):
    po = await _get_po_or_404(db, po_id, company_id)
    if po.status not in (POStatus.active, POStatus.partially_invoiced):
        raise HTTPException(
            status_code=400, detail="PO must be active or partially invoiced to raise an invoice"
        )

    today = date.today()
    # Determine due date from payment_terms if possible
    due_days = 30
    if po.payment_terms:
        import re
        m = re.search(r"(\d+)", po.payment_terms)
        if m:
            due_days = int(m.group(1))

    invoice = Invoice(
        company_id=po.company_id,
        uploaded_by=current_user.id,
        invoice_number=f"INV-{po.po_number}-{uuid.uuid4().hex[:6].upper()}",
        customer_name=po.customer_name,
        amount=po.total_value,
        currency=getattr(po, "currency", None) or "AED",
        issue_date=today,
        due_date=today + timedelta(days=due_days),
        status=InvoiceStatus.draft,
        description=f"Invoice raised from PO {po.po_number}",
        po_id=po.id,
    )
    db.add(invoice)
    await db.flush()

    # Update PO status
    existing_invoices = po.invoices or []
    po.status = POStatus.partially_invoiced if len(existing_invoices) > 0 else POStatus.partially_invoiced

    await write_audit(db, current_user.id, "invoice", invoice.id, AuditAction.created)
    await write_audit(db, current_user.id, "purchase_order", po.id, AuditAction.updated)
    await db.commit()
    await db.refresh(invoice)
    return APIResponse(data=InvoiceRead.model_validate(invoice), message="Invoice created from PO")


# ── List invoices for a PO ────────────────────────────────────────────────────

@router.get("/{po_id}/invoices", response_model=APIResponse[list[InvoiceRead]])
async def list_invoices_for_po(
    po_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_entry_or_above),
    company_id: int | None = Depends(get_company_scope),
):
    po = await _get_po_or_404(db, po_id, company_id)
    result = await db.execute(
        select(Invoice)
        .where(Invoice.po_id == po.id)
        .order_by(Invoice.created_at.desc())
    )
    return APIResponse(data=[InvoiceRead.model_validate(i) for i in result.scalars().all()])
