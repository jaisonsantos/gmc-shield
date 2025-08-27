"""add unique constraint for feed versions content_hash

Revision ID: 0009_feed_versions_unique_constraint
Revises: 0008_feed_versions_content_hash
Create Date: 2024-09-20
"""

from alembic import op

revision = '0009_feed_versions_unique_constraint'
down_revision = '0008_feed_versions_content_hash'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_unique_constraint(
        'uq_feed_versions_feed_content_hash',
        'feed_versions',
        ['feed_id', 'content_hash'],
    )


def downgrade() -> None:
    op.drop_constraint(
        'uq_feed_versions_feed_content_hash',
        'feed_versions',
        type_='unique',
    )
