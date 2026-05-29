from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.customers import Customer
from app.models.enums import AlertStatus, InvoiceStatus, TemplateType, UserRole
from app.models.invoices import Invoice
from app.models.milestones import Milestone
from app.models.users import User


async def seed_database(db: AsyncSession) -> None:
    result = await db.execute(select(User).where(User.email == "admin@qrestik.com"))
    if result.scalar_one_or_none():
        return

    admin = User(
        name="Alex Rivera",
        email="admin@qrestik.com",
        hashed_password=hash_password("admin123"),
        role=UserRole.admin,
        is_active=True,
    )
    entry = User(
        name="Sarah Chen",
        email="sarah.chen@qrestik.com",
        hashed_password=hash_password("entry123"),
        role=UserRole.entry,
        is_active=True,
    )
    readonly = User(
        name="Subra Krishnan",
        email="subra.krishnan@qrestik.com",
        hashed_password=hash_password("readonly123"),
        role=UserRole.readonly,
        is_active=True,
    )
    db.add_all([admin, entry, readonly])
    await db.flush()

    c1 = Customer(
        name="Meridian Construction Group",
        email="accounts@meridianconstruction.com",
        phone="(512) 555-0142",
        template_type=TemplateType.standard,
    )
    c2 = Customer(
        name="EMCOR Facilities Services",
        email="ap@emcorfacilities.com",
        phone="(713) 555-0198",
        template_type=TemplateType.emcor,
        ship_to_address="EMCOR Facilities — Building 4, 2200 Commerce St, Houston TX 77002",
    )
    db.add_all([c1, c2])
    await db.flush()

    m1 = Milestone(
        project_name="Meridian HQ Renovation — Phase 2",
        customer_id=c1.id,
        start_date=date(2026, 1, 15),
        end_date=date(2026, 4, 5),
        alert_status=AlertStatus.due_soon,
    )
    db.add(m1)
    await db.flush()

    inv = Invoice(
        invoice_number="INV-2026-0001",
        customer_id=c1.id,
        milestone_id=m1.id,
        invoice_date=date.today(),
        line_items=[{"description": "Electrical rough-in", "qty": 1, "rate": 42500, "amount": 42500}],
        subtotal=Decimal("42500"),
        tax=Decimal("3506.25"),
        total=Decimal("46006.25"),
        status=InvoiceStatus.pending,
        payment_terms="Net 30",
        uploaded_by=admin.id,
    )
    db.add(inv)
    await db.commit()
