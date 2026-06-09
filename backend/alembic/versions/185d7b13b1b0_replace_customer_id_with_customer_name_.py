"""replace customer_id with customer_name on invoices

Revision ID: 185d7b13b1b0
Revises: 51c9ee5b2953
Create Date: 2026-06-09 07:09:17.553345

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '185d7b13b1b0'
down_revision: Union[str, None] = '51c9ee5b2953'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'fk_invoices_customer_id'
                AND table_name = 'invoices'
            ) THEN
                ALTER TABLE invoices DROP CONSTRAINT fk_invoices_customer_id;
            END IF;
        END $$;
    """)
    op.drop_column('invoices', 'customer_id')
    op.add_column('invoices', sa.Column('customer_name', sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column('invoices', 'customer_name')
    op.add_column('invoices', sa.Column('customer_id', sa.INTEGER(), nullable=True))
