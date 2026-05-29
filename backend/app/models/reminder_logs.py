from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import ReminderStatus, ReminderType


class ReminderLog(Base):
    __tablename__ = "reminder_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"), nullable=False, index=True)
    reminder_type: Mapped[ReminderType] = mapped_column(Enum(ReminderType), nullable=False)
    recipient_email: Mapped[str] = mapped_column(String(255), nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    status: Mapped[ReminderStatus] = mapped_column(Enum(ReminderStatus), nullable=False)
    celery_task_id: Mapped[str | None] = mapped_column(String(255))

    invoice = relationship("Invoice", back_populates="reminder_logs")
