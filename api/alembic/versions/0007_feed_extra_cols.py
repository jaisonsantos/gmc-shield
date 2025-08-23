"""feed extra cols

Revision ID: 0007_feed_extra_cols
Revises: 0006_feed_items
Create Date: 2024-09-20
"""

from alembic import op
import sqlalchemy as sa

revision = '0007_feed_extra_cols'
down_revision = '0006_feed_items'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('feeds', sa.Column('last_item_count', sa.Integer(), nullable=True))
    op.add_column('feeds', sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False))


def downgrade() -> None:
    op.drop_column('feeds', 'created_at')
    op.drop_column('feeds', 'last_item_count')
