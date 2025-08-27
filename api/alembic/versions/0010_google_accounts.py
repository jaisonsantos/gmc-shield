"""add google accounts table

Revision ID: 0010_google_accounts
Revises: 0009_feed_versions_unique_constraint
Create Date: 2024-10-05
"""

from alembic import op
import sqlalchemy as sa


revision = "0010_google_accounts"
down_revision = "0009_feed_versions_unique_constraint"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "google_accounts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sub", sa.String(length=255), nullable=False, unique=True),
        sa.Column("email", sa.String(length=255)),
        sa.Column("name", sa.String(length=255)),
        sa.Column("picture", sa.Text()),
        sa.Column("access_token_enc", sa.Text()),
        sa.Column("refresh_token_enc", sa.Text()),
        sa.Column("token_expiry", sa.DateTime(timezone=True)),
        sa.Column("content_scope_granted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )
    op.create_index("ix_google_accounts_sub", "google_accounts", ["sub"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_google_accounts_sub", table_name="google_accounts")
    op.drop_table("google_accounts")

