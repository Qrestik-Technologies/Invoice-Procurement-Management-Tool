import re
from datetime import datetime
from pathlib import Path

from app.schemas import InvoiceParseSchema, LineItemSchema

REQUIRED_FIELDS = ["invoice_number", "invoice_date", "total", "customer_name"]

_nlp = None


def _get_nlp():
    global _nlp
    if _nlp is None:
        try:
            import spacy

            _nlp = spacy.load("en_core_web_sm")
        except OSError:
            _nlp = False
    return _nlp if _nlp else None


def _extract_text_pdf(path: str) -> str:
    import pdfplumber

    parts: list[str] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            parts.append(text)
            if len(text.strip()) < 50:
                try:
                    import pytesseract

                    img = page.to_image(resolution=200).original
                    ocr = pytesseract.image_to_string(img)
                    if len(ocr.strip()) > len(text.strip()):
                        parts[-1] = ocr
                except Exception:
                    pass
    return "\n".join(parts)


def _extract_text_docx(path: str) -> str:
    from docx import Document

    doc = Document(path)
    parts = [p.text for p in doc.paragraphs if p.text.strip()]
    for table in doc.tables:
        for row in table.rows:
            parts.append(" | ".join(cell.text.strip() for cell in row.cells))
    return "\n".join(parts)


def _regex_extract(text: str) -> dict:
    data: dict = {}
    inv_match = re.search(r"(?:INV[-\s]?|Invoice\s*#?\s*)(\d{4,}|[A-Z0-9-]{4,})", text, re.I)
    if inv_match:
        data["invoice_number"] = inv_match.group(0).strip().upper().replace(" ", "-")

    po_match = re.search(r"(?:PO|P\.O\.)\s*(?:#|No\.?)?\s*([A-Z0-9-]+)", text, re.I)
    if po_match:
        data["po_number"] = po_match.group(1)

    date_patterns = [
        r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
        r"((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})",
    ]
    for pat in date_patterns:
        m = re.search(r"Invoice\s*Date[:\s]*" + pat, text, re.I)
        if not m:
            m = re.search(pat, text)
        if m:
            raw = m.group(1)
            for fmt in ("%m/%d/%Y", "%m-%d-%Y", "%d/%m/%Y", "%B %d, %Y", "%b %d, %Y"):
                try:
                    data["invoice_date"] = datetime.strptime(raw.replace(",", ""), fmt).date()
                    break
                except ValueError:
                    continue
            break

    money = re.findall(r"\$?\s*([\d,]+\.\d{2})", text)
    if money:
        amounts = [float(x.replace(",", "")) for x in money]
        data["total"] = max(amounts)
        if len(amounts) > 1:
            data["tax"] = amounts[-2] if amounts[-2] < data["total"] else None
            data["subtotal"] = data["total"] - (data.get("tax") or 0)

    if "$" in text:
        data["currency"] = "USD"
    elif "€" in text:
        data["currency"] = "EUR"

    return data


def _ner_extract(text: str) -> dict:
    nlp = _get_nlp()
    if not nlp:
        return {}
    doc = nlp(text[:100000])
    data: dict = {}
    orgs = [ent.text for ent in doc.ents if ent.label_ == "ORG"]
    if orgs:
        data["customer_name"] = orgs[0]
    return data


def _extract_address_block(text: str, header: str) -> str | None:
    pattern = rf"{header}\s*[:\n]\s*(.+?)(?:\n\s*\n|Ship To|Bill To|Line Items|Subtotal|Total|$)"
    m = re.search(pattern, text, re.I | re.S)
    if m:
        return m.group(1).strip()[:500]
    return None


def _extract_line_items(path: str, text: str) -> list[LineItemSchema]:
    items: list[LineItemSchema] = []
    ext = Path(path).suffix.lower()

    if ext == ".pdf":
        import pdfplumber

        largest: list[list[str | None]] = []
        with pdfplumber.open(path) as pdf:
            for page in pdf.pages:
                for table in page.extract_tables() or []:
                    if len(table) > len(largest):
                        largest = table
        if len(largest) > 1:
            for row in largest[1:]:
                if not row or not any(row):
                    continue
                cells = [str(c or "").strip() for c in row]
                if len(cells) >= 4:
                    try:
                        qty = float(re.sub(r"[^\d.]", "", cells[1]) or 1)
                        rate = float(re.sub(r"[^\d.]", "", cells[2]) or 0)
                        amount = float(re.sub(r"[^\d.]", "", cells[3]) or qty * rate)
                        items.append(
                            LineItemSchema(description=cells[0], qty=qty, rate=rate, amount=amount)
                        )
                    except ValueError:
                        continue
    elif ext in {".docx", ".doc"}:
        from docx import Document

        doc = Document(path)
        for table in doc.tables:
            rows = table.rows
            if len(rows) < 2:
                continue
            for row in rows[1:]:
                cells = [c.text.strip() for c in row.cells]
                if len(cells) >= 4 and cells[0]:
                    try:
                        qty = float(re.sub(r"[^\d.]", "", cells[1]) or 1)
                        rate = float(re.sub(r"[^\d.]", "", cells[2]) or 0)
                        amount = float(re.sub(r"[^\d.]", "", cells[3]) or qty * rate)
                        items.append(
                            LineItemSchema(description=cells[0], qty=qty, rate=rate, amount=amount)
                        )
                    except ValueError:
                        continue

    if not items:
        for line in text.splitlines():
            m = re.match(r"^(.+?)\s+(\d+(?:\.\d+)?)\s+\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})$", line.strip())
            if m:
                items.append(
                    LineItemSchema(
                        description=m.group(1).strip(),
                        qty=float(m.group(2)),
                        rate=float(m.group(3).replace(",", "")),
                        amount=float(m.group(4).replace(",", "")),
                    )
                )
    return items


