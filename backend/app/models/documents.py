from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import DocumentType,  SyncStatus


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    onedrive_url: Mapped[str | None] = mapped_column(String(1000))
    linked_invoice_id: Mapped[int | None] = mapped_column(ForeignKey("invoices.id"), index=True)
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    sync_status: Mapped[SyncStatus] = mapped_column(
        Enum(SyncStatus), nullable=False, default=SyncStatus.pending
    )
    document_type: Mapped[DocumentType] = mapped_column(Enum(DocumentType), nullable=False, default=DocumentType.invoice)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    linked_invoice = relationship("Invoice", back_populates="documents")
    uploader = relationship("User", back_populates="documents")
