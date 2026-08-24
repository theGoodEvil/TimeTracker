"""Replace weekly actual-hours overrides with additive adjustments.

Revision ID: 181_weekly_actual_adjustment
Revises: 180_add_timer_event_timeline
"""

from datetime import datetime, time, timedelta

import sqlalchemy as sa
from alembic import op

revision = "181_weekly_actual_adjustment"
down_revision = "180_add_timer_event_timeline"
branch_labels = None
depends_on = None


def _tracked_hours(bind, row):
    time_entries = sa.table(
        "time_entries",
        sa.column("user_id", sa.Integer),
        sa.column("start_time", sa.DateTime),
        sa.column("end_time", sa.DateTime),
        sa.column("duration_seconds", sa.Integer),
    )
    start = datetime.combine(row.week_start_date, time.min)
    end = datetime.combine(row.week_end_date + timedelta(days=1), time.min)
    seconds = bind.execute(
        sa.select(sa.func.coalesce(sa.func.sum(time_entries.c.duration_seconds), 0)).where(
            time_entries.c.user_id == row.user_id,
            time_entries.c.start_time >= start,
            time_entries.c.start_time < end,
            time_entries.c.end_time.is_not(None),
        )
    ).scalar_one()
    return float(seconds or 0) / 3600.0


def _goals_table(include_override=False, include_adjustment=False):
    columns = [
        sa.column("id", sa.Integer),
        sa.column("user_id", sa.Integer),
        sa.column("week_start_date", sa.Date),
        sa.column("week_end_date", sa.Date),
    ]
    if include_override:
        columns.append(sa.column("actual_hours_override", sa.Float))
    if include_adjustment:
        columns.append(sa.column("actual_hours_adjustment", sa.Float))
    return sa.table("weekly_time_goals", *columns)


def upgrade():
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("weekly_time_goals")}
    if "actual_hours_adjustment" not in columns:
        with op.batch_alter_table("weekly_time_goals") as batch:
            batch.add_column(sa.Column("actual_hours_adjustment", sa.Float(), nullable=True))

    columns = {column["name"] for column in sa.inspect(bind).get_columns("weekly_time_goals")}
    if "actual_hours_override" in columns:
        goals = _goals_table(include_override=True, include_adjustment=True)
        rows = bind.execute(sa.select(goals).where(goals.c.actual_hours_override.is_not(None))).all()
        for row in rows:
            adjustment = round(float(row.actual_hours_override) - _tracked_hours(bind, row), 10)
            bind.execute(goals.update().where(goals.c.id == row.id).values(actual_hours_adjustment=adjustment))
        with op.batch_alter_table("weekly_time_goals") as batch:
            batch.drop_column("actual_hours_override")


def downgrade():
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("weekly_time_goals")}
    if "actual_hours_override" not in columns:
        with op.batch_alter_table("weekly_time_goals") as batch:
            batch.add_column(sa.Column("actual_hours_override", sa.Float(), nullable=True))

    goals = _goals_table(include_override=True, include_adjustment=True)
    rows = bind.execute(sa.select(goals).where(goals.c.actual_hours_adjustment.is_not(None))).all()
    for row in rows:
        override = round(_tracked_hours(bind, row) + float(row.actual_hours_adjustment), 10)
        bind.execute(goals.update().where(goals.c.id == row.id).values(actual_hours_override=override))
    with op.batch_alter_table("weekly_time_goals") as batch:
        batch.drop_column("actual_hours_adjustment")
