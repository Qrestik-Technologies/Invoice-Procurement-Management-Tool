from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.documents import Document
from app.models.users import User
from app.schemas import APIResponse, DocumentRead

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=APIResponse[list[DocumentRead]])
async def list_documents(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    offset = (page - 1) * page_size
    stmt = (
        select(Document)
        .options(selectinload(Document.uploader), selectinload(Document.linked_invoice))
        .order_by(Document.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()

    docs = []
    for d in rows:
        item = DocumentRead.model_validate(d)
        item.uploader_name = d.uploader.name if d.uploader else None
        item.linked_invoice_number = d.linked_invoice.invoice_number if d.linked_invoice else None
        docs.append(item)

    return APIResponse(data=docs)
