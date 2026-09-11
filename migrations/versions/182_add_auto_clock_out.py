"""Add automatic clock-out after the daily working hours.

Revision ID: 182_add_auto_clock_out
Revises: 181_weekly_actual_adjustment
"""

import sqlalchemy as sa
from alembic import op

revision = "182_add_auto_clock_out"
down_revision = "181_weekly_actual_adjustment"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "auto_clock_out_enabled" not in user_columns:
        op.add_column(
            "users",
            sa.Column("auto_clock_out_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        )

    if "auto_clock_out_states" in inspector.get_table_names():
        return
    op.create_table(
        "auto_clock_out_states",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("work_date", sa.Date(), nullable=False),
        sa.Column("extension_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("warned_at", sa.DateTime(), nullable=True),
        sa.Column(
            "warned_entry_id", sa.Integer(), sa.ForeignKey("time_entries.id", ondelete="SET NULL"), nullable=True
        ),
        sa.Column("warned_limit_seconds", sa.Integer(), nullable=True),
        sa.Column("deadline_at", sa.DateTime(), nullable=True),
        sa.Column("auto_clocked_out_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "work_date", name="uq_auto_clock_out_user_day"),
    )
    op.create_index("ix_auto_clock_out_states_user_id", "auto_clock_out_states", ["user_id"])
    op.create_index("ix_auto_clock_out_states_work_date", "auto_clock_out_states", ["work_date"])


def downgrade():
    inspector = sa.inspect(op.get_bind())
    if "auto_clock_out_states" in inspector.get_table_names():
        op.drop_table("auto_clock_out_states")
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "auto_clock_out_enabled" in user_columns:
        with op.batch_alter_table("users") as batch:
            batch.drop_column("auto_clock_out_enabled")
