"""PDF export service for invoices."""
import io

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

_BRAND_BLUE = colors.HexColor("#0C447C")

def export_invoice_to_pdf(inv) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter,
                            rightMargin=0.75*inch, leftMargin=0.75*inch,
                            topMargin=0.75*inch, bottomMargin=0.75*inch)
    story = []
    sub_style = ParagraphStyle("sub", fontSize=10, spaceAfter=2)
    title_style = ParagraphStyle("title", fontSize=20, textColor=_BRAND_BLUE,
                                  spaceAfter=4, fontName="Helvetica-Bold")

    story.append(Paragraph("INVOICE", title_style))
    story.append(Paragraph(f"<b>Invoice #:</b> {inv.invoice_number}", sub_style))

    issue = inv.issue_date.isoformat() if getattr(inv, "issue_date", None) else "-"
    due   = inv.due_date.isoformat()   if getattr(inv, "due_date", None)   else "-"
    story.append(Paragraph(f"<b>Issue Date:</b> {issue}   <b>Due Date:</b> {due}", sub_style))

    status_val = inv.status.value if hasattr(inv.status, "value") else str(inv.status)
    story.append(Paragraph(f"<b>Status:</b> {status_val}", sub_style))
    story.append(Spacer(1, 0.2*inch))

    customer_name = getattr(inv, "customer_name", None) or "N/A"
    story.append(Paragraph(f"<b>Bill To:</b> {customer_name}", sub_style))
    story.append(Spacer(1, 0.2*inch))

    line_items = getattr(inv, "line_items", None) or []
    table_data = [["Description", "Qty", "Unit Price", "Amount"]]
    for item in line_items:
        if isinstance(item, dict):
            desc  = item.get("description", "")
            qty   = item.get("quantity", 1)
            price = item.get("unit_price", 0)
            amt   = item.get("amount", float(qty) * float(price))
        else:
            desc, qty, price, amt = str(item), 1, 0, 0
        table_data.append([desc, str(qty), f"{float(price):,.2f}", f"{float(amt):,.2f}"])

    if len(table_data) == 1:
        table_data.append(["-", "-", "-", "-"])

    col_widths = [3.2*inch, 0.8*inch, 1.3*inch, 1.3*inch]
    tbl = Table(table_data, colWidths=col_widths)
    tbl.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (-1, 0), _BRAND_BLUE),
        ("TEXTCOLOR",   (0, 0), (-1, 0), colors.white),
        ("FONTNAME",    (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",    (0, 0), (-1, -1), 9),
        ("GRID",        (0, 0), (-1, -1), 0.4, colors.HexColor("#CCCCCC")),
        ("ALIGN",       (1, 0), (-1, -1), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",(0, 0), (-1, -1), 6),
        ("TOPPADDING",  (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 0.15*inch))

    currency = getattr(inv, "currency", "USD")
    subtotal = float(getattr(inv, "subtotal", 0) or 0)
    tax      = float(getattr(inv, "tax", 0) or 0)
    total    = float(getattr(inv, "total", 0) or getattr(inv, "amount", 0) or 0)

    totals_data = [
        ["Subtotal", f"{currency} {subtotal:,.2f}"],
        ["Tax",      f"{currency} {tax:,.2f}"],
        ["TOTAL",    f"{currency} {total:,.2f}"],
    ]
    totals_tbl = Table(totals_data, colWidths=[5.3*inch, 1.3*inch])
    totals_tbl.setStyle(TableStyle([
        ("ALIGN",      (1, 0), (1, -1), "RIGHT"),
        ("FONTNAME",   (0, 2), (-1, 2), "Helvetica-Bold"),
        ("FONTSIZE",   (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("LINEABOVE",  (0, 2), (-1, 2), 0.8, _BRAND_BLUE),
    ]))
    story.append(totals_tbl)

    desc = getattr(inv, "notes", None) or getattr(inv, "description", None)
    if desc:
        story.append(Spacer(1, 0.2*inch))
        story.append(Paragraph(f"<b>Notes:</b> {desc}", sub_style))

    doc.build(story)
    return buf.getvalue()
