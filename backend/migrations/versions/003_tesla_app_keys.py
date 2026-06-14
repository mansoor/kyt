"""Add tesla app key columns to settings table."""
import sqlalchemy as sa
from alembic import op

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("settings", sa.Column("tesla_public_key", sa.Text(), nullable=True))
    op.add_column("settings", sa.Column("tesla_private_key_enc", sa.Text(), nullable=True))
    op.add_column("settings", sa.Column("tesla_registered", sa.Boolean(), nullable=False, server_default="false"))


def downgrade() -> None:
    op.drop_column("settings", "tesla_registered")
    op.drop_column("settings", "tesla_private_key_enc")
    op.drop_column("settings", "tesla_public_key")
