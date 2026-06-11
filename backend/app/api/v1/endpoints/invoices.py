"""Invoice CRUD, dispatch, mark-received, Excel export, OneDrive sync, and PDF parse."""
import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.company_scope import get_company_scope
from app.core.config import settings
from app.core.database import get_db
from app.core.rbac import require_admin, require_any_role, require_entry_or_above
from app.models.domain import Customer, Invoice,Milestone
from app.models.inovice_remainder import InvoiceReminder
from app.models.enums import AuditAction, AlertStatus, InvoiceStatus, MilestoneStatus
from app.parsers.invoice_parser import parse_invoice
from app.schemas import APIResponse, InvoiceCreate, InvoiceParseSchema, InvoiceRead, InvoiceUpdate, ParseUploadResponse
from app.services.audit_service import write_audit
from app.services.excel_service import export_invoices_to_excel
from app.services.pdf_service import export_invoice_to_pdf
from app.services.onedrive_service import upload_file_to_onedrive

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/invoices", tags=["invoices"])

UPLOAD_DIR = Path(settings.UPLOAD_DIR)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

_ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc"}
_ALLOWED_MIME = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}


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

    dup = await db.execute(
        select(Invoice).where(
            Invoice.company_id == resolved_company,
            Invoice.invoice_number == body.invoice_number,
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Invoice number already exists for this organization")

    payload = body.model_dump(exclude={"company_id", "subtotal", "tax", "total", "notes", "invoice_date", "file_path"})
    payload["currency"] = "USD"
    inv = Invoice(**payload, company_id=resolved_company, uploaded_by=current_user.id)
    db.add(inv)
    await db.flush()

    # ── Auto-create milestone (MS-01) ────────────────────────────────────────
    due = inv.due_date or (inv.issue_date + timedelta(days=30) if inv.issue_date else date.today() + timedelta(days=30))
    milestone = Milestone(
        invoice_id=inv.id,
        title=f"Payment due — {inv.invoice_number}",
        end_date=due,
        amount=inv.amount,
        status=MilestoneStatus.pending,
    )
    db.add(milestone)

    # ── Auto-create 1 reminder: 3 days before due (MS-02, MS-05) ───────────
    reminder_date = due - timedelta(days=3)
    reminder = InvoiceReminder(
        invoice_id=inv.id,
        scheduled_at=datetime.combine(reminder_date, datetime.min.time()).replace(tzinfo=timezone.utc),
    )
    db.add(reminder)
    # ─────────────────────────────────────────────────────────────────────────

    await write_audit(db, changed_by=current_user.id, entity_type="invoice",
                      entity_id=inv.id, action=AuditAction.created)
    await db.commit()
    await db.refresh(inv)

    # ── Upload actual invoice file to OneDrive ──────────────────────────────
    onedrive_url = None
    original_filename = f"invoice_{inv.invoice_number}.pdf"
    try:
        from app.models.documents import Document
        from app.models.enums import DocumentType, SyncStatus
        from pathlib import Path as _Path

        # Use uploaded file if available, otherwise generate PDF
        uploaded_path = _Path(body.file_path) if getattr(body, "file_path", None) else None
        if uploaded_path and uploaded_path.exists():
            file_bytes = uploaded_path.read_bytes()
            original_filename = f"invoice_{inv.invoice_number}{uploaded_path.suffix}"
        else:
            file_bytes = await run_in_threadpool(export_invoice_to_pdf, inv)
            original_filename = f"invoice_{inv.invoice_number}.pdf"

        metadata = await run_in_threadpool(upload_file_to_onedrive, file_bytes, original_filename)
        if metadata:
            onedrive_url = metadata.get("webUrl")

        doc = Document(
            filename=original_filename,
            file_path=onedrive_url or original_filename,
            onedrive_url=onedrive_url,
            linked_invoice_id=inv.id,
            uploaded_by=current_user.id,
            document_type=DocumentType.invoice,
            sync_status=SyncStatus.synced if onedrive_url else SyncStatus.pending,
            customer_name=inv.customer_name,
        )
        db.add(doc)
        await db.commit()
        # Clean up temp file
        if uploaded_path and uploaded_path.exists():
            uploaded_path.unlink(missing_ok=True)
    except Exception as exc:
        logger.warning("OneDrive upload/document log failed (non-fatal): %s", exc)
    # ────────────────────────────────────────────────────────────────────────

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
    changes["currency"] = "USD"
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
    pdf_bytes = await run_in_threadpool(export_invoice_to_pdf, inv)

    filename = f"invoice_{inv.invoice_number}.pdf"
    metadata = await run_in_threadpool(upload_file_to_onedrive, pdf_bytes, filename)

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


# ── Parse invoice PDF ─────────────────────────────────────────────────────────

@router.post("/parse", response_model=APIResponse[InvoiceParseSchema])
async def parse_invoice_file(
    _=Depends(require_entry_or_above),
    file: UploadFile = File(...),
):
    """Upload a PDF/DOCX invoice and extract fields via regex + NLP."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename required")
    ext = Path(file.filename).suffix.lower()
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")
    if file.content_type and file.content_type not in _ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum size of {settings.MAX_UPLOAD_BYTES // (1024 * 1024)} MB",
        )

    # Save to a temp file so the parser can open it
    safe_name = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / safe_name
    dest.write_bytes(content)

    try:
        result = parse_invoice(str(dest))
    finally:
        dest.unlink(missing_ok=True)  # clean up temp file

    return APIResponse(data=result)

# ── Parse and save ────────────────────────────────────────────────────────────

@router.get("/reminders/scheduled", response_model=APIResponse[list])
async def list_scheduled_reminders(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_entry_or_above),
    company_id: Annotated[int | None, Depends(get_company_scope)] = None,
):
    """List all scheduled invoice reminders with invoice details."""
    stmt = (
        select(InvoiceReminder, Invoice)
        .join(Invoice, InvoiceReminder.invoice_id == Invoice.id)
    )
    if company_id:
        stmt = stmt.where(Invoice.company_id == company_id)
    stmt = stmt.order_by(InvoiceReminder.scheduled_at.asc())
    result = await db.execute(stmt)
    rows = result.all()
    data = []
    for reminder, invoice in rows:
        data.append({
            "id": reminder.id,
            "invoice_id": reminder.invoice_id,
            "invoice_number": invoice.invoice_number,
            "scheduled_at": reminder.scheduled_at.isoformat() if reminder.scheduled_at else None,
            "sent_at": reminder.sent_at.isoformat() if reminder.sent_at else None,
            "message": reminder.message if hasattr(reminder, 'message') else None,
        })
    return APIResponse(data=data)


@router.post("/parse-and-save", response_model=APIResponse[ParseUploadResponse])
async def parse_and_save_invoice(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_entry_or_above),
    company_id: Annotated[int | None, Depends(get_company_scope)] = None,
    file: UploadFile = File(...),
):
    """Upload a PDF/DOCX, parse it, save the invoice, auto-create a milestone and 3 reminders."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename required")
    ext = Path(file.filename).suffix.lower()
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")

    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum size of {settings.MAX_UPLOAD_BYTES // (1024 * 1024)} MB",
        )

    resolved_company = company_id
    if not resolved_company:
        raise HTTPException(status_code=400, detail="Select an organization first")

    # Save temp file and parse
    safe_name = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / safe_name
    dest.write_bytes(content)
    try:
        parse_result = parse_invoice(str(dest))
    except Exception as exc:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=f"Parse error: {exc}")

    # Keep file on disk — will be uploaded to OneDrive on invoice create
    parse_result.file_path = str(dest)

    return APIResponse(
        data=ParseUploadResponse(document_id=0, parse_result=parse_result),
        message="Invoice parsed and saved",
    )
