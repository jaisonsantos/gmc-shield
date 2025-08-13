# api/alembic/versions/0001_init.py

from alembic import op
import sqlalchemy as sa

revision = '0001_init'
down_revision = None

def upgrade():
    op.create_table('accounts',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('type', sa.String(32), nullable=False),
        sa.Column('stripe_customer_id', sa.String(255)),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now(), nullable=False),
    )
    op.create_table('users',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('account_id', sa.Integer, sa.ForeignKey('accounts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('role', sa.String(32), nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now(), nullable=False),
    )
    op.create_table('stores',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('account_id', sa.Integer, sa.ForeignKey('accounts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('platform', sa.String(32), nullable=False),
        sa.Column('base_url', sa.String(255), nullable=False),
        sa.Column('country', sa.String(32)),
        sa.Column('currency', sa.String(16)),
        sa.Column('contact_email', sa.String(255)),
        sa.Column('whitelist_ip', sa.String(255)),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now(), nullable=False),
    )
    op.create_table('feeds',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('store_id', sa.Integer, sa.ForeignKey('stores.id', ondelete='CASCADE'), nullable=False),
        sa.Column('source_type', sa.String(16), nullable=False),
        sa.Column('url', sa.String(512)),
        sa.Column('format', sa.String(8), nullable=False),
        sa.Column('last_hash', sa.String(128)),
        sa.Column('last_parsed_at', sa.DateTime),
    )
    op.create_table('violations',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('store_id', sa.Integer, sa.ForeignKey('stores.id', ondelete='CASCADE'), nullable=False),
        sa.Column('feed_item_id', sa.String(128)),
        sa.Column('rule_code', sa.String(16), nullable=False),
        sa.Column('severity', sa.String(16), nullable=False),
        sa.Column('message', sa.Text, nullable=False),
        sa.Column('status', sa.String(16), server_default='open', nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column('fixed_at', sa.DateTime),
    )
    op.create_table('blocks',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('store_id', sa.Integer, sa.ForeignKey('stores.id', ondelete='CASCADE'), nullable=False),
        sa.Column('feed_item_id', sa.String(128), nullable=False),
        sa.Column('reason', sa.String(255)),
        sa.Column('active', sa.Boolean, server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column('deactivated_at', sa.DateTime),
    )
def downgrade():
    op.drop_table('blocks'); 
    op.drop_table('violations'); 
    op.drop_table('feeds'); 
    op.drop_table('stores'); 
    op.drop_table('users'); 
    op.drop_table('accounts')
