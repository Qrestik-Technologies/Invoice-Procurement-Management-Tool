"""Initial schema: users, customers, invoices, milestones, payments, reminders, documents, audit_logs

Revision ID: 0003
Revises: 0002
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

invoice_status = sa.Enum(
    "draft", "sent", "received", "overdue", "paid", "cancelled",
    name="invoicestatus",
)
milestone_status = sa.Enum(
    "pending", "in_progress", "completed", "cancelled",
    name="milestonestatus",
)
audit_action = sa.Enum(
    "created", "updated", "deleted", "status_changed", "exported", "synced",
    name="auditaction",
)


def upgrade() -> None:
    # ── customers ─────────────────────────────────────────────────────────────
    op.create_table(
        "customers",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("address", sa.Text, nullable=True),
        sa.Column("tax_id", sa.String(100), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(),
                  onupdate=sa.func.now()),
    )

    # ── invoices ──────────────────────────────────────────────────────────────
    op.create_table(
        "invoices",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("invoice_number", sa.String(100), unique=True, nullable=False, index=True),
        sa.Column("customer_id", sa.Integer, sa.ForeignKey("customers.id"), nullable=False),
        sa.Column("uploaded_by", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", invoice_status, nullable=False, server_default="draft"),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("issue_date", sa.Date, nullable=False),
        sa.Column("due_date", sa.Date, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("file_path", sa.String(500), nullable=True),
        sa.Column("onedrive_item_id", sa.String(255), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── milestones ────────────────────────────────────────────────────────────
    op.create_table(
        "milestones",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("invoice_id", sa.Integer, sa.ForeignKey("invoices.id"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("due_date", sa.Date, nullable=True),
        sa.Column("amount", sa.Numeric(18, 2), nullable=True),
        sa.Column("status", milestone_status, nullable=False, server_default="pending"),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── payments ──────────────────────────────────────────────────────────────
    op.create_table(
        "payments",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("invoice_id", sa.Integer, sa.ForeignKey("invoices.id"), nullable=False),
        sa.Column("marked_by", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── reminders ─────────────────────────────────────────────────────────────
    op.create_table(
        "reminders",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("invoice_id", sa.Integer, sa.ForeignKey("invoices.id"), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("message", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── documents ─────────────────────────────────────────────────────────────
    op.create_table(
        "documents",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("uploaded_by", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("invoice_id", sa.Integer, sa.ForeignKey("invoices.id"), nullable=True),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=True),
        sa.Column("size_bytes", sa.Integer, nullable=True),
        sa.Column("onedrive_item_id", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── audit_logs ────────────────────────────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("changed_by", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("entity_type", sa.String(100), nullable=False),
        sa.Column("entity_id", sa.Integer, nullable=False),
        sa.Column("action", audit_action, nullable=False),
        sa.Column("detail", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Fix users.is_active default: new registrations must start inactive
    op.alter_column("users", "is_active", server_default=sa.false())


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("documents")
    op.drop_table("reminders")
    op.drop_table("payments")
    op.drop_table("milestones")
    op.drop_table("invoices")
    op.drop_table("customers")
    invoice_status.drop(op.get_bind())
    milestone_status.drop(op.get_bind())
    audit_action.drop(op.get_bind())
