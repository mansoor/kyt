"""User management, notifications & per-user alerts.

Revision ID: 004
Revises: 003
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── users: profile + theme + forced password change ─────────────────────────
    op.add_column("users", sa.Column("display_name", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("theme", sa.String(10), nullable=False, server_default="system"))
    op.add_column("users", sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default="false"))

    # ── settings: global SMTP relay ─────────────────────────────────────────────
    op.add_column("settings", sa.Column("smtp_host", sa.String(255), nullable=True))
    op.add_column("settings", sa.Column("smtp_port", sa.Integer(), nullable=True))
    op.add_column("settings", sa.Column("smtp_username", sa.String(255), nullable=True))
    op.add_column("settings", sa.Column("smtp_password_enc", sa.Text(), nullable=True))
    op.add_column("settings", sa.Column("smtp_from", sa.String(255), nullable=True))
    op.add_column("settings", sa.Column("smtp_use_tls", sa.Boolean(), nullable=False, server_default="true"))

    # ── invites ─────────────────────────────────────────────────────────────────
    op.create_table(
        "invites",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("token", sa.String(128), nullable=False, unique=True),
        sa.Column("is_superuser", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("invited_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_invites_email", "invites", ["email"])
    op.create_index("ix_invites_token", "invites", ["token"])

    # ── notification_channels ───────────────────────────────────────────────────
    op.create_table(
        "notification_channels",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False, server_default="email"),
        sa.Column("target", sa.Text(), nullable=True),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_notification_channels_user_id", "notification_channels", ["user_id"])

    # ── alert_rules ─────────────────────────────────────────────────────────────
    op.create_table(
        "alert_rules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("car_id", sa.Integer(), sa.ForeignKey("cars.id", ondelete="CASCADE"), nullable=True),
        sa.Column("type", sa.String(40), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("params", JSONB, nullable=False, server_default="{}"),
        sa.Column("last_fired_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_alert_rules_user_id", "alert_rules", ["user_id"])

    # ── alert_events (delivery log / dedup) ─────────────────────────────────────
    op.create_table(
        "alert_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("alert_rule_id", UUID(as_uuid=True), sa.ForeignKey("alert_rules.id", ondelete="CASCADE"), nullable=True),
        sa.Column("car_id", sa.Integer(), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("delivered", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_alert_events_alert_rule_id", "alert_events", ["alert_rule_id"])


def downgrade() -> None:
    op.drop_table("alert_events")
    op.drop_table("alert_rules")
    op.drop_table("notification_channels")
    op.drop_table("invites")
    for col in ("smtp_use_tls", "smtp_from", "smtp_password_enc", "smtp_username", "smtp_port", "smtp_host"):
        op.drop_column("settings", col)
    for col in ("must_change_password", "theme", "display_name"):
        op.drop_column("users", col)
