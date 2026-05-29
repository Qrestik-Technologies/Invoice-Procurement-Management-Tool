from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_logs import AuditLog


async def write_audit_log(
    db: AsyncSession,
    *,
    table_name: str,
    record_id: int,
    action: str,
    changed_by: int,
    old_value: dict[str, Any] | None = None,
    new_value: dict[str, Any] | None = None,
) -> None:
    log = AuditLog(
        table_name=table_name,
        record_id=record_id,
        action=action,
        changed_by=changed_by,
        old_value=old_value,
        new_value=new_value,
    )
    db.add(log)
