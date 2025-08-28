"""widen alembic_version.version_num to 128 chars

Revision ID: 0008a_widen_av
Revises: 0008_feed_versions_content_hash
Create Date: 2025-08-28
"""

from alembic import op
import sqlalchemy as sa


revision = "0008a_widen_av"
down_revision = "0008_feed_versions_content_hash"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Some environments create alembic_version with VARCHAR(32) by default.
    # Our later revision IDs exceed 32 chars. Widen it proactively.
    dialect = op.get_context().dialect.name
    if dialect == "sqlite":
        with op.batch_alter_table("alembic_version") as batch_op:
            batch_op.alter_column(
                "version_num",
                existing_type=sa.String(length=32),
                type_=sa.String(length=128),
                existing_nullable=False,
            )
    else:
        op.alter_column(
            "alembic_version",
            "version_num",
            existing_type=sa.String(length=32),
            type_=sa.String(length=128),
            existing_nullable=False,
        )


def downgrade() -> None:
    # Revert to the default width.
    dialect = op.get_context().dialect.name
    if dialect == "sqlite":
        with op.batch_alter_table("alembic_version") as batch_op:
            batch_op.alter_column(
                "version_num",
                existing_type=sa.String(length=128),
                type_=sa.String(length=32),
                existing_nullable=False,
            )
    else:
        op.alter_column(
            "alembic_version",
            "version_num",
            existing_type=sa.String(length=128),
            type_=sa.String(length=32),
            existing_nullable=False,
        )

