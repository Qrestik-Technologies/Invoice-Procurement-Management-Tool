from datetime import datetime

from sqlalchemy import DateTime, Enum, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base
from app.models.enums import TemplateType


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50))
    address: Mapped[str | None] = mapped_column(Text)
    template_type: Mapped[TemplateType] = mapped_column(
        Enum(TemplateType), nullable=False, default=TemplateType.standard
    )
    ship_to_address: Mapped[str | None] = mapped_column(Text)
    payment_terms: Mapped[str | None] = mapped_column(String(100))  # e.g. "Net 30", "Net 45"
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    milestones = relationship("Milestone", back_populates="customer")
    invoices = relationship("Invoice", back_populates="customer")
