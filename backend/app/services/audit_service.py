from typing import Any
import json
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.domain import AuditLog
from app.models.enums import AuditAction


async def write_audit(
    db: AsyncSession,
    changed_by: int,
    entity_type: str,
    entity_id: int,
    action: AuditAction,
    detail: Any = None,
) -> None:
    log = AuditLog(
        changed_by=changed_by,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        detail=json.dumps(detail) if detail and not isinstance(detail, str) else detail,
    )
    db.add(log)
