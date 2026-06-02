"""Invoice CRUD, dispatch, mark-received, Excel export, and OneDrive sync."""
from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.company_scope import get_company_scope
from app.core.database import get_db
from app.core.rbac import require_admin, require_any_role, require_entry_or_above
from app.models.domain import Customer, Invoice
from app.models.enums import AuditAction, InvoiceStatus
from app.schemas import APIResponse, InvoiceCreate, InvoiceRead, InvoiceUpdate
from app.services.audit_service import write_audit
from app.services.excel_service import export_invoices_to_excel
from app.services.onedrive_service import upload_file_to_onedrive

router = APIRouter(prefix="/invoices", tags=["invoices"])


async def _get_invoice_or_404(db: AsyncSession, invoice_id: int) -> Invoice:
    result = await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.customer))
        .where(Invoice.id == invoice_id)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return inv


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=APIResponse[list[InvoiceRead]])
async def list_invoices(
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(require_any_role),
    company_id: Annotated[int | None, Depends(get_company_scope)] = None,
    status_filter: Optional[InvoiceStatus] = Query(None, alias="status"),
    customer_id: Optional[int] = Query(None),
):
    q = select(Invoice)
    if company_id is not None:
        q = q.where(Invoice.company_id == company_id)
    if status_filter:
        q = q.where(Invoice.status == status_filter)
    if customer_id:
        q = q.where(Invoice.customer_id == customer_id)
    result = await db.execute(q.order_by(Invoice.due_date.desc()))
    return APIResponse(data=[InvoiceRead.model_validate(i) for i in result.scalars().all()])


# ── Get single ────────────────────────────────────────────────────────────────

@router.get("/{invoice_id}", response_model=APIResponse[InvoiceRead])
async def get_invoice(
    invoice_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(require_any_role),
):
    inv = await _get_invoice_or_404(db, invoice_id)
    return APIResponse(data=InvoiceRead.model_validate(inv))


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("", response_model=APIResponse[InvoiceRead], status_code=status.HTTP_201_CREATED)
async def create_invoice(
    body: InvoiceCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_entry_or_above),
    company_id: Annotated[int | None, Depends(get_company_scope)] = None,
):
    resolved_company = body.company_id or company_id
    if not resolved_company:
        raise HTTPException(status_code=400, detail="Select an organization first")

    cust_result = await db.execute(select(Customer).where(Customer.id == body.customer_id))
    customer = cust_result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    if customer.company_id != resolved_company:
        raise HTTPException(status_code=400, detail="Customer does not belong to the selected organization")

    dup = await db.execute(
        select(Invoice).where(
            Invoice.company_id == resolved_company,
            Invoice.invoice_number == body.invoice_number,
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Invoice number already exists for this organization")

    payload = body.model_dump(exclude={"company_id"})
    inv = Invoice(**payload, company_id=resolved_company, uploaded_by=current_user.id)
    db.add(inv)
    await db.flush()
    await write_audit(db, changed_by=current_user.id, entity_type="invoice",
                      entity_id=inv.id, action=AuditAction.created)
    await db.commit()
    await db.refresh(inv)
    return APIResponse(data=InvoiceRead.model_validate(inv), message="Invoice created")


# ── Update ────────────────────────────────────────────────────────────────────

@router.put("/{invoice_id}", response_model=APIResponse[InvoiceRead])
async def update_invoice(
    invoice_id: int,
    body: InvoiceUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_entry_or_above),
):
    inv = await _get_invoice_or_404(db, invoice_id)
    changes = body.model_dump(exclude_none=True)
    for field, value in changes.items():
        setattr(inv, field, value)
    await write_audit(db, changed_by=current_user.id, entity_type="invoice",
                      entity_id=invoice_id, action=AuditAction.updated, detail=changes)
    await db.commit()
    await db.refresh(inv)
    return APIResponse(data=InvoiceRead.model_validate(inv), message="Invoice updated")


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/{invoice_id}", response_model=APIResponse[None])
async def delete_invoice(
    invoice_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_admin),
):
    inv = await _get_invoice_or_404(db, invoice_id)
    await write_audit(db, changed_by=current_user.id, entity_type="invoice",
                      entity_id=invoice_id, action=AuditAction.deleted)
    await db.delete(inv)
    await db.commit()
    return APIResponse(message="Invoice deleted")


# ── Mark as received ──────────────────────────────────────────────────────────

@router.post("/{invoice_id}/mark-received", response_model=APIResponse[InvoiceRead])
async def mark_received(
    invoice_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_entry_or_above),
):
    inv = await _get_invoice_or_404(db, invoice_id)
    inv.status = InvoiceStatus.received
    inv.received_at = datetime.now(timezone.utc)
    await write_audit(db, changed_by=current_user.id, entity_type="invoice",
                      entity_id=invoice_id, action=AuditAction.status_changed,
                      detail={"status": "received"})
    await db.commit()
    await db.refresh(inv)
    return APIResponse(data=InvoiceRead.model_validate(inv), message="Invoice marked as received")


# ── Excel export ──────────────────────────────────────────────────────────────

@router.get("/export/excel", response_class=Response)
async def export_invoices_excel(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_any_role),
    company_id: Annotated[int | None, Depends(get_company_scope)] = None,
    status_filter: Optional[InvoiceStatus] = Query(None, alias="status"),
):
    q = select(Invoice).options(selectinload(Invoice.customer))
    if company_id is not None:
        q = q.where(Invoice.company_id == company_id)
    if status_filter:
        q = q.where(Invoice.status == status_filter)
    result = await db.execute(q.order_by(Invoice.issue_date.desc()))
    invoices = result.scalars().all()

    xlsx_bytes = await run_in_threadpool(export_invoices_to_excel, invoices)
    await write_audit(db, changed_by=current_user.id, entity_type="invoice",
                      entity_id=0, action=AuditAction.exported,
                      detail={"count": len(invoices)})
    await db.commit()

    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=invoices.xlsx"},
    )


# ── OneDrive sync ─────────────────────────────────────────────────────────────

@router.post("/{invoice_id}/sync-onedrive", response_model=APIResponse[InvoiceRead])
async def sync_to_onedrive(
    invoice_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_entry_or_above),
):
    """Re-upload the invoice Excel snapshot to OneDrive and store the item ID."""
    inv = await _get_invoice_or_404(db, invoice_id)
    xlsx_bytes = await run_in_threadpool(export_invoices_to_excel, [inv])

    filename = f"invoice_{inv.invoice_number}.xlsx"
    metadata = await run_in_threadpool(upload_file_to_onedrive, xlsx_bytes, filename)

    if metadata:
        inv.onedrive_item_id = metadata.get("id")
        inv.file_path = metadata.get("webUrl")
        await write_audit(db, changed_by=current_user.id, entity_type="invoice",
                          entity_id=invoice_id, action=AuditAction.synced,
                          detail={"onedrive_item_id": inv.onedrive_item_id})
        await db.commit()
        await db.refresh(inv)
        return APIResponse(data=InvoiceRead.model_validate(inv), message="Synced to OneDrive")
    else:
        raise HTTPException(status_code=502, detail="OneDrive upload failed. Check server logs.")
