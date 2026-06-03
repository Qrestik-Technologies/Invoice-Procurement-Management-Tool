import logging
import re
import shutil
import uuid
from datetime import date
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.enums import InvoiceStatus, UserRole
from app.models.invoices import Invoice
from app.models.payments import Payment
from app.models.users import User
from app.schemas import (
    APIResponse,
    InvoiceCreate,
    InvoiceRead,
    InvoiceUpdate,
    MarkReceivedRequest,
    ParseUploadResponse,
)
from app.services.audit_service import write_audit_log
from app.services.invoice_helpers import model_to_dict, next_invoice_number, serialize_invoice
from app.services.pagination import paginate
from app.services.template_service import generate_invoice_pdf
from app.services.validators import require_customer, require_invoice, require_milestone

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/invoices", tags=["invoices"])


async def _load_invoice(db: AsyncSession, invoice_id: int) -> Invoice | None:
    result = await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.customer), selectinload(Invoice.milestone))
        .where(Invoice.id == invoice_id)
    )
    return result.scalar_one_or_none()


@router.get("", response_model=APIResponse[list[InvoiceRead]])
async def list_invoices(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    status_filter: InvoiceStatus | None = Query(None, alias="status"),
    customer_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    q = select(Invoice).options(selectinload(Invoice.customer), selectinload(Invoice.milestone))
    if status_filter:
        q = q.where(Invoice.status == status_filter)
    if customer_id:
        q = q.where(Invoice.customer_id == customer_id)
    if date_from:
        q = q.where(Invoice.invoice_date >= date_from)
    if date_to:
        q = q.where(Invoice.invoice_date <= date_to)
    q = q.order_by(Invoice.invoice_date.desc())
    invoices, meta = await paginate(db, q, page=page, page_size=page_size)
    return APIResponse(
        data=[
            serialize_invoice(
                inv,
                inv.customer.name if inv.customer else None,
                inv.milestone.project_name if inv.milestone else None,
            )
            for inv in invoices
        ],
        pagination=meta,
    )


# ── NEW: parse-upload must be BEFORE /{invoice_id} to avoid route collision ──

@router.post("/parse-upload", response_model=APIResponse[ParseUploadResponse])
async def parse_upload(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(require_roles(UserRole.admin, UserRole.entry))],
    file: UploadFile = File(...),
):
    """
    Upload a PDF or DOCX invoice for intelligent parsing.
    Auto-detects vendor (Qrestik / Infinitum / generic) and returns
    all extracted fields ready for front-end auto-fill.
    """
    ext = Path(file.filename).suffix.lower()
    if ext not in {".pdf", ".docx", ".doc"}:
        raise HTTPException(
            status_code=400,
            detail="Only PDF or Word documents (.pdf, .docx, .doc) are accepted",
        )

    upload_dir = Path("uploads/parse_temp")
    upload_dir.mkdir(parents=True, exist_ok=True)
    tmp_path = upload_dir / f"{uuid.uuid4().hex}{ext}"

    try:
        with tmp_path.open("wb") as buf:
            shutil.copyfileobj(file.file, buf)

        from app.parser.invoice_parser import parse_invoice
        parse_result = parse_invoice(str(tmp_path))
    finally:
        tmp_path.unlink(missing_ok=True)

    await write_audit_log(
        db,
        table_name="invoices",
        record_id=0,
        action="parse_upload",
        changed_by=current.id,
        new_value={
            "filename": file.filename,
            "vendor": parse_result.vendor,
            "invoice_number": parse_result.invoice_number,
        },
    )
    await db.commit()

    return APIResponse(data=ParseUploadResponse(document_id=0, parse_result=parse_result))


