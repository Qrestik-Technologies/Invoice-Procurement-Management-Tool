from datetime import date, datetime
from decimal import Decimal
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import AuditAction, InvoiceStatus, MilestoneStatus, UserRole

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    success: bool = True
    data: T | None = None
    message: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str


class ResendCodeRequest(BaseModel):
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str = Field(min_length=6)


class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: UserRole
    is_active: bool = True
    company_id: int | None = None


class UserCreate(UserBase):
    password: str = Field(min_length=6)


class UserUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    company_id: int | None = None
    password: str | None = Field(default=None, min_length=6)


class UserRead(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


class CompanyBase(BaseModel):
    name: str
    legal_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    tax_id: str | None = None
    website: str | None = None
    default_currency: str = "USD"
    is_active: bool = True
    notes: str | None = None


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseModel):
    name: str | None = None
    legal_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    tax_id: str | None = None
    website: str | None = None
    default_currency: str | None = None
    is_active: bool | None = None
    notes: str | None = None


class CompanyRead(CompanyBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime


class AppSettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    organization_name: str
    organization_email: str | None = None
    business_address: str | None = None
    phone: str | None = None
    website: str | None = None
    tax_id: str | None = None
    from_email: str | None = None
    reply_to_email: str | None = None
    milestone_alert_emails: str | None = None
    default_currency: str
    default_payment_terms_days: int
    invoice_number_prefix: str | None = None
    reminder_interval_days: int
    onedrive_folder: str | None = None
    updated_at: datetime | None = None


class OrganizationSettingsUpdate(BaseModel):
    organization_name: str | None = None
    organization_email: EmailStr | None = None
    business_address: str | None = None
    phone: str | None = None
    website: str | None = None
    tax_id: str | None = None


class EmailSettingsUpdate(BaseModel):
    from_email: EmailStr | None = None
    reply_to_email: EmailStr | None = None
    milestone_alert_emails: str | None = None


class InvoiceDefaultsUpdate(BaseModel):
    default_currency: str | None = None
    default_payment_terms_days: int | None = Field(default=None, ge=1, le=365)
    invoice_number_prefix: str | None = None
    reminder_interval_days: int | None = Field(default=None, ge=1, le=90)
    onedrive_folder: str | None = None


class IntegrationsStatus(BaseModel):
    sendgrid_configured: bool
    onedrive_configured: bool
    sendgrid_from_env: str | None = None
    onedrive_folder_env: str | None = None


class SettingsBundle(BaseModel):
    settings: AppSettingsRead
    integrations: IntegrationsStatus


class CustomerBase(BaseModel):
    company_id: int | None = None
    name: str
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    tax_id: str | None = None
    notes: str | None = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    tax_id: str | None = None
    notes: str | None = None


class CustomerRead(CustomerBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    company_id: int
    created_at: datetime
    updated_at: datetime


class InvoiceBase(BaseModel):
    company_id: int | None = None
    invoice_number: str
    status: InvoiceStatus = InvoiceStatus.draft
    amount: Decimal
    currency: str = "USD"
    issue_date: date
    due_date: date
    customer_name: str | None = None
    description: str | None = None


class InvoiceCreate(InvoiceBase):
    pass


class InvoiceUpdate(BaseModel):
    invoice_number: str | None = None
    status: InvoiceStatus | None = None
    amount: Decimal | None = None
    currency: str | None = None
    issue_date: date | None = None
    due_date: date | None = None
    customer_name: str | None = None
    description: str | None = None
    file_path: str | None = None
    onedrive_item_id: str | None = None
    received_at: datetime | None = None


class InvoiceRead(InvoiceBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    company_id: int
    uploaded_by: int
    file_path: str | None = None
    onedrive_item_id: str | None = None
    received_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class MilestoneBase(BaseModel):
    invoice_id: int
    title: str
    customer_name: str | None = None
    description: str | None = None
    due_date: date | None = None
    amount: Decimal | None = None
    status: MilestoneStatus = MilestoneStatus.pending


class MilestoneCreate(MilestoneBase):
    pass


class MilestoneUpdate(BaseModel):
    title: str | None = None
    customer_name: str | None = None
    description: str | None = None
    due_date: date | None = None
    amount: Decimal | None = None
    status: MilestoneStatus | None = None
    completed_at: datetime | None = None


class MilestoneRead(MilestoneBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class PaymentCreate(BaseModel):
    invoice_id: int
    amount: Decimal
    currency: str = "USD"
    paid_at: datetime
    notes: str | None = None


class PaymentRead(PaymentCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    marked_by: int
    created_at: datetime


class ReminderCreate(BaseModel):
    scheduled_at: datetime
    message: str | None = None


class ReminderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    invoice_id: int
    scheduled_at: datetime
    sent_at: datetime | None = None
    message: str | None = None
    created_at: datetime


class CashFlowSummary(BaseModel):
    period_start: date
    period_end: date
    total_invoiced: Decimal
    total_received: Decimal
    total_outstanding: Decimal
    overdue_count: int
    paid_count: int
    draft_count: int
    currency: str


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    changed_by: int
    entity_type: str
    entity_id: int
    action: AuditAction
    detail: str | None = None
    created_at: datetime


class HealthStatus(BaseModel):
    status: str
    database: str
    redis: str
    celery: str

class LineItemSchema(BaseModel):
    description: str
    qty: float = 1
    rate: float = 0
    amount: float = 0


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

    vendor: str | None = None
    vendor_name: str | None = None

    bank_account_number: str | None = None
    bank_routing: str | None = None
    bank_address: str | None = None

    bank_iban: str | None = None
    bank_swift: str | None = None
    bank_branch: str | None = None
    bill_to_po_box: str | None = None

    bank_name: str | None = None
    bank_fein: str | None = None
    bank_email: str | None = None
    ship_to_contact: str | None = None
    ship_to_company: str | None = None
    sku: str | None = None
    period_start: str | None = None
    period_end: str | None = None


class ParseUploadResponse(BaseModel):
    document_id: int
    parse_result: InvoiceParseSchema

class CashFlowSummary(BaseModel):
    period_start: date
    period_end: date
    total_invoiced: Decimal
    total_received: Decimal
    total_outstanding: Decimal
    overdue_count: int
    paid_count: int
    draft_count: int
    currency: str
    invoices: list[dict] = Field(default_factory=list)  # ← add this line
