"""add user locale

Revision ID: 0012_user_locale
Revises: 0011_store_google_merchant_id
Create Date: 2025-08-31 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0012_user_locale'
down_revision = '0011_store_google_merchant_id'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('locale', sa.String(length=10), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'locale')

