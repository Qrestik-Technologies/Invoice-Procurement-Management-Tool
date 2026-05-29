from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.customers import Customer
from app.models.enums import InvoiceStatus, UserRole
from app.models.invoices import Invoice
from app.models.milestones import Milestone
from app.models.payments import Payment
from app.models.users import User
from app.schemas import APIResponse, InvoiceCreate, InvoiceRead, InvoiceUpdate, MarkReceivedRequest
from app.services.audit_service import write_audit_log
from app.services.invoice_helpers import model_to_dict, next_invoice_number, serialize_invoice
from app.services.template_service import generate_invoice_pdf

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
    result = await db.execute(q)
    return APIResponse(
        data=[
            serialize_invoice(
                inv,
                inv.customer.name if inv.customer else None,
                inv.milestone.project_name if inv.milestone else None,
            )
            for inv in result.scalars().all()
        ]
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


@router.post("", response_model=APIResponse[InvoiceRead], status_code=status.HTTP_201_CREATED)
async def create_invoice(
    body: InvoiceCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(require_roles(UserRole.admin, UserRole.entry))],
):
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
    old = model_to_dict(inv, ["status", "total", "customer_id"])
    data = body.model_dump(exclude_unset=True)
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
    inv.status = InvoiceStatus.dispatched
    try:
        pdf_path = await generate_invoice_pdf(db, inv)
        inv.file_path = pdf_path
    except Exception:
        pass
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
