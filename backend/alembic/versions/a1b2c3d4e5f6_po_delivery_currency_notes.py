"""add delivery_date, currency, notes to purchase_orders

Revision ID: a1b2c3d4e5f6
Revises: 974baa30ad1f
Create Date: 2026-06-11
"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = "974baa30ad1f"
branch_labels = None
depends_on = None

def upgrade():
    with op.batch_alter_table('purchase_orders') as batch_op:
        batch_op.add_column(sa.Column('delivery_date', sa.Date(), nullable=True))
        batch_op.add_column(sa.Column('currency', sa.String(10), nullable=True, server_default='AED'))
        batch_op.add_column(sa.Column('notes', sa.Text(), nullable=True))

def downgrade():
    with op.batch_alter_table('purchase_orders') as batch_op:
        batch_op.drop_column('notes')
        batch_op.drop_column('currency')
        batch_op.drop_column('delivery_date')
