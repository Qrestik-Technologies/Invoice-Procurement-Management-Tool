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

