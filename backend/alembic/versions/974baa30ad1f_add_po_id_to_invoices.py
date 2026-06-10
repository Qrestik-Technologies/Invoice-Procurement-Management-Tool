"""add_po_id_to_invoices

Revision ID: 974baa30ad1f
Revises: ea04b7e53bb0
Create Date: 2026-06-10

"""
from alembic import op
import sqlalchemy as sa

revision = '974baa30ad1f'
down_revision = 'ea04b7e53bb0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('invoices', sa.Column('po_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_invoices_po_id'), 'invoices', ['po_id'], unique=False)
    op.create_foreign_key(None, 'invoices', 'purchase_orders', ['po_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint(None, 'invoices', type_='foreignkey')
    op.drop_index(op.f('ix_invoices_po_id'), table_name='invoices')
    op.drop_column('invoices', 'po_id')
