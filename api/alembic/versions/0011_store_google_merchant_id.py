from alembic import op
import sqlalchemy as sa

revision = '0011_store_google_merchant_id'
down_revision = '0010_google_accounts'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('stores', sa.Column('google_merchant_id', sa.String(length=64)))


def downgrade():
    op.drop_column('stores', 'google_merchant_id')
