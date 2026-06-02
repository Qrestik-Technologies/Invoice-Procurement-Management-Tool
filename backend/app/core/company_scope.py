"""Resolve active organization (company) from request header."""
from typing import Annotated

from fastapi import Header


async def get_company_scope(
    x_company_id: Annotated[int | None, Header(alias="X-Company-Id")] = None,
) -> int | None:
    return x_company_id
