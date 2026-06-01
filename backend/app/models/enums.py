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

