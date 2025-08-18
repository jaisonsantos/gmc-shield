"""wordpress integration

Revision ID: 0004_wp_integration
Revises: 0003_scan_runs_snapshots
Create Date: 2024-08-30
"""
from alembic import op
import sqlalchemy as sa

revision = '0004_wp_integration'
down_revision = '0003_scan_runs_snapshots'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('stores', sa.Column('wp_api_base', sa.String(255)))
    op.add_column('stores', sa.Column('wp_base_url', sa.String(255)))
    op.add_column('stores', sa.Column('wp_user', sa.String(255)))
    op.add_column('stores', sa.Column('wp_app_password_enc', sa.Text()))
    op.add_column('stores', sa.Column('wp_last_status_at', sa.DateTime(timezone=True)))
    op.add_column('stores', sa.Column('wp_last_block_sync_at', sa.DateTime(timezone=True)))
    op.add_column('stores', sa.Column('wp_last_block_synced', sa.Integer()))
    op.create_index('idx_stores_wp_api_base', 'stores', ['wp_api_base'])

    op.create_table(
        'wp_policy_bindings',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('store_id', sa.Integer(), sa.ForeignKey('stores.id', ondelete='CASCADE'), nullable=False),
        sa.Column('policy_type', sa.String(32), nullable=False),
        sa.Column('page_id', sa.Integer(), nullable=False),
        sa.Column('page_url', sa.String(512), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('published_at', sa.DateTime(timezone=True)),
        sa.Column('content_hash', sa.String(64)),
        sa.UniqueConstraint('store_id', 'policy_type')
    )
    op.create_index('ix_wp_policy_bindings_store', 'wp_policy_bindings', ['store_id'])


def downgrade() -> None:
    op.drop_index('ix_wp_policy_bindings_store', table_name='wp_policy_bindings')
    op.drop_table('wp_policy_bindings')

    op.drop_index('idx_stores_wp_api_base', table_name='stores')
    op.drop_column('stores', 'wp_last_block_synced')
    op.drop_column('stores', 'wp_last_block_sync_at')
    op.drop_column('stores', 'wp_last_status_at')
    op.drop_column('stores', 'wp_app_password_enc')
    op.drop_column('stores', 'wp_user')
    op.drop_column('stores', 'wp_base_url')
    op.drop_column('stores', 'wp_api_base')
