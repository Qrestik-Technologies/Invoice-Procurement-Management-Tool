"""Normalize all currency fields to USD

Revision ID: h3c4d5e6f7g8
Revises: g2b3c4d5e6f7
Create Date: 2026-06-11

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "h3c4d5e6f7g8"
down_revision: Union[str, None] = "g2b3c4d5e6f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    for table in ("invoices", "payments", "purchase_orders"):
        conn.execute(
            sa.text(
                f"UPDATE {table} SET currency = 'USD' WHERE currency IS NOT NULL AND currency <> 'USD'"
            )
        )
    conn.execute(
        sa.text(
            "UPDATE companies SET default_currency = 'USD' WHERE default_currency IS NOT NULL AND default_currency <> 'USD'"
        )
    )
    conn.execute(
        sa.text(
            "UPDATE app_settings SET default_currency = 'USD' WHERE default_currency IS NOT NULL AND default_currency <> 'USD'"
        )
    )


def downgrade() -> None:
    pass
