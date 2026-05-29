import enum


class UserRole(str, enum.Enum):
    admin = "admin"
    entry = "entry"
    readonly = "readonly"


class TemplateType(str, enum.Enum):
    standard = "standard"
    emcor = "emcor"


class InvoiceStatus(str, enum.Enum):
    draft = "draft"
    reviewed = "reviewed"
    dispatched = "dispatched"
    pending = "pending"
    received = "received"
    overdue = "overdue"


class AlertStatus(str, enum.Enum):
    on_track = "on_track"
    due_soon = "due_soon"
    overdue = "overdue"


class ReminderType(str, enum.Enum):
    milestone_alert = "milestone_alert"
    payment_reminder = "payment_reminder"
    overdue = "overdue"


class ReminderStatus(str, enum.Enum):
    delivered = "delivered"
    failed = "failed"


class SyncStatus(str, enum.Enum):
    pending = "pending"
    synced = "synced"
    failed = "failed"