@router.get("/{invoice_id}", response_model=APIResponse[InvoiceRead])
async def get_invoice(
    invoice_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    inv = await _load_invoice(db, invoice_id)
    if inv is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return APIResponse(
        data=serialize_invoice(
            inv,
            inv.customer.name if inv.customer else None,
            inv.milestone.project_name if inv.milestone else None,
        )
    )


@router.get("/{invoice_id}/pdf")
async def download_invoice_pdf(
    invoice_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    inv = await _load_invoice(db, invoice_id)
    if inv is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if not inv.file_path or not Path(inv.file_path).exists():
        raise HTTPException(status_code=404, detail="PDF not available for this invoice")
    return FileResponse(
        inv.file_path,
        media_type="application/pdf",
        filename=f"{inv.invoice_number}.pdf",
    )


# ── NEW: attach an uploaded PDF to an existing invoice record ────────────────

@router.post("/{invoice_id}/upload-pdf", response_model=APIResponse[InvoiceRead])
async def upload_invoice_pdf(
    invoice_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(require_roles(UserRole.admin, UserRole.entry))],
    file: UploadFile = File(...),
):
    """Attach an externally-created PDF to an existing invoice record."""
    inv = await _load_invoice(db, invoice_id)
    if inv is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if file.content_type not in ("application/pdf", "application/octet-stream"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    upload_dir = Path("uploads/invoices")
    upload_dir.mkdir(parents=True, exist_ok=True)
    safe_number = re.sub(r"[^A-Za-z0-9_\-]", "_", inv.invoice_number or str(invoice_id))
    dest = upload_dir / f"{safe_number}_{uuid.uuid4().hex[:8]}.pdf"

    with dest.open("wb") as buf:
        shutil.copyfileobj(file.file, buf)

    inv.file_path = str(dest)
    await write_audit_log(
        db,
        table_name="invoices",
        record_id=inv.id,
        action="upload_pdf",
        changed_by=current.id,
        new_value={"file_path": str(dest)},
    )
    await db.commit()
    inv = await _load_invoice(db, invoice_id)
    return APIResponse(
        data=serialize_invoice(
            inv,
            inv.customer.name if inv.customer else None,
            inv.milestone.project_name if inv.milestone else None,
        )
    )


@router.post("", response_model=APIResponse[InvoiceRead], status_code=status.HTTP_201_CREATED)
async def create_invoice(
    body: InvoiceCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(require_roles(UserRole.admin, UserRole.entry))],
):
    await require_customer(db, body.customer_id)
    if body.milestone_id is not None:
        await require_milestone(db, body.milestone_id)

    inv_number = body.invoice_number or await next_invoice_number(db)
    line_items = [
        li.model_dump() if hasattr(li, "model_dump") else li for li in body.line_items
    ]
    invoice = Invoice(
        invoice_number=inv_number,
        customer_id=body.customer_id,
        milestone_id=body.milestone_id,
        invoice_date=body.invoice_date,
        line_items=line_items,
        subtotal=body.subtotal,
        tax=body.tax,
        total=body.total,
        currency=body.currency,
        status=body.status,
        payment_terms=body.payment_terms,
        po_number=body.po_number,
        bill_to_address=body.bill_to_address,
        ship_to_address=body.ship_to_address,
        notes=body.notes,
        uploaded_by=current.id,
    )
    db.add(invoice)
    await db.flush()
    await write_audit_log(
        db,
        table_name="invoices",
        record_id=invoice.id,
        action="create",
        changed_by=current.id,
        new_value={"invoice_number": inv_number, "total": float(body.total)},
    )
    await db.commit()
    inv = await _load_invoice(db, invoice.id)
    return APIResponse(
        data=serialize_invoice(
            inv,
            inv.customer.name if inv.customer else None,
            inv.milestone.project_name if inv.milestone else None,
        )
    )


@router.put("/{invoice_id}", response_model=APIResponse[InvoiceRead])
async def update_invoice(
    invoice_id: int,
    body: InvoiceUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(require_roles(UserRole.admin, UserRole.entry))],
):
    inv = await _load_invoice(db, invoice_id)
    if inv is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    data = body.model_dump(exclude_unset=True)
    if "customer_id" in data and data["customer_id"] is not None:
        await require_customer(db, data["customer_id"])
    if "milestone_id" in data and data["milestone_id"] is not None:
        await require_milestone(db, data["milestone_id"])

    old = model_to_dict(inv, ["status", "total", "customer_id"])
    if "line_items" in data and data["line_items"] is not None:
        data["line_items"] = [li if isinstance(li, dict) else li for li in data["line_items"]]
    for k, v in data.items():
        setattr(inv, k, v)
    await write_audit_log(
        db,
        table_name="invoices",
        record_id=inv.id,
        action="update",
        changed_by=current.id,
        old_value=old,
        new_value=model_to_dict(inv, ["status", "total", "customer_id"]),
    )
    await db.commit()
    inv = await _load_invoice(db, invoice_id)
    return APIResponse(
        data=serialize_invoice(
            inv,
            inv.customer.name if inv.customer else None,
            inv.milestone.project_name if inv.milestone else None,
        )
    )


@router.post("/{invoice_id}/dispatch", response_model=APIResponse[InvoiceRead])
async def dispatch_invoice(
    invoice_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(require_roles(UserRole.admin, UserRole.entry))],
):
    inv = await _load_invoice(db, invoice_id)
    if inv is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status not in (InvoiceStatus.draft, InvoiceStatus.reviewed, InvoiceStatus.pending):
        raise HTTPException(status_code=400, detail="Invoice cannot be dispatched in current status")
    old_status = inv.status.value
    try:
        pdf_path = await generate_invoice_pdf(db, inv)
    except Exception as exc:
        logger.exception("PDF generation failed for invoice %s: %s", invoice_id, exc)
        raise HTTPException(status_code=500, detail="Failed to generate invoice PDF") from exc
    inv.status = InvoiceStatus.dispatched
    inv.file_path = pdf_path
    await write_audit_log(
        db,
        table_name="invoices",
        record_id=inv.id,
        action="dispatch",
        changed_by=current.id,
        old_value={"status": old_status},
        new_value={"status": inv.status.value},
    )
    await db.commit()
    inv = await _load_invoice(db, invoice_id)
    return APIResponse(
        data=serialize_invoice(
            inv,
            inv.customer.name if inv.customer else None,
            inv.milestone.project_name if inv.milestone else None,
        )
    )


@router.put("/{invoice_id}/mark-received", response_model=APIResponse[InvoiceRead])
async def mark_received(
    invoice_id: int,
    body: MarkReceivedRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(require_roles(UserRole.admin, UserRole.entry))],
):
    inv = await _load_invoice(db, invoice_id)
    if inv is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    payment = Payment(
        invoice_id=invoice_id,
        received_date=body.received_date,
        amount=body.amount,
        marked_by=current.id,
        notes=body.notes,
    )
    db.add(payment)
    inv.status = InvoiceStatus.received
    await write_audit_log(
        db,
        table_name="invoices",
        record_id=inv.id,
        action="mark_received",
        changed_by=current.id,
        new_value={"amount": float(body.amount), "received_date": body.received_date.isoformat()},
    )
    await db.commit()
    inv = await _load_invoice(db, invoice_id)
    return APIResponse(
        data=serialize_invoice(
            inv,
            inv.customer.name if inv.customer else None,
            inv.milestone.project_name if inv.milestone else None,
        )
    )
