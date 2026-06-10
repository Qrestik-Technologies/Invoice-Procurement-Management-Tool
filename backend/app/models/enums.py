import enum


class UserRole(str, enum.Enum):
    admin = "admin"
    entry = "entry"
    readonly = "readonly"


class InvoiceStatus(str, enum.Enum):
    draft = "draft"
    sent = "sent"
    received = "received"
    overdue = "overdue"
    paid = "paid"
    cancelled = "cancelled"


class MilestoneStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class AuditAction(str, enum.Enum):
    created = "created"
    updated = "updated"
    deleted = "deleted"
    status_changed = "status_changed"
    exported = "exported"
    synced = "synced"


class TemplateType(str, enum.Enum):
    email = "email"
    pdf = "pdf"
    reminder = "reminder"
    standard = "standard"

class AlertStatus(str, enum.Enum):
    on_track = "on_track"
    at_risk = "at_risk"
    delayed = "delayed"

class ReminderType(str, enum.Enum):
    payment_reminder    = "payment_reminder"
    milestone_alert     = "milestone_alert"
    po_expiry_warning   = "po_expiry_warning"
    po_not_invoiced     = "po_not_invoiced"

class ReminderStatus(str, enum.Enum):
    delivered = "delivered"
    failed = "failed"
class SyncStatus(str, enum.Enum):
    pending = "pending"
    synced = "synced"
    failed = "failed"
class POStatus(str, enum.Enum):
    draft              = "draft"
    active             = "active"
    invoiced           = "invoiced"
    partially_invoiced = "partially_invoiced"
    closed             = "closed"

class MilestoneSource(str, enum.Enum):
    manual       = "manual"
    po_generated = "po_generated"

class DocumentType(str, enum.Enum):
    invoice = "invoice"
    po      = "po"
    receipt = "receipt"
