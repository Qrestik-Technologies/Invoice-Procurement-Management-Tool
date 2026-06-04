import asyncio
from datetime import timedelta

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.invoices import Invoice
from app.models.milestones import Milestone
from app.models.enums import AlertStatus


async def backfill_milestones():
    async with AsyncSessionLocal() as db:

        result = await db.execute(
            select(Invoice).where(Invoice.milestone_id.is_(None))
        )

        invoices = result.scalars().all()

        print(f"Found {len(invoices)} invoices without milestones")

        for invoice in invoices:

            milestone = Milestone(
                project_name=f"Invoice {invoice.invoice_number}",
                customer_id=invoice.customer_id,
                start_date=invoice.invoice_date,
                end_date=invoice.invoice_date + timedelta(days=30),
                alert_status=AlertStatus.on_track,
                notes=f"Auto-generated from invoice {invoice.invoice_number}",
            )

            db.add(milestone)
            await db.flush()

            invoice.milestone_id = milestone.id

            print(
                f"Created milestone {milestone.id} for invoice {invoice.invoice_number}"
            )

        await db.commit()

        print("Migration completed successfully")


if __name__ == "__main__":
    asyncio.run(backfill_milestones())