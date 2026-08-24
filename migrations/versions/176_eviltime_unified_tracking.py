"""Add EvilTime unified project tracking preferences and weekly corrections.

Revision ID: 176_eviltime_unified_tracking
Revises: 175_add_rounding_boundary_and_minimum
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "176_eviltime_unified_tracking"
down_revision = "175_add_rounding_boundary_and_minimum"
branch_labels = None
depends_on = None


def _columns(inspector, table):
    return {column["name"] for column in inspector.get_columns(table)}


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    user_columns = _columns(inspector, "users")
    if "default_project_id" not in user_columns:
        with op.batch_alter_table("users") as batch:
            batch.add_column(sa.Column("default_project_id", sa.Integer(), nullable=True))
            batch.create_foreign_key(
                "fk_users_default_project_id_projects",
                "projects",
                ["default_project_id"],
                ["id"],
                ondelete="SET NULL",
            )
            batch.create_index("ix_users_default_project_id", ["default_project_id"], unique=False)

    goal_columns = _columns(inspect(bind), "weekly_time_goals")
    if "actual_hours_override" not in goal_columns:
        with op.batch_alter_table("weekly_time_goals") as batch:
            batch.add_column(sa.Column("actual_hours_override", sa.Float(), nullable=True))


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "actual_hours_override" in _columns(inspector, "weekly_time_goals"):
        with op.batch_alter_table("weekly_time_goals") as batch:
            batch.drop_column("actual_hours_override")
    if "default_project_id" in _columns(inspect(bind), "users"):
        with op.batch_alter_table("users") as batch:
            batch.drop_index("ix_users_default_project_id")
            batch.drop_constraint("fk_users_default_project_id_projects", type_="foreignkey")
            batch.drop_column("default_project_id")
