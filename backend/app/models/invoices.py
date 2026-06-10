from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base
from app.models.enums import InvoiceStatus


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    invoice_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False, index=True)
    milestone_id: Mapped[int | None] = mapped_column(ForeignKey("milestones.id"), index=True)
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    line_items: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    tax: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    status: Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus), nullable=False, default=InvoiceStatus.draft, index=True
    )
    payment_terms: Mapped[str | None] = mapped_column(String(100))
    po_number: Mapped[str | None] = mapped_column(String(100))
    bill_to_address: Mapped[str | None] = mapped_column(Text)
    ship_to_address: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    uploaded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    file_path: Mapped[str | None] = mapped_column(String(500))
    onedrive_url: Mapped[str | None] = mapped_column(String(1000))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    customer = relationship("Customer", back_populates="invoices")
    milestone = relationship("Milestone", back_populates="invoices")
    uploader = relationship("User", back_populates="uploaded_invoices", foreign_keys=[uploaded_by])
    payments = relationship("Payment", back_populates="invoice")
    reminder_logs = relationship("ReminderLog", back_populates="invoice")
    documents = relationship("Document", back_populates="linked_invoice")
