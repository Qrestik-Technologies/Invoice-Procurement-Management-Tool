from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, Enum, ForeignKey, JSON, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base
from app.models.enums import POStatus


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    po_number: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    po_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    expiry_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    total_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    billing_terms: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    payment_terms: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ship_to_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    bill_to_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    authorised_signatory: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    line_items: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    status: Mapped[POStatus] = mapped_column(Enum(POStatus), nullable=False, default=POStatus.draft)
    document_id: Mapped[Optional[int]] = mapped_column(ForeignKey("documents.id"), nullable=True)
    confirmed_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    company = relationship("Company", foreign_keys=[company_id])
    milestones = relationship("Milestone", back_populates="purchase_order")
    invoices = relationship("Invoice", back_populates="purchase_order")
    document = relationship("Document", foreign_keys=[document_id])
    uploader = relationship("User", foreign_keys=[uploaded_by])
    confirmer = relationship("User", foreign_keys=[confirmed_by])
