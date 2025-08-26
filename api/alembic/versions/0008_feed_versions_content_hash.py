"""rename hash to content_hash on feed_versions

Revision ID: 0008_feed_versions_content_hash
Revises: 0007_feed_extra_cols
Create Date: 2024-10-??
"""

from alembic import op
import sqlalchemy as sa

revision = '0008_feed_versions_content_hash'
down_revision = '0007_feed_extra_cols'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('feed_versions') as batch:
        batch.alter_column('hash', new_column_name='content_hash')


def downgrade() -> None:
    with op.batch_alter_table('feed_versions') as batch:
        batch.alter_column('content_hash', new_column_name='hash')