# ---------------------------------------------------------------------------
# NEW: Vendor detection
# ---------------------------------------------------------------------------

def _detect_vendor(text: str) -> str:
    """Return 'qrestik', 'infinitum', or 'generic' based on PDF text content."""
    t = text.lower()
    if any(k in t for k in ["qrestik", "hor al anz", "nrakaeak", "rakbank"]):
        return "qrestik"
    if any(k in t for k in ["infinitum global", "infinitumglobal.org", "jp morgan chase"]):
        return "infinitum"
    return "generic"


# ---------------------------------------------------------------------------
# NEW: Qrestik-specific extraction
# ---------------------------------------------------------------------------

def _extract_qrestik(text: str) -> dict:
    """
    Extract fields specific to Qrestik invoices (AED currency, RAKBANK remittance).
    Returns a dict that gets merged into the main result.
    """
    data: dict = {}

    # Invoice number — Qrestik format: "Invoice number : 0069"
    m = re.search(r"Invoice\s+number\s*[:\-]\s*(\d+)", text, re.I)
    if m:
        data["invoice_number"] = m.group(1).strip()

    # Date — Qrestik format: "Date : 13/03/2026"
    m = re.search(r"Date\s*[:\-]\s*(\d{1,2}/\d{1,2}/\d{4})", text, re.I)
    if m:
        raw = m.group(1)
        for fmt in ("%d/%m/%Y", "%m/%d/%Y"):
            try:
                data["invoice_date"] = datetime.strptime(raw, fmt).date()
                break
            except ValueError:
                continue

    # Currency and total — "AED 7,345"
    data["currency"] = "AED"
    m = re.search(r"AED\s+([\d,]+(?:\.\d+)?)", text)
    if m:
        data["total"] = float(m.group(1).replace(",", ""))

    # Vendor name
    data["vendor_name"] = "Qrestik Technologies L.L.C"

    # Bill-to customer
    m = re.search(r"Bill to[:\s]*\n\s*(.+?)(?:\n|,)", text, re.I)
    if m:
        data["customer_name"] = m.group(1).strip()

    # Bill-to PO Box
    m = re.search(r"PO\s*Box\s+(\d+)", text, re.I)
    if m:
        data["bill_to_po_box"] = m.group(1)

    # Remittance / banking fields
    m = re.search(r"Account Number\s*[–\-:]\s*([\d]+)", text)
    if m:
        data["bank_account_number"] = m.group(1)

    m = re.search(r"IBAN Number\s*[–\-:]\s*([A-Z0-9]+)", text)
    if m:
        data["bank_iban"] = m.group(1)

    m = re.search(r"Branch Name\s*[–\-:]\s*(.+)", text)
    if m:
        data["bank_branch"] = m.group(1).strip()

    m = re.search(r"Swift Code\s*[–\-:]\s*([A-Z0-9]+)", text)
    if m:
        data["bank_swift"] = m.group(1)

    m = re.search(r"Routing Code\s*[–\-:]\s*([0-9]+)", text)
    if m:
        data["bank_routing"] = m.group(1)

    m = re.search(r"Address\s*[–\-:]\s*(.+)", text)
    if m:
        data["bank_address"] = m.group(1).strip()

    return data


# ---------------------------------------------------------------------------
# NEW: Infinitum-specific extraction
# ---------------------------------------------------------------------------

