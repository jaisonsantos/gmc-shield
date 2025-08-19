"""feed versions table

Revision ID: 0005_feed_versions
Revises: 0004_wp_integration
Create Date: 2024-09-19
"""

from alembic import op
import sqlalchemy as sa

revision = '0005_feed_versions'
down_revision = '0004_wp_integration'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'feed_versions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('feed_id', sa.Integer(), sa.ForeignKey('feeds.id', ondelete='CASCADE'), nullable=False),
        sa.Column('hash', sa.String(128), nullable=False),
        sa.Column('items_count', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('idx_feed_versions_feed_created', 'feed_versions', ['feed_id', 'created_at'])


def downgrade() -> None:
    op.drop_index('idx_feed_versions_feed_created', table_name='feed_versions')
    op.drop_table('feed_versions')
