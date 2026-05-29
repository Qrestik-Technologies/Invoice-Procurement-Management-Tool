from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.invoices import Invoice

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)), autoescape=select_autoescape(["html"]))


async def generate_invoice_pdf(db: AsyncSession, invoice: Invoice) -> str:
    from sqlalchemy.orm import selectinload
    from sqlalchemy import select

    from app.models.customers import Customer

    result = await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.customer))
        .where(Invoice.id == invoice.id)
    )
    inv = result.scalar_one()
    customer = inv.customer
    template_name = (
        "emcor_invoice.html"
        if customer and customer.template_type.value == "emcor"
        else "standard_invoice.html"
    )
    html = env.get_template(template_name).render(
        invoice=inv,
        customer=customer,
        company_name=settings.COMPANY_NAME,
        company_email=settings.COMPANY_EMAIL,
        line_items=inv.line_items or [],
    )

    out_dir = Path(settings.UPLOAD_DIR) / "generated"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{inv.invoice_number}.pdf"

    try:
        from weasyprint import HTML

        HTML(string=html).write_pdf(str(out_path))
    except Exception:
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas

        c = canvas.Canvas(str(out_path), pagesize=letter)
        y = 750
        c.setFont("Helvetica-Bold", 14)
        c.drawString(50, y, f"Invoice {inv.invoice_number}")
        y -= 30
        c.setFont("Helvetica", 10)
        c.drawString(50, y, f"Customer: {customer.name if customer else 'N/A'}")
        y -= 20
        c.drawString(50, y, f"Date: {inv.invoice_date}")
        y -= 20
        c.drawString(50, y, f"Total: {inv.currency} {inv.total}")
        c.save()

    return str(out_path)
