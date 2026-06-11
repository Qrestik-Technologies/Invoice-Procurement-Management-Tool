import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.documents import Document
from app.models.enums import SyncStatus, UserRole
from app.models.users import User
from app.parsers.invoice_parser import parse_invoice
from app.schemas import APIResponse, DocumentRead, InvoiceParseSchema, ParseUploadResponse
from app.services.audit_service import write_audit_log
from app.services.onedrive_service import schedule_onedrive_sync
from app.services.pagination import paginate
from app.services.validators import require_invoice

router = APIRouter(prefix="/documents", tags=["documents"])

UPLOAD_DIR = Path(settings.UPLOAD_DIR)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc"}
ALLOWED_MIME = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}


@router.get("", response_model=APIResponse[list[DocumentRead]])
async def list_documents(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    stmt = (
        select(Document)
        .options(selectinload(Document.uploader), selectinload(Document.linked_invoice))
        .order_by(Document.created_at.desc())
    )
    rows, meta = await paginate(db, stmt, page=page, page_size=page_size)
    docs = []
    for d in rows:
        item = DocumentRead.model_validate(d)
        item.uploader_name = d.uploader.name if d.uploader else None
        item.linked_invoice_number = d.linked_invoice.invoice_number if d.linked_invoice else None
        docs.append(item)
    return APIResponse(data=docs, pagination=meta)


@router.get("/{document_id}/download")
async def download_document(
    document_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    path = Path(doc.file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found on server")
    return FileResponse(path, filename=doc.filename)


@router.post("/upload", response_model=APIResponse[ParseUploadResponse], status_code=status.HTTP_201_CREATED)
async def upload_document(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(require_entry_or_above)],
    file: UploadFile = File(...),
    linked_invoice_id: int | None = None,
    parse: bool = True,
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename required")
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")
    if file.content_type and file.content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum size of {settings.MAX_UPLOAD_BYTES // (1024 * 1024)} MB",
        )
    if linked_invoice_id is not None:
        await require_invoice(db, linked_invoice_id)

    safe_name = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / safe_name
    dest.write_bytes(content)

    doc = Document(
        filename=file.filename,
        file_path=str(dest),
        linked_invoice_id=linked_invoice_id,
        uploaded_by=current.id,
        sync_status=SyncStatus.pending,
    )
    db.add(doc)
    await db.flush()
    await write_audit_log(
        db,
        table_name="documents",
        record_id=doc.id,
        action="upload",
        changed_by=current.id,
        new_value={"filename": file.filename},
    )
    await db.commit()
    await db.refresh(doc)

    schedule_onedrive_sync(doc.id, str(dest), file.filename)

    parse_result = parse_invoice(str(dest)) if parse else None
    return APIResponse(
        data=ParseUploadResponse(
            document_id=doc.id,
            parse_result=parse_result or InvoiceParseSchema(missing_fields=["all"]),
        )
    )
