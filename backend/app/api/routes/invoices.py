import logging
from datetime import date, timedelta
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.milestones import Milestone
from app.models.inovice_remainder import InvoiceReminder
from app.models.enums import AlertStatus
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.enums import InvoiceStatus, UserRole
from app.models.invoices import Invoice
from app.models.payments import Payment
from app.models.users import User
from app.schemas import APIResponse, InvoiceCreate, InvoiceRead, InvoiceUpdate, MarkReceivedRequest
from app.services.audit_service import write_audit_log
from app.services.invoice_helpers import model_to_dict, next_invoice_number, serialize_invoice
from app.services.pagination import paginate
from app.services.template_service import generate_invoice_pdf
from app.services.validators import require_customer, require_milestone
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
        li.model_dump() if hasattr(li, "model_dump") else li
        for li in body.line_items
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

    # ----------------------------------------
    # AUTO CREATE MILESTONE
    # ----------------------------------------

    milestone_created = False

    if invoice.milestone_id is None:

        milestone = Milestone(
            project_name=f"Invoice {invoice.invoice_number}",
            customer_id=invoice.customer_id,
            start_date=invoice.invoice_date,
            end_date=invoice.invoice_date + timedelta(days=30),
            alert_status=AlertStatus.on_track,
            notes=f"Auto-generated from invoice {invoice.invoice_number}",
        )

        db.add(milestone)
        await db.flush()

        invoice.milestone_id = milestone.id
        milestone_created = True

    # ----------------------------------------
    # DETERMINE DUE DATE
    # ----------------------------------------

    due_days = 30

    if invoice.payment_terms:

        terms = invoice.payment_terms.upper()

        if "15" in terms:
            due_days = 15
        elif "30" in terms:
            due_days = 30
        elif "45" in terms:
            due_days = 45
        elif "60" in terms:
            due_days = 60

    due_date = invoice.invoice_date + timedelta(days=due_days)

    # ----------------------------------------
    # AUTO CREATE REMINDERS
    # ----------------------------------------

    reminder_offsets = [7, 3, 1]

    for days_before in reminder_offsets:

        reminder_date = due_date - timedelta(days=days_before)

        if reminder_date >= invoice.invoice_date:

            db.add(
                InvoiceReminder(
                    invoice_id=invoice.id,
                    reminder_date=reminder_date,
                    title=f"Invoice {invoice.invoice_number} due in {days_before} day{'s' if days_before > 1 else ''}",
                    sent=False,
                )
            )

    # ----------------------------------------
    # AUDIT
    # ----------------------------------------

    await write_audit_log(
        db,
        table_name="invoices",
        record_id=invoice.id,
        action="create",
        changed_by=current.id,
        new_value={
            "invoice_number": inv_number,
            "total": float(body.total),
            "milestone_created": milestone_created,
            "due_date": due_date.isoformat(),
        },
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
        amount=body.total,
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
