from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base
from app.models.enums import AuditAction, InvoiceStatus, MilestoneStatus, MilestoneSource


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tax_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    company = relationship("Company", back_populates="customers")



class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    invoice_number: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    customer_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus), nullable=False, default=InvoiceStatus.draft
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)   # OneDrive path
    onedrive_item_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    received_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    po_id: Mapped[Optional[int]] = mapped_column(ForeignKey("purchase_orders.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    company = relationship("Company", back_populates="invoices")
    uploader = relationship("User", back_populates="uploaded_invoices", foreign_keys=[uploaded_by])
    milestones = relationship("Milestone", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="invoice", cascade="all, delete-orphan")
    reminders = relationship("Reminder", back_populates="invoice", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="linked_invoice")
    invoice_reminders = relationship("InvoiceReminder", back_populates="invoice")
    purchase_order = relationship("PurchaseOrder", back_populates="invoices")


class Milestone(Base):
    __tablename__ = "milestones"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    invoice_id: Mapped[Optional[int]] = mapped_column(ForeignKey("invoices.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    po_id: Mapped[Optional[int]] = mapped_column(ForeignKey("purchase_orders.id"), nullable=True, index=True)
    source: Mapped[MilestoneSource] = mapped_column(Enum(MilestoneSource), nullable=False, default=MilestoneSource.manual)
    status: Mapped[MilestoneStatus] = mapped_column(
        Enum(MilestoneStatus), nullable=False, default=MilestoneStatus.pending
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    invoice = relationship("Invoice", back_populates="milestones")
    purchase_order = relationship("PurchaseOrder", back_populates="milestones")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    invoice_id: Mapped[Optional[int]] = mapped_column(ForeignKey("invoices.id"), nullable=True)
    marked_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    invoice = relationship("Invoice", back_populates="payments")
    marker = relationship("User", back_populates="payments", foreign_keys=[marked_by])


class Reminder(Base):
    __tablename__ = "reminders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    invoice_id: Mapped[Optional[int]] = mapped_column(ForeignKey("invoices.id"), nullable=True)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    invoice = relationship("Invoice", back_populates="reminders")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    changed_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)   # e.g. "invoice"
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False)
    action: Mapped[AuditAction] = mapped_column(Enum(AuditAction), nullable=False)
    detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)       # JSON diff or notes
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    changer = relationship("User", back_populates="audit_logs", foreign_keys=[changed_by])
