"""Slack "break is over" reminder: sent marker and per-user opt-out.

Revision ID: 183_add_break_reminder_sent_at
Revises: 182_add_auto_clock_out
"""

import sqlalchemy as sa
from alembic import op

revision = "183_add_break_reminder_sent_at"
down_revision = "182_add_auto_clock_out"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("time_entries")}
    if "break_reminder_sent_at" not in columns:
        op.add_column("time_entries", sa.Column("break_reminder_sent_at", sa.DateTime(), nullable=True))
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "slack_break_reminder_enabled" not in user_columns:
        op.add_column(
            "users",
            sa.Column("slack_break_reminder_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        )


def downgrade():
    inspector = sa.inspect(op.get_bind())
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "slack_break_reminder_enabled" in user_columns:
        with op.batch_alter_table("users") as batch:
            batch.drop_column("slack_break_reminder_enabled")
    columns = {column["name"] for column in inspector.get_columns("time_entries")}
    if "break_reminder_sent_at" in columns:
        with op.batch_alter_table("time_entries") as batch:
            batch.drop_column("break_reminder_sent_at")
