"""Purchase Order CRUD, parse, confirm, create-invoice, close."""
import logging
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.company_scope import get_company_scope
from app.core.config import settings
from app.core.database import get_db
from app.core.rbac import require_any_role, require_entry_or_above
from app.models.domain import Invoice, Milestone
from app.models.purchase_orders import PurchaseOrder
from app.models.enums import (
    AuditAction, DocumentType, InvoiceStatus, MilestoneSource,
    MilestoneStatus, POStatus,
)
from app.models.documents import Document
from app.parsers.po_parser import parse_po
from app.schemas import (
    APIResponse, InvoiceCreate, InvoiceRead, POCreate, POParseUploadResponse,
    PORead, POUpdate,
)
from app.services.audit_service import write_audit

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/purchase-orders", tags=["purchase-orders"])

UPLOAD_DIR = Path(settings.UPLOAD_DIR)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

_ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc"}


async def _get_po_or_404(db: AsyncSession, po_id: int, company_id: int | None) -> PurchaseOrder:
    q = select(PurchaseOrder).where(PurchaseOrder.id == po_id)
    if company_id is not None:
        q = q.where(PurchaseOrder.company_id == company_id)
    result = await db.execute(q)
    po = result.scalar_one_or_none()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return po


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
        q = q.where(PurchaseOrder.expiry_date <= cutoff, PurchaseOrder.expiry_date >= date.today())
    result = await db.execute(q.order_by(PurchaseOrder.created_at.desc()))
    return APIResponse(data=[PORead.model_validate(p) for p in result.scalars().all()])


@router.get("/{po_id}", response_model=APIResponse[PORead])
async def get_purchase_order(
    po_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_any_role),
    company_id: int | None = Depends(get_company_scope),
):
    po = await _get_po_or_404(db, po_id, company_id)
    return APIResponse(data=PORead.model_validate(po))


@router.put("/{po_id}", response_model=APIResponse[PORead])
async def update_purchase_order(
    po_id: int,
    body: POUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_entry_or_above),
    company_id: int | None = Depends(get_company_scope),
):
    po = await _get_po_or_404(db, po_id, company_id)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(po, field, value)
    if body.status == POStatus.active and po.status == POStatus.draft:
        po.confirmed_by = current_user.id
        if po.expiry_date:
            milestone = Milestone(
                invoice_id=None,
                title=f"PO {po.po_number} — {po.customer_name}",
                description=f"Auto-created from PO {po.po_number}",
                due_date=po.expiry_date,
                amount=po.total_value,
                status=MilestoneStatus.pending,
                po_id=po.id,
                source=MilestoneSource.po_generated,
            )
            db.add(milestone)
    await write_audit(db, current_user.id, "purchase_order", po.id, AuditAction.updated)
    await db.commit()
    await db.refresh(po)
    return APIResponse(data=PORead.model_validate(po))


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