def _extract_infinitum(text: str) -> dict:
    """
    Extract fields specific to Infinitum Global invoices (USD, JP Morgan remittance,
    ship-to contact, PO number, SKU, billing period).
    Returns a dict that gets merged into the main result.
    """
    data: dict = {}

    # Invoice number — "INVOICE#: 3611"
    m = re.search(r"INVOICE\s*#\s*[:\-]?\s*(\d+)", text, re.I)
    if m:
        data["invoice_number"] = m.group(1).strip()

    # Date — "DATE: 01st June 2026"
    m = re.search(r"DATE\s*[:\-]\s*(.+?)(?:\n|INVOICE)", text, re.I | re.S)
    if m:
        raw = m.group(1).strip()
        # Strip ordinal suffixes: 1st → 1, 2nd → 2, etc.
        raw_clean = re.sub(r"(\d+)(?:st|nd|rd|th)", r"\1", raw)
        for fmt in ("%d %B %Y", "%d %b %Y"):
            try:
                data["invoice_date"] = datetime.strptime(raw_clean.strip(), fmt).date()
                break
            except ValueError:
                continue

    # Currency and total
    data["currency"] = "USD"
    m = re.search(r"Total\s+\$\s*([\d,]+(?:\.\d+)?)", text, re.I)
    if m:
        data["total"] = float(m.group(1).replace(",", ""))

    # Vendor name
    data["vendor_name"] = "Infinitum Global LLC"

    # Bill-to company (first line after "Bill To:")
    m = re.search(r"Bill To[:\s]*\n\s*(.+?)(?:\n)", text, re.I)
    if m:
        data["customer_name"] = m.group(1).strip()

    # Ship-to contact name (first line after "Ship To:")
    m = re.search(r"Ship To[:\s]*\n\s*(.+?)(?:\n)", text, re.I)
    if m:
        data["ship_to_contact"] = m.group(1).strip()

    # Ship-to company (second line after "Ship To:")
    m = re.search(r"Ship To[:\s]*\n\s*.+?\n\s*(.+?)(?:\n)", text, re.I)
    if m:
        data["ship_to_company"] = m.group(1).strip()

    # PO number — "#PO018558"
    m = re.search(r"#\s*(PO\d+)", text, re.I)
    if m:
        data["po_number"] = m.group(1)

    # SKU / Code
    m = re.search(r"\b(\d{6}-\d+)\b", text)
    if m:
        data["sku"] = m.group(1)

    # Billing period — "1st May 2026 to 31st May 2026"
    m = re.search(
        r"(\d+\w*\s+\w+\s+\d{4})\s+to\s+(\d+\w*\s+\w+\s+\d{4})",
        text, re.I
    )
    if m:
        data["period_start"] = m.group(1).strip()
        data["period_end"] = m.group(2).strip()

    # Remittance / banking
    m = re.search(r"Bank Name[:\s]+(.+)", text)
    if m:
        data["bank_name"] = m.group(1).strip()

    m = re.search(r"Account[:\s]+([\d]+)", text)
    if m:
        data["bank_account_number"] = m.group(1)

    m = re.search(r"Routing\s*#[:\s]+([\d]+)", text)
    if m:
        data["bank_routing"] = m.group(1)

    m = re.search(
        r"Federal Employee Identification Number\s*\(FEIN\)[:\s]+([\d\-]+)", text
    )
    if m:
        data["bank_fein"] = m.group(1)

    m = re.search(r"Address Associated w/\s*Account[:\s]+(.+)", text)
    if m:
        data["bank_address"] = m.group(1).strip()

    m = re.search(r"Email Associated w/\s*Account[:\s]+(\S+@\S+)", text)
    if m:
        data["bank_email"] = m.group(1)

    return data


# ---------------------------------------------------------------------------
# Existing parse_invoice — extended with vendor-specific enrichment
# ---------------------------------------------------------------------------

def parse_invoice(file_path: str) -> InvoiceParseSchema:
    path = Path(file_path)
    if not path.exists():
        return InvoiceParseSchema(missing_fields=REQUIRED_FIELDS + ["file"])

    ext = path.suffix.lower()
    if ext == ".pdf":
        text = _extract_text_pdf(file_path)
    elif ext in {".docx", ".doc"}:
        text = _extract_text_docx(file_path)
    else:
        return InvoiceParseSchema(missing_fields=REQUIRED_FIELDS + ["file_type"])

    merged: dict = {}
    merged.update(_regex_extract(text))
    merged.update(_ner_extract(text))
    merged["bill_to_address"] = _extract_address_block(text, "Bill To")
    merged["ship_to_address"] = _extract_address_block(text, "Ship To")
    merged["line_items"] = _extract_line_items(file_path, text)

    vendor = _detect_vendor(text)
    if vendor == "qrestik":
        merged.update(_extract_qrestik(text))
        merged["vendor"] = "qrestik"
    elif vendor == "infinitum":
        merged.update(_extract_infinitum(text))
        merged["vendor"] = "infinitum"

    result = InvoiceParseSchema(
        raw_text_length=len(text),
        line_items=merged.get("line_items") or [],
        **{k: v for k, v in merged.items() if k != "line_items"},
    )

    missing = [f for f in REQUIRED_FIELDS if getattr(result, f) in (None, "", [])]
    result.missing_fields = missing
    return result
