from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = '0003_scan_runs_snapshots'
down_revision = '0002_unique_active_block'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'scan_runs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('store_id', sa.Integer(), sa.ForeignKey('stores.id', ondelete='CASCADE'), nullable=False),
        sa.Column('requested_by', sa.String(length=255)),
        sa.Column('started_at', sa.DateTime(timezone=True)),
        sa.Column('finished_at', sa.DateTime(timezone=True)),
        sa.Column('status', sa.String(length=16), nullable=False, server_default='queued'),
        sa.Column('items_total', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('items_ok', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('items_violation', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('error_text', sa.Text()),
    )
    op.create_index('ix_scan_runs_store_started', 'scan_runs', ['store_id', 'started_at'])
    op.create_index('ix_scan_runs_status', 'scan_runs', ['status'])

    op.create_table(
        'page_snapshots',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('store_id', sa.Integer(), sa.ForeignKey('stores.id', ondelete='CASCADE'), nullable=False),
        sa.Column('run_id', sa.Integer(), sa.ForeignKey('scan_runs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('feed_item_id', sa.String(length=128)),
        sa.Column('url', sa.Text()),
        sa.Column('fetched_at', sa.DateTime(timezone=True)),
        sa.Column('http_status', sa.Integer()),
        sa.Column('redirect_chain', JSONB),
        sa.Column('html_path', sa.String(length=512)),
        sa.Column('screenshot_path', sa.String(length=512)),
        sa.Column('extracted', JSONB),
    )
    op.create_index('ix_page_snapshots_store_run', 'page_snapshots', ['store_id', 'run_id'])
    op.create_index('ix_page_snapshots_feed_item', 'page_snapshots', ['feed_item_id'])

    op.add_column('violations', sa.Column('run_id', sa.Integer(), sa.ForeignKey('scan_runs.id', ondelete='SET NULL'), nullable=True))
    op.create_index('ix_violations_store_run', 'violations', ['store_id', 'run_id'])


def downgrade() -> None:
    op.drop_index('ix_violations_store_run', table_name='violations')
    op.drop_column('violations', 'run_id')

    op.drop_index('ix_page_snapshots_feed_item', table_name='page_snapshots')
    op.drop_index('ix_page_snapshots_store_run', table_name='page_snapshots')
    op.drop_table('page_snapshots')

    op.drop_index('ix_scan_runs_status', table_name='scan_runs')
    op.drop_index('ix_scan_runs_store_started', table_name='scan_runs')
    op.drop_table('scan_runs')
