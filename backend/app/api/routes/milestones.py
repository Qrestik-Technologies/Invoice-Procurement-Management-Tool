from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.enums import UserRole
from app.models.invoices import Invoice
from app.models.milestones import Milestone
from app.models.users import User
from app.schemas import APIResponse, MilestoneCreate, MilestoneRead, MilestoneUpdate
from app.services.audit_service import write_audit_log
from app.services.invoice_helpers import model_to_dict

router = APIRouter(prefix="/milestones", tags=["milestones"])


def _serialize(m: Milestone, linked_number: str | None = None) -> MilestoneRead:
    data = MilestoneRead.model_validate(m)
    data.linked_invoice_number = linked_number
    return data


@router.get("", response_model=APIResponse[list[MilestoneRead]])
async def list_milestones(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(
        select(Milestone).options(selectinload(Milestone.invoices)).order_by(Milestone.end_date)
    )
    items = []
    for m in result.scalars().all():
        linked = m.invoices[0].invoice_number if m.invoices else None
        items.append(_serialize(m, linked))
    return APIResponse(data=items)


@router.post("", response_model=APIResponse[MilestoneRead], status_code=status.HTTP_201_CREATED)
async def create_milestone(
    body: MilestoneCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(require_roles(UserRole.admin, UserRole.entry))],
):
    milestone = Milestone(**body.model_dump())
    db.add(milestone)
    await db.flush()
    await write_audit_log(
        db,
        table_name="milestones",
        record_id=milestone.id,
        action="create",
        changed_by=current.id,
        new_value=body.model_dump(mode="json"),
    )
    await db.commit()
    await db.refresh(milestone)
    return APIResponse(data=_serialize(milestone))


@router.put("/{milestone_id}", response_model=APIResponse[MilestoneRead])
async def update_milestone(
    milestone_id: int,
    body: MilestoneUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(require_roles(UserRole.admin, UserRole.entry))],
):
    result = await db.execute(select(Milestone).where(Milestone.id == milestone_id))
    milestone = result.scalar_one_or_none()
    if milestone is None:
        raise HTTPException(status_code=404, detail="Milestone not found")
    old = model_to_dict(milestone, ["project_name", "customer_id", "start_date", "end_date", "alert_status"])
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(milestone, k, v)
    await write_audit_log(
        db,
        table_name="milestones",
        record_id=milestone.id,
        action="update",
        changed_by=current.id,
        old_value=old,
        new_value=model_to_dict(milestone, ["project_name", "customer_id", "start_date", "end_date", "alert_status"]),
    )
    await db.commit()
    await db.refresh(milestone)
    return APIResponse(data=_serialize(milestone))


@router.delete("/{milestone_id}", response_model=APIResponse[None])
async def delete_milestone(
    milestone_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(require_roles(UserRole.admin, UserRole.entry))],
):
    result = await db.execute(select(Milestone).where(Milestone.id == milestone_id))
    milestone = result.scalar_one_or_none()
    if milestone is None:
        raise HTTPException(status_code=404, detail="Milestone not found")
    inv_check = await db.execute(select(Invoice).where(Invoice.milestone_id == milestone_id))
    if inv_check.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Cannot delete milestone with linked invoices")
    old = model_to_dict(milestone, ["project_name", "customer_id"])
    await db.delete(milestone)
    await write_audit_log(
        db,
        table_name="milestones",
        record_id=milestone_id,
        action="delete",
        changed_by=current.id,
        old_value=old,
    )
    await db.commit()
    return APIResponse(message="Milestone deleted")
