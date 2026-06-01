from datetime import date, datetime
from decimal import Decimal
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import (
    AlertStatus,
    InvoiceStatus,
    ReminderStatus,
    ReminderType,
    SyncStatus,
    TemplateType,
    UserRole,
)

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    success: bool = True
    data: T | None = None
    message: str | None = None
    pagination: "PaginationMeta | None" = None


class PaginationMeta(BaseModel):
    total: int
    page: int
    page_size: int
    pages: int


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: UserRole
    is_active: bool = True


class UserCreate(UserBase):
    password: str = Field(min_length=6)


class UserUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=6)


class UserRead(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


class CustomerBase(BaseModel):
    name: str
    email: EmailStr
    phone: str | None = None
    address: str | None = None
    template_type: TemplateType = TemplateType.standard
    ship_to_address: str | None = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    template_type: TemplateType | None = None
    ship_to_address: str | None = None


class CustomerRead(CustomerBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    total_invoiced: float = 0


class MilestoneBase(BaseModel):
    project_name: str
    customer_id: int
    start_date: date
    end_date: date
    alert_status: AlertStatus = AlertStatus.on_track
    notes: str | None = None


class MilestoneCreate(MilestoneBase):
    pass


class MilestoneUpdate(BaseModel):
    project_name: str | None = None
    customer_id: int | None = None
    start_date: date | None = None
    end_date: date | None = None
    alert_status: AlertStatus | None = None
    notes: str | None = None


class MilestoneRead(MilestoneBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    linked_invoice_number: str | None = None


class LineItemSchema(BaseModel):
    description: str
    qty: float = 1
    rate: float = 0
    amount: float = 0


class InvoiceBase(BaseModel):
    customer_id: int
    milestone_id: int | None = None
    invoice_date: date
    line_items: list[LineItemSchema] = Field(default_factory=list)
    subtotal: Decimal = Decimal("0")
    tax: Decimal = Decimal("0")
    total: Decimal = Decimal("0")
    currency: str = "USD"
    payment_terms: str | None = "Net 30"
    po_number: str | None = None
    bill_to_address: str | None = None
    ship_to_address: str | None = None
    notes: str | None = None


class InvoiceCreate(InvoiceBase):
    invoice_number: str | None = None
    status: InvoiceStatus = InvoiceStatus.draft


class InvoiceUpdate(BaseModel):
    customer_id: int | None = None
    milestone_id: int | None = None
    invoice_date: date | None = None
    line_items: list[LineItemSchema] | None = None
    subtotal: Decimal | None = None
    tax: Decimal | None = None
    total: Decimal | None = None
    currency: str | None = None
    status: InvoiceStatus | None = None
    payment_terms: str | None = None
    po_number: str | None = None
    bill_to_address: str | None = None
    ship_to_address: str | None = None
    notes: str | None = None


class InvoiceRead(InvoiceBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    invoice_number: str
    status: InvoiceStatus
    has_pdf: bool = False
    onedrive_url: str | None = None
    uploaded_by: int | None = None
    created_at: datetime
    updated_at: datetime
    customer_name: str | None = None
    milestone_name: str | None = None
    due_date: date | None = None


class MarkReceivedRequest(BaseModel):
    received_date: date
    amount: Decimal
    notes: str | None = None


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    filename: str
    onedrive_url: str | None = None
    linked_invoice_id: int | None = None
    uploaded_by: int
    sync_status: SyncStatus
    created_at: datetime
    uploader_name: str | None = None
    linked_invoice_number: str | None = None


class ReminderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    invoice_id: int
    reminder_type: ReminderType
    recipient_email: str
    sent_at: datetime
    status: ReminderStatus
    invoice_number: str | None = None
    customer_name: str | None = None


class CashFlowMonth(BaseModel):
    month: str
    expected: float
    received: float


class CashFlowSummary(BaseModel):
    monthly: list[CashFlowMonth]
    invoices: list[dict[str, Any]]


class InvoiceParseSchema(BaseModel):
    invoice_number: str | None = None
    invoice_date: date | None = None
    po_number: str | None = None
    customer_name: str | None = None
    bill_to_address: str | None = None
    ship_to_address: str | None = None
    subtotal: float | None = None
    tax: float | None = None
    total: float | None = None
    currency: str | None = "USD"
    line_items: list[LineItemSchema] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)
    raw_text_length: int = 0


class ParseUploadResponse(BaseModel):
    document_id: int
    parse_result: InvoiceParseSchema
