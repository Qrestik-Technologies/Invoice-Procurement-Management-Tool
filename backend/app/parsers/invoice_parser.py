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

    result = InvoiceParseSchema(
        raw_text_length=len(text),
        line_items=merged.get("line_items") or [],
        **{k: v for k, v in merged.items() if k != "line_items"},
    )

    missing = [f for f in REQUIRED_FIELDS if getattr(result, f) in (None, "", [])]
    result.missing_fields = missing
    return result
