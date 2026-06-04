from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    String,
    Boolean,
    func,
)

from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from app.core.database import Base


class InvoiceReminder(Base):
    __tablename__ = "invoice_reminders"

    id: Mapped[int] = mapped_column(primary_key=True)

    invoice_id: Mapped[int] = mapped_column(
        ForeignKey("invoices.id"),
        nullable=False,
        index=True
    )

    reminder_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    sent: Mapped[bool] = mapped_column(
        Boolean,
        default=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    invoice = relationship(
    "Invoice",
    back_populates="scheduled_reminders"
)