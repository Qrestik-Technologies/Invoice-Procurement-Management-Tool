import os
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.documents import Document
from app.models.enums import SyncStatus, UserRole
from app.models.users import User
from app.parsers.invoice_parser import parse_invoice
from app.schemas import APIResponse, DocumentRead, ParseUploadResponse
from app.services.audit_service import write_audit_log
from app.services.onedrive_service import schedule_onedrive_sync

router = APIRouter(prefix="/documents", tags=["documents"])

UPLOAD_DIR = Path(settings.UPLOAD_DIR)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.get("", response_model=APIResponse[list[DocumentRead]])
async def list_documents(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.uploader), selectinload(Document.linked_invoice))
        .order_by(Document.created_at.desc())
    )
    docs = []
    for d in result.scalars().all():
        item = DocumentRead.model_validate(d)
        item.uploader_name = d.uploader.name if d.uploader else None
        item.linked_invoice_number = d.linked_invoice.invoice_number if d.linked_invoice else None
        docs.append(item)
    return APIResponse(data=docs)


@router.post("/upload", response_model=APIResponse[ParseUploadResponse], status_code=status.HTTP_201_CREATED)
async def upload_document(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(require_roles(UserRole.admin, UserRole.entry))],
    file: UploadFile = File(...),
    linked_invoice_id: int | None = None,
    parse: bool = True,
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename required")
    ext = Path(file.filename).suffix.lower()
    if ext not in {".pdf", ".docx", ".doc"}:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")

    safe_name = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / safe_name
    content = await file.read()
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
    from app.schemas import InvoiceParseSchema

    return APIResponse(
        data=ParseUploadResponse(
            document_id=doc.id,
            parse_result=parse_result or InvoiceParseSchema(missing_fields=["all"]),
        )
    )
