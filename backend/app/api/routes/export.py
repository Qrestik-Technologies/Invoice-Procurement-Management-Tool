import io
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.invoices import Invoice
from app.models.users import User

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/invoices")
async def export_invoices(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(
        select(Invoice).options(selectinload(Invoice.customer)).order_by(Invoice.invoice_date.desc())
    )
    wb = Workbook()
    ws = wb.active
    ws.title = "Invoices"
    ws.append(["Invoice Number", "Customer", "Date", "Status", "Subtotal", "Tax", "Total", "Currency"])

    for inv in result.scalars().all():
        ws.append(
            [
                inv.invoice_number,
                inv.customer.name if inv.customer else "",
                inv.invoice_date.isoformat(),
                inv.status.value,
                float(inv.subtotal),
                float(inv.tax),
                float(inv.total),
                inv.currency,
            ]
        )

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=invoices.xlsx"},
    )
