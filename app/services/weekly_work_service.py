"""Weekly work ledger for EvilTime.

Detailed project entries remain the source data while an optional weekly actual
override supports migration from systems that only retained weekly totals.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy.orm import joinedload

from app import db
from app.models import TimeEntry, WeeklyTimeGoal
from app.models.time_entry import local_now
from app.utils.overtime import get_week_start_for_date

_UNSET = object()


class WeeklyWorkService:
    @staticmethod
    def week_start(value: date, user) -> date:
        return get_week_start_for_date(value, user)

    @classmethod
    def expected_hours(cls, user, week_start: date, goals=None) -> float:
        """Resolve the effective weekly target, inheriting the last change."""
        goals = (
            goals
            if goals is not None
            else (
                WeeklyTimeGoal.query.filter(
                    WeeklyTimeGoal.user_id == user.id,
                    WeeklyTimeGoal.week_start_date <= week_start,
                    WeeklyTimeGoal.status != "cancelled",
                )
                .order_by(WeeklyTimeGoal.week_start_date)
                .all()
            )
        )
        applicable = [goal for goal in goals if goal.week_start_date <= week_start and goal.status != "cancelled"]
        if applicable:
            return round(float(applicable[-1].target_hours), 2)
        fallback = getattr(user, "standard_hours_per_week", None)
        if fallback is None or fallback <= 0:
            fallback = (getattr(user, "standard_hours_per_day", 8.0) or 8.0) * 5
        return round(float(fallback), 2)

    @classmethod
    def rows(cls, user, limit=12, include_future=True):
        goals = (
            WeeklyTimeGoal.query.filter_by(user_id=user.id)
            .filter(WeeklyTimeGoal.status != "cancelled")
            .order_by(WeeklyTimeGoal.week_start_date)
            .all()
        )
        goal_by_week = {goal.week_start_date: goal for goal in goals}
        entries = (
            TimeEntry.query.options(joinedload(TimeEntry.project))
            .filter(TimeEntry.user_id == user.id)
            .order_by(TimeEntry.start_time)
            .all()
        )
        projects_by_week = defaultdict(lambda: defaultdict(float))
        for entry in entries:
            week = cls.week_start(entry.start_time.date(), user)
            seconds = entry.current_duration_seconds if entry.end_time is None else (entry.duration_seconds or 0)
            project_name = entry.project.name if entry.project else "Unassigned legacy time"
            projects_by_week[week][project_name] += max(0, seconds) / 3600

        current_week = cls.week_start(local_now().date(), user)
        source_weeks = set(projects_by_week) | set(goal_by_week) | {current_week}
        first_week = min(source_weeks)
        last_week = max(source_weeks) if include_future else current_week
        weeks = set()
        cursor = first_week
        while cursor <= last_week:
            weeks.add(cursor)
            cursor += timedelta(days=7)
        if not include_future:
            weeks = {week for week in weeks if week <= current_week}

        rows = []
        cumulative = 0.0
        for week in sorted(weeks):
            goal = goal_by_week.get(week)
            tracked = round(sum(projects_by_week[week].values()), 2)
            override = goal.actual_hours_override if goal else None
            actual = round(float(override), 2) if override is not None else tracked
            expected = cls.expected_hours(user, week, goals)
            # An empty current week is context only and never creates undertime.
            # A target-only row changes the schedule but is still "missing"
            # work data. Missing migration weeks must not create undertime.
            counted = bool(tracked > 0 or override is not None)
            balance = round(actual - expected, 2) if counted else 0.0
            if counted:
                cumulative = round(cumulative + balance, 2)
            rows.append(
                {
                    "week_start": week,
                    "week_end": week + timedelta(days=6),
                    "calendar_week": week.isocalendar().week,
                    "goal": goal,
                    "expected_hours": expected,
                    "tracked_hours": tracked,
                    "actual_hours": actual,
                    "actual_hours_override": override,
                    "balance_hours": balance,
                    "cumulative_overtime": cumulative,
                    "counted": counted,
                    "projects": [
                        {"name": name, "hours": round(hours, 2)}
                        for name, hours in sorted(
                            projects_by_week[week].items(), key=lambda pair: pair[1], reverse=True
                        )
                    ],
                }
            )
        rows.reverse()
        return rows[:limit] if limit else rows

    @classmethod
    def current_week_days(cls, user):
        """Return a compact Monday–Sunday ledger for dashboard display."""
        today = local_now().date()
        start = cls.week_start(today, user)
        end = start + timedelta(days=6)
        totals = defaultdict(float)
        entries = TimeEntry.query.filter(
            TimeEntry.user_id == user.id,
            TimeEntry.start_time >= date_to_datetime(start),
            TimeEntry.start_time < date_to_datetime(end + timedelta(days=1)),
        ).all()
        for entry in entries:
            seconds = entry.current_duration_seconds if entry.end_time is None else (entry.duration_seconds or 0)
            totals[entry.start_time.date()] += max(0, seconds) / 3600

        weekly_expected = cls.expected_hours(user, start)
        weekday_expected = weekly_expected / 5 if weekly_expected else 0
        return [
            {
                "date": start + timedelta(days=offset),
                "hours": round(totals[start + timedelta(days=offset)], 2),
                "expected_hours": round(weekday_expected, 2) if offset < 5 else 0,
                "is_today": start + timedelta(days=offset) == today,
                "is_future": start + timedelta(days=offset) > today,
            }
            for offset in range(7)
        ]

    @classmethod
    def upsert_adjustment(cls, user, week_start: date, expected_hours: float, actual_override=_UNSET, notes=None):
        """Create or update a weekly ledger row.

        Omitting ``actual_override`` preserves an existing migration value. Passing
        ``None`` explicitly clears it, which is what the calendar-week adjustment
        form needs when a user switches back to project-entry totals.
        """
        week_start = cls.week_start(week_start, user)
        goal = WeeklyTimeGoal.query.filter_by(user_id=user.id, week_start_date=week_start).first()
        if goal is None:
            goal = WeeklyTimeGoal(user_id=user.id, target_hours=expected_hours, week_start_date=week_start)
            db.session.add(goal)
        goal.target_hours = expected_hours
        goal.week_end_date = week_start + timedelta(days=6)
        if actual_override is not _UNSET:
            goal.actual_hours_override = actual_override
        goal.notes = notes or None
        goal.status = "active"
        return goal


def date_to_datetime(value: date):
    """Keep ledger range queries compatible with the app's naive timestamps."""
    from datetime import datetime, time

    return datetime.combine(value, time.min)
