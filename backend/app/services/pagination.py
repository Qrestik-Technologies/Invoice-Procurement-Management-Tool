from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas import PaginationMeta


async def paginate(
    db: AsyncSession,
    stmt: Select,
    *,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list, PaginationMeta]:
    page = max(1, page)
    page_size = min(max(1, page_size), 200)
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.scalar(count_stmt)) or 0
    offset = (page - 1) * page_size
    result = await db.execute(stmt.offset(offset).limit(page_size))
    items = list(result.scalars().all())
    pages = max(1, (total + page_size - 1) // page_size)
    return items, PaginationMeta(total=total, page=page, page_size=page_size, pages=pages)
