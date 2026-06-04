from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '85675e866311'
down_revision: Union[str, None] = '0005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade():
    op.create_table(
        "invoice_reminders",

        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True
        ),

        sa.Column(
            "invoice_id",
            sa.Integer(),
            nullable=False
        ),

        sa.Column(
            "reminder_date",
            sa.DateTime(),
            nullable=False
        ),

        sa.Column(
            "title",
            sa.String(length=255),
            nullable=False
        ),

        sa.Column(
            "sent",
            sa.Boolean(),
            nullable=False,
            server_default="0"
        ),

        sa.ForeignKeyConstraint(
            ["invoice_id"],
            ["invoices.id"]
        )
    )


def downgrade():
    op.drop_table("invoice_reminders")
