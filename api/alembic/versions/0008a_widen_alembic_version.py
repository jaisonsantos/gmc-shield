"""widen alembic_version.version_num to 128 chars

Revision ID: 0008a_widen_av
Revises: 0008_feed_versions_content_hash
Create Date: 2025-08-28
"""

from alembic import op


revision = "0008a_widen_av"
down_revision = "0008_feed_versions_content_hash"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Some environments create alembic_version with VARCHAR(32) by default.
    # Our later revision IDs exceed 32 chars. Widen it proactively.
    op.execute("ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(128);")


def downgrade() -> None:
    # Revert to the default width.
    op.execute("ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(32);")

