"""Add investigation cases

Revision ID: c1a516f709f9
Revises: 7569ef061300
Create Date: 2026-08-15 18:58:54.754286

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c1a516f709f9"
down_revision: Union[str, Sequence[str], None] = "7569ef061300"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    op.create_table(
        "cases",
        sa.Column(
            "id",
            sa.Uuid(),
            nullable=False,
        ),
        sa.Column(
            "title",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.String(length=30),
            nullable=False,
        ),
        sa.Column(
            "priority",
            sa.String(length=20),
            nullable=False,
        ),
        sa.Column(
            "assigned_analyst",
            sa.String(length=255),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.add_column(
        "alerts",
        sa.Column(
            "case_id",
            sa.Uuid(),
            nullable=True,
        ),
    )

    op.create_foreign_key(
        "fk_alerts_case_id_cases",
        "alerts",
        "cases",
        ["case_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_constraint(
        "fk_alerts_case_id_cases",
        "alerts",
        type_="foreignkey",
    )

    op.drop_column(
        "alerts",
        "case_id",
    )

    op.drop_table(
        "cases",
    )