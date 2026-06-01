from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customers import Customer
from app.models.enums import InvoiceStatus
from app.models.invoices import Invoice
from app.schemas import InvoiceRead


def _invoice_due_date(inv: Invoice) -> date | None:
    if inv.payment_terms and "30" in inv.payment_terms:
        return date.fromordinal(inv.invoice_date.toordinal() + 30)
    return date.fromordinal(inv.invoice_date.toordinal() + 30)


def serialize_invoice(inv: Invoice, customer_name: str | None = None, milestone_name: str | None = None) -> InvoiceRead:
    return InvoiceRead(
        id=inv.id,
        invoice_number=inv.invoice_number,
        customer_id=inv.customer_id,
        milestone_id=inv.milestone_id,
        invoice_date=inv.invoice_date,
        line_items=inv.line_items or [],
        subtotal=inv.subtotal,
        tax=inv.tax,
        total=inv.total,
        currency=inv.currency,
        status=inv.status,
        payment_terms=inv.payment_terms,
        po_number=inv.po_number,
        bill_to_address=inv.bill_to_address,
        ship_to_address=inv.ship_to_address,
        notes=inv.notes,
        has_pdf=bool(inv.file_path),
        onedrive_url=inv.onedrive_url,
        uploaded_by=inv.uploaded_by,
        created_at=inv.created_at,
        updated_at=inv.updated_at,
        customer_name=customer_name,
        milestone_name=milestone_name,
        due_date=_invoice_due_date(inv),
    )


async def next_invoice_number(db: AsyncSession) -> str:
    result = await db.execute(select(func.count(Invoice.id)))
    count = result.scalar() or 0
    year = date.today().year
    return f"INV-{year}-{count + 1:04d}"


def model_to_dict(obj, fields: list[str]) -> dict:
    data = {}
    for f in fields:
        val = getattr(obj, f, None)
        if hasattr(val, "value"):
            val = val.value
        if isinstance(val, Decimal):
            val = float(val)
        elif hasattr(val, "isoformat"):
            val = val.isoformat()
        data[f] = val
    return data
