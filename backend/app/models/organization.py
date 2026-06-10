from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base


class Company(Base):
    """Legal entities / subsidiaries registered under this application."""

    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    legal_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    tax_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    default_currency: Mapped[str] = mapped_column(String(3), nullable=False, server_default="USD")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    users = relationship("User", back_populates="company")
    customers = relationship("Customer", back_populates="company")
    invoices = relationship("Invoice", back_populates="company")


class AppSettings(Base):
    """Singleton row (id=1) for application-wide configuration."""

    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    organization_name: Mapped[str] = mapped_column(String(255), nullable=False, default="Qrestik")
    organization_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    business_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tax_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    from_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reply_to_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    milestone_alert_emails: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_currency: Mapped[str] = mapped_column(String(3), nullable=False, server_default="USD")
    default_payment_terms_days: Mapped[int] = mapped_column(Integer, nullable=False, server_default="30")
    invoice_number_prefix: Mapped[str | None] = mapped_column(String(20), nullable=True)
    reminder_interval_days: Mapped[int] = mapped_column(Integer, nullable=False, server_default="7")
    onedrive_folder: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
