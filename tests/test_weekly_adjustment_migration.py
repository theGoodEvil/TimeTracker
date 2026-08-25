"""Regression coverage for the weekly override-to-adjustment data migration."""

from datetime import date, datetime, timedelta
import importlib.util

from alembic.migration import MigrationContext
from alembic.operations import Operations
import sqlalchemy as sa


def _load_migration():
    spec = importlib.util.spec_from_file_location(
        "weekly_adjustment_migration",
        "migrations/versions/181_weekly_actual_hours_adjustment.py",
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_migration_preserves_existing_authoritative_total(tmp_path):
    engine = sa.create_engine(f"sqlite:///{tmp_path / 'weekly-adjustment.sqlite'}")
    metadata = sa.MetaData()
    goals = sa.Table(
        "weekly_time_goals",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, nullable=False),
        sa.Column("week_start_date", sa.Date, nullable=False),
        sa.Column("week_end_date", sa.Date, nullable=False),
        sa.Column("actual_hours_override", sa.Float),
    )
    entries = sa.Table(
        "time_entries",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, nullable=False),
        sa.Column("start_time", sa.DateTime, nullable=False),
        sa.Column("end_time", sa.DateTime),
        sa.Column("duration_seconds", sa.Integer),
    )
    metadata.create_all(engine)
    week_start = date(2026, 8, 17)
    with engine.begin() as connection:
        connection.execute(
            goals.insert().values(
                id=1,
                user_id=7,
                week_start_date=week_start,
                week_end_date=week_start + timedelta(days=6),
                actual_hours_override=23.5,
            )
        )
        connection.execute(
            entries.insert().values(
                id=1,
                user_id=7,
                start_time=datetime(2026, 8, 18, 9),
                end_time=datetime(2026, 8, 18, 17),
                duration_seconds=20 * 3600,
            )
        )

    migration = _load_migration()
    with engine.begin() as connection:
        context = MigrationContext.configure(connection)
        with Operations.context(context):
            migration.upgrade()

        adjustment = connection.execute(
            sa.text("SELECT actual_hours_adjustment FROM weekly_time_goals WHERE id = 1")
        ).scalar_one()
        columns = {column["name"] for column in sa.inspect(connection).get_columns("weekly_time_goals")}
        assert adjustment == 3.5
        assert "actual_hours_override" not in columns

        with Operations.context(context):
            migration.downgrade()

        override = connection.execute(
            sa.text("SELECT actual_hours_override FROM weekly_time_goals WHERE id = 1")
        ).scalar_one()
        assert override == 23.5
