"""Milestone CRUD endpoints."""
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.company_scope import get_company_scope
from app.core.database import get_db
from app.core.rbac import require_admin, require_any_role, require_entry_or_above
from app.models.domain import Invoice, Milestone
from app.models.enums import AuditAction, MilestoneStatus
from app.schemas import APIResponse, MilestoneCreate, MilestoneRead, MilestoneUpdate
from app.services.audit_service import write_audit

router = APIRouter(prefix="/milestones", tags=["milestones"])


@router.get("", response_model=APIResponse[list[MilestoneRead]])
async def list_milestones(
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(require_any_role),
    company_id: Annotated[int | None, Depends(get_company_scope)] = None,
    invoice_id: int | None = Query(None),
):
    q = select(Milestone)
    if company_id is not None:
        q = q.join(Invoice).where(Invoice.company_id == company_id)
    if invoice_id:
        q = q.where(Milestone.invoice_id == invoice_id)
    result = await db.execute(q.order_by(Milestone.end_date))
    return APIResponse(data=[MilestoneRead.model_validate(m) for m in result.scalars().all()])


@router.get("/{milestone_id}", response_model=APIResponse[MilestoneRead])
async def get_milestone(
    milestone_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(require_any_role),
):
    result = await db.execute(select(Milestone).where(Milestone.id == milestone_id))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found")
    return APIResponse(data=MilestoneRead.model_validate(m))


@router.post("", response_model=APIResponse[MilestoneRead], status_code=status.HTTP_201_CREATED)
async def create_milestone(
    body: MilestoneCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_entry_or_above),
):
    inv = await db.execute(select(Invoice).where(Invoice.id == body.invoice_id))
    if not inv.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Invoice not found")

    m = Milestone(**body.model_dump())
    db.add(m)
    await db.flush()
    await write_audit(db, changed_by=current_user.id, entity_type="milestone",
                      entity_id=m.id, action=AuditAction.created)
    await db.commit()
    await db.refresh(m)
    return APIResponse(data=MilestoneRead.model_validate(m), message="Milestone created")


@router.put("/{milestone_id}", response_model=APIResponse[MilestoneRead])
async def update_milestone(
    milestone_id: int,
    body: MilestoneUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_entry_or_above),
):
    result = await db.execute(select(Milestone).where(Milestone.id == milestone_id))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found")

    changes = body.model_dump(exclude_none=True)
    for field, value in changes.items():
        setattr(m, field, value)

    # Auto-set completed_at when status flips to completed
    if body.status == MilestoneStatus.completed and not m.completed_at:
        m.completed_at = datetime.now(timezone.utc)

    await write_audit(db, changed_by=current_user.id, entity_type="milestone",
                      entity_id=milestone_id, action=AuditAction.updated, detail=changes)
    await db.commit()
    await db.refresh(m)
    return APIResponse(data=MilestoneRead.model_validate(m), message="Milestone updated")


@router.delete("/{milestone_id}", response_model=APIResponse[None])
async def delete_milestone(
    milestone_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(require_admin),
):
    result = await db.execute(select(Milestone).where(Milestone.id == milestone_id))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found")
    await write_audit(db, changed_by=current_user.id, entity_type="milestone",
                      entity_id=milestone_id, action=AuditAction.deleted)
    await db.delete(m)
    await db.commit()
    return APIResponse(message="Milestone deleted")
