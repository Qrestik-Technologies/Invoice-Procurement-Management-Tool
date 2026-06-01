"""add user email-verification / password-reset code columns

Revision ID: 0002
Revises: 0001
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("verification_code", sa.String(length=255), nullable=True))
    op.add_column(
        "users",
        sa.Column("verification_code_expires", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "verification_code_expires")
    op.drop_column("users", "verification_code")
