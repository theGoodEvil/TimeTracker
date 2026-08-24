"""Remove donation prompts, supporter licensing, and interaction tracking.

Revision ID: 177_remove_donation_feature
Revises: 176_eviltime_unified_tracking
"""

import sqlalchemy as sa
from alembic import op


revision = "177_remove_donation_feature"
down_revision = "176_eviltime_unified_tracking"
branch_labels = None
depends_on = None


def _columns(inspector, table_name):
    if table_name not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "donation_interactions" in inspector.get_table_names():
        op.drop_table("donation_interactions")

    user_columns = _columns(sa.inspect(bind), "users")
    obsolete_user_columns = [
        name for name in ("ui_show_donate", "support_stats_reports_generated") if name in user_columns
    ]
    if obsolete_user_columns:
        with op.batch_alter_table("users") as batch:
            for column_name in obsolete_user_columns:
                batch.drop_column(column_name)

    settings_columns = _columns(sa.inspect(bind), "settings")
    obsolete_settings_columns = [
        name for name in ("system_instance_id", "donate_ui_hidden") if name in settings_columns
    ]
    if obsolete_settings_columns:
        with op.batch_alter_table("settings") as batch:
            for column_name in obsolete_settings_columns:
                batch.drop_column(column_name)


def downgrade():
    bind = op.get_bind()
    dialect_name = getattr(bind.dialect, "name", "generic")
    bool_true = "1" if dialect_name == "sqlite" else "true"
    bool_false = "0" if dialect_name == "sqlite" else "false"

    user_columns = _columns(sa.inspect(bind), "users")
    with op.batch_alter_table("users") as batch:
        if "ui_show_donate" not in user_columns:
            batch.add_column(
                sa.Column("ui_show_donate", sa.Boolean(), nullable=False, server_default=sa.text(bool_true))
            )
        if "support_stats_reports_generated" not in user_columns:
            batch.add_column(
                sa.Column("support_stats_reports_generated", sa.Integer(), nullable=False, server_default="0")
            )

    settings_columns = _columns(sa.inspect(bind), "settings")
    with op.batch_alter_table("settings") as batch:
        if "system_instance_id" not in settings_columns:
            batch.add_column(sa.Column("system_instance_id", sa.String(36), nullable=True))
        if "donate_ui_hidden" not in settings_columns:
            batch.add_column(
                sa.Column("donate_ui_hidden", sa.Boolean(), nullable=False, server_default=sa.text(bool_false))
            )

    if "donation_interactions" not in sa.inspect(bind).get_table_names():
        op.create_table(
            "donation_interactions",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("interaction_type", sa.String(length=50), nullable=False),
            sa.Column("source", sa.String(length=100), nullable=True),
            sa.Column("time_entries_count", sa.Integer(), nullable=True),
            sa.Column("days_since_signup", sa.Integer(), nullable=True),
            sa.Column("total_hours", sa.Float(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("variant", sa.String(length=50), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("idx_donation_interactions_user_id", "donation_interactions", ["user_id"])
