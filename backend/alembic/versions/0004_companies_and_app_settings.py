"""Companies, app settings, user company_id

Revision ID: 0004
Revises: 0003
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("legal_name", sa.String(255), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("address", sa.Text, nullable=True),
        sa.Column("tax_id", sa.String(100), nullable=True),
        sa.Column("website", sa.String(255), nullable=True),
        sa.Column("default_currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "app_settings",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("organization_name", sa.String(255), nullable=False, server_default="Qrestik"),
        sa.Column("organization_email", sa.String(255), nullable=True),
        sa.Column("business_address", sa.Text, nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("website", sa.String(255), nullable=True),
        sa.Column("tax_id", sa.String(100), nullable=True),
        sa.Column("from_email", sa.String(255), nullable=True),
        sa.Column("reply_to_email", sa.String(255), nullable=True),
        sa.Column("milestone_alert_emails", sa.Text, nullable=True),
        sa.Column("default_currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("default_payment_terms_days", sa.Integer, nullable=False, server_default="30"),
        sa.Column("invoice_number_prefix", sa.String(20), nullable=True),
        sa.Column("reminder_interval_days", sa.Integer, nullable=False, server_default="7"),
        sa.Column("onedrive_folder", sa.String(255), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.execute(sa.text("INSERT INTO app_settings (id, organization_name) VALUES (1, 'Qrestik')"))

    op.add_column("users", sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id"), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "company_id")
    op.drop_table("app_settings")
    op.drop_table("companies")
