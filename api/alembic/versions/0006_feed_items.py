"""feed items table

Revision ID: 0006_feed_items
Revises: 0005_feed_versions
Create Date: 2024-09-19
"""

from alembic import op
import sqlalchemy as sa

revision = '0006_feed_items'
down_revision = '0005_feed_versions'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'feed_items',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('store_id', sa.Integer(), sa.ForeignKey('stores.id', ondelete='CASCADE'), nullable=False),
        sa.Column('feed_id', sa.Integer(), sa.ForeignKey('feeds.id', ondelete='CASCADE'), nullable=False),
        sa.Column('item_id', sa.String(length=128), nullable=False),
        sa.Column('title', sa.String(length=512)),
        sa.Column('link_canonical', sa.Text()),
        sa.Column('price_cents', sa.Integer()),
        sa.Column('sale_price_cents', sa.Integer()),
        sa.Column('currency', sa.String(length=8)),
        sa.Column('availability', sa.String(length=32)),
        sa.Column('brand', sa.String(length=128)),
        sa.Column('gtin', sa.String(length=64)),
        sa.Column('mpn', sa.String(length=128)),
        sa.Column('shipping_json', sa.Text()),
        sa.Column('raw_json', sa.Text()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('store_id','item_id', name='uq_feed_items_store_item'),
    )
    op.create_index('ix_feed_items_store_id', 'feed_items', ['store_id'])
    op.create_index('ix_feed_items_feed_id', 'feed_items', ['feed_id'])
    op.create_index('idx_feed_items_store_item', 'feed_items', ['store_id','item_id'], unique=True)


def downgrade() -> None:
    op.drop_index('idx_feed_items_store_item', table_name='feed_items')
    op.drop_index('ix_feed_items_feed_id', table_name='feed_items')
    op.drop_index('ix_feed_items_store_id', table_name='feed_items')
    op.drop_table('feed_items')
