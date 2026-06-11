"""
PO Parser — extracts required fields from a PDF purchase order.
"""

import re
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def _extract_text(path: str) -> str:
    try:
        import pdfplumber
        with pdfplumber.open(path) as pdf:
            return "\n".join(page.extract_text() or "" for page in pdf.pages)
    except Exception:
        pass
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(path)
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception as e:
        logger.error("PDF extraction failed: %s", e)
        return ""


def _search(pattern: str, text: str, group: int = 0, flags: int = re.IGNORECASE):
    m = re.search(pattern, text, flags)
    if not m:
        return None
    try:
        return m.group(group).strip()
    except IndexError:
        return m.group(0).strip()


def _parse_amount(s) -> float:
    if not s:
        return 0.0
    return float(re.sub(r"[^\d.]", "", str(s)) or "0")


def _normalise_date(raw) -> str | None:
    if not raw:
        return None
    if re.match(r"\d{4}-\d{2}-\d{2}", raw):
        return raw
    m = re.match(r"(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{4})", raw)
    if m:
        d, mo, y = m.group(1), m.group(2), m.group(3)
        return f"{y}-{mo.zfill(2)}-{d.zfill(2)}"
    return raw


def _parse_line_items(text: str) -> list:
    items = []
    num = r"[\d,]+\.?\d*"

    # Full 10-column table pattern
    row_pattern = re.compile(
        rf"^(\d+)\s+(.+?)\s+({num})\s+({num})\s+({num})\s+({num})\s+({num})\s+({num})\s+({num})\s+({num})\s*$",
        re.MULTILINE,
    )

    for m in row_pattern.finditer(text):
        qty      = _parse_amount(m.group(3))
        rate     = _parse_amount(m.group(4))
        amount   = _parse_amount(m.group(5))
        discount = _parse_amount(m.group(6))
        taxable  = _parse_amount(m.group(7))
        vat_pct  = _parse_amount(m.group(8))
        vat_amt  = _parse_amount(m.group(9))
        total    = _parse_amount(m.group(10))

        if amount == 0 and qty and rate:
            amount = qty * rate
        if taxable == 0:
            taxable = amount - discount
        if vat_amt == 0 and vat_pct:
            vat_amt = taxable * (vat_pct / 100)
        if total == 0:
            total = taxable + vat_amt

        items.append({
            "description": m.group(2).strip(),
            "qty":         str(qty),
            "rate":        f"{rate:.2f}",
            "amount":      f"{amount:.2f}",
            "discount":    f"{discount:.2f}",
            "taxable_amt": f"{taxable:.2f}",
            "vat_pct":     str(int(vat_pct)) if vat_pct == int(vat_pct) else str(vat_pct),
            "vat_amt":     f"{vat_amt:.2f}",
            "total_amt":   f"{total:.2f}",
        })

    # Fallback: simpler 5-column pattern
    if not items:
        simple = re.compile(
            rf"^(\d+)\s+(.+?)\s+({num})\s+({num})\s+({num})\s*$",
            re.MULTILINE,
        )
        for m in simple.finditer(text):
            qty   = _parse_amount(m.group(3))
            rate  = _parse_amount(m.group(4))
            total = _parse_amount(m.group(5))
            if total == 0:
                total = qty * rate
            items.append({
                "description": m.group(2).strip(),
                "qty":         str(qty),
                "rate":        f"{rate:.2f}",
                "amount":      f"{total:.2f}",
                "discount":    "0.00",
                "taxable_amt": f"{total:.2f}",
                "vat_pct":     "0",
                "vat_amt":     "0.00",
                "total_amt":   f"{total:.2f}",
            })

    return items


def parse_po(file_path: str) -> dict:
    text = _extract_text(file_path)
    if not text:
        logger.warning("po_parser: empty text from %s", file_path)
        return {}

    logger.debug("po_parser text:\n%s", text[:2000])

    po_number = _search(r"PO\s*(?:NO|NUMBER|#)\s*[:\-]?\s*([\w\-/]+)", text, group=1)

    po_date = _normalise_date(
        _search(r"PO\s*DATE\s*[:\-]?\s*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4})", text, group=1)
    )

    expiry_date = _normalise_date(
        _search(r"EXPIR[YY]\s*DATE\s*[:\-]?\s*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4})", text, group=1)
    )

    delivery_date = _normalise_date(
        _search(r"DELIVER[YY]\s*DATE\s*[:\-]?\s*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4})", text, group=1)
    )

    # Payment terms — match the value after PAYMENT :
    payment_terms = _search(r"PAYMENT\s*[:\-]\s*([^\n]{1,40})", text, group=1)

    currency = _search(r"CURRENCY\s*[:\-]?\s*([A-Z]{3})", text, group=1) or "USD"

    # Customer = first non-empty line of the document
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    customer_name = lines[0] if lines else None

    # Bill To address — P.O. Box line
    bill_to = _search(r"(P\.?O\.?\s*Box[^\n]*)", text, group=1)
    if not bill_to:
        bill_to = _search(r"(?:Bill\s*To|Ship\s*To)[^\n]*\n([^\n]+)", text, group=1)

    # Authorised signatory
    signatory = _search(
        r"(?:For\s+)([A-Z][^\n]{5,80}(?:Company|LLC|Ltd|Inc|Corp)[^\n]*)",
        text, group=1
    )

    line_items = _parse_line_items(text)

    # Total value — Net Amount After VAT first
    total_raw = _search(r"Net\s*Amount\s*After\s*VAT\s+([\d,]+\.?\d*)", text, group=1)
    if not total_raw:
        total_raw = _search(r"(?:^|\s)Total\s+([\d,]+\.?\d*)", text, group=1)
    total_value = _parse_amount(total_raw) if total_raw else None

    if not total_value and line_items:
        total_value = sum(_parse_amount(li["total_amt"]) for li in line_items)

    return {
        "po_number":            po_number,
        "po_date":              po_date,
        "expiry_date":          expiry_date,
        "delivery_date":        delivery_date,
        "payment_terms":        payment_terms,
        "currency":             currency,
        "customer_name":        customer_name,
        "bill_to_address":      bill_to,
        "ship_to_address":      bill_to,
        "authorised_signatory": signatory,
        "total_value":          total_value,
        "line_items":           line_items,
    }
