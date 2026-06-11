"""
PO Parser — uses pdfplumber table extraction for accurate line items.
"""

import re
import logging

logger = logging.getLogger(__name__)


def _clean_cell(val) -> str:
    if val is None:
        return ""
    return re.sub(r'\n', '', str(val)).strip()


def _clean_text(val: str) -> str:
    """Strip Arabic/garbage characters (rendered as repeated n's by pdfplumber)."""
    if not val:
        return val
    return re.sub(r'\s*n{3,}.*$', '', val).strip()


def _parse_amount(s) -> float:
    if not s:
        return 0.0
    cleaned = re.sub(r"[^\d.]", "", _clean_cell(s))
    return float(cleaned) if cleaned else 0.0


def _normalise_date(raw) -> str | None:
    if not raw:
        return None
    raw = raw.strip()
    if re.match(r"\d{4}-\d{2}-\d{2}", raw):
        return raw
    m = re.match(r"(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{4})", raw)
    if m:
        d, mo, y = m.group(1), m.group(2), m.group(3)
        return f"{y}-{mo.zfill(2)}-{d.zfill(2)}"
    return raw


def _search(pattern: str, text: str, group: int = 0, flags: int = re.IGNORECASE):
    m = re.search(pattern, text, flags)
    if not m:
        return None
    try:
        return m.group(group).strip()
    except IndexError:
        return m.group(0).strip()


def _extract_with_pdfplumber(path: str):
    import pdfplumber
    with pdfplumber.open(path) as pdf:
        text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        tables = []
        for page in pdf.pages:
            tables.extend(page.extract_tables() or [])
    return text, tables


def _parse_line_items_from_table(tables: list) -> list:
    items = []
    for table in tables:
        if not table or len(table) < 2:
            continue

        header = [_clean_cell(c).lower() for c in (table[0] or [])]
        if not any("item" in h or "description" in h or "sr" in h for h in header):
            continue

        col = {}
        for i, h in enumerate(header):
            if "sr" in h or h == "#":         col["sr"] = i
            elif "item" in h or "desc" in h:  col["desc"] = i
            elif "qty" in h:                   col["qty"] = i
            elif "rate" in h:                  col["rate"] = i
            elif "taxable" in h:               col["taxable"] = i
            elif "vat" in h and "%" in h:      col["vat_pct"] = i
            elif "vat" in h and "amt" in h:    col["vat_amt"] = i
            elif "total" in h:                 col["total"] = i
            elif "discount" in h:              col["discount"] = i
            elif "amount" in h:                col["amount"] = i

        for row in table[1:]:
            if not row:
                continue
            first = _clean_cell(row[0])
            if not first or not first.isdigit():
                continue

            desc     = _clean_cell(row[col.get("desc", 1)])     if col.get("desc")    is not None else ""
            qty      = _parse_amount(row[col.get("qty", 2)])    if col.get("qty")     is not None else 1.0
            rate     = _parse_amount(row[col.get("rate", 3)])   if col.get("rate")    is not None else 0.0
            discount = _parse_amount(row[col.get("discount", 5)]) if col.get("discount") is not None else 0.0
            taxable  = _parse_amount(row[col.get("taxable", 6)]) if col.get("taxable") is not None else 0.0
            vat_pct  = _parse_amount(row[col.get("vat_pct", 7)]) if col.get("vat_pct") is not None else 0.0
            vat_amt  = _parse_amount(row[col.get("vat_amt", 8)]) if col.get("vat_amt") is not None else 0.0
            total    = _parse_amount(row[col.get("total", 9)])   if col.get("total")   is not None else 0.0
            amount   = _parse_amount(row[col.get("amount", 4)])  if col.get("amount")  is not None else 0.0

            if amount == 0 and qty and rate:
                amount = qty * rate
            if taxable == 0:
                taxable = amount - discount
            if vat_amt == 0 and vat_pct:
                vat_amt = taxable * (vat_pct / 100)
            if total == 0:
                total = taxable + vat_amt

            items.append({
                "description": desc,
                "qty":         str(qty),
                "rate":        f"{rate:.2f}",
                "amount":      f"{amount:.2f}",
                "discount":    f"{discount:.2f}",
                "taxable_amt": f"{taxable:.2f}",
                "vat_pct":     str(int(vat_pct)) if vat_pct == int(vat_pct) else str(vat_pct),
                "vat_amt":     f"{vat_amt:.2f}",
                "total_amt":   f"{total:.2f}",
            })
        if items:
            break

    return items


def parse_po(file_path: str) -> dict:
    try:
        text, tables = _extract_with_pdfplumber(file_path)
    except Exception as e:
        logger.error("pdfplumber failed: %s", e)
        text, tables = "", []

    if not text:
        logger.warning("po_parser: empty text from %s", file_path)
        return {}

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

    payment_terms = _search(r"PAYMENT\s*[:\-]\s*([^\n]{1,40})", text, group=1)

    # Currency: read from doc but default AED
    currency = _search(r"CURRENCY\s*[:\-]?\s*([A-Z]{3})", text, group=1) or "AED"

    # Customer name: first non-empty line, strip Arabic garbage
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    customer_name = _clean_text(lines[0]) if lines else None

    # Bill To address: P.O. Box line, strip Arabic garbage
    bill_to_raw = _search(r"(P\.?O\.?\s*Box[^\n]*)", text, group=1)
    if not bill_to_raw:
        bill_to_raw = _search(r"(?:Bill\s*To|Ship\s*To)[^\n]*\n([^\n]+)", text, group=1)
    bill_to = _clean_text(bill_to_raw) if bill_to_raw else None

    signatory = _search(
        r"(?:For\s+)([A-Z][^\n]{5,80}(?:Company|LLC|Ltd|Inc|Corp)[^\n]*)",
        text, group=1
    )

    line_items = _parse_line_items_from_table(tables)

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
