"""add ship_to_address and payment_terms to customers

Revision ID: f1a2b3c4d5e6
Revises: acce94ee7893
Create Date: 2026-06-11

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "acce94ee7893"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("customers", sa.Column("ship_to_address", sa.Text(), nullable=True))
    op.add_column("customers", sa.Column("payment_terms", sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column("customers", "payment_terms")
    op.drop_column("customers", "ship_to_address")
