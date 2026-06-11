"""Scope customers/invoices to companies; seed default organizations

Revision ID: 0005
Revises: 0004
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("customers", sa.Column("company_id", sa.Integer(), nullable=True))
    op.add_column("invoices", sa.Column("company_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_customers_company_id", "customers", "companies", ["company_id"], ["id"])
    op.create_foreign_key("fk_invoices_company_id", "invoices", "companies", ["company_id"], ["id"])

    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            INSERT INTO companies (name, legal_name, is_active, default_currency)
            SELECT v.name, v.legal_name, true, 'USD'
            FROM (VALUES
                ('Infinitum Global', 'Infinitum Global'),
                ('Qrestik Technologies', 'Qrestik Technologies')
            ) AS v(name, legal_name)
            WHERE NOT EXISTS (
                SELECT 1 FROM companies c WHERE c.name = v.name
            )
            """
        )
    )

    default_id = conn.execute(sa.text("SELECT id FROM companies ORDER BY id LIMIT 1")).scalar()
    if default_id:
        conn.execute(
            sa.text("UPDATE customers SET company_id = :cid WHERE company_id IS NULL"),
            {"cid": default_id},
        )
        conn.execute(
            sa.text("UPDATE invoices SET company_id = :cid WHERE company_id IS NULL"),
            {"cid": default_id},
        )

    op.alter_column("customers", "company_id", nullable=False)
    op.alter_column("invoices", "company_id", nullable=False)

    op.drop_index("ix_invoices_invoice_number", table_name="invoices")
    op.create_index(
        "uq_invoices_company_invoice_number",
        "invoices",
        ["company_id", "invoice_number"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_invoices_company_invoice_number", table_name="invoices")
    op.create_index("ix_invoices_invoice_number", "invoices", ["invoice_number"], unique=True)
    op.drop_constraint("fk_invoices_company_id", "invoices", type_="foreignkey")
    op.drop_constraint("fk_customers_company_id", "customers", type_="foreignkey")
    op.drop_column("invoices", "company_id")
    op.drop_column("customers", "company_id")
