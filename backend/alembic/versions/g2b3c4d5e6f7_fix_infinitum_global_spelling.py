"""Fix Inginitum Global -> Infinitum Global spelling

Revision ID: g2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-06-11

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "g2b3c4d5e6f7"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            UPDATE companies
            SET name = 'Infinitum Global', legal_name = 'Infinitum Global'
            WHERE name = 'Inginitum Global' OR legal_name = 'Inginitum Global'
            """
        )
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            UPDATE companies
            SET name = 'Inginitum Global', legal_name = 'Inginitum Global'
            WHERE name = 'Infinitum Global' AND legal_name = 'Infinitum Global'
            """
        )
    )
