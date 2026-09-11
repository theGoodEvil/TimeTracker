"""Slack reminder when a break has lasted long enough.

Mirrors the dashboard's browser notification ("Are you well rested? ...") for
people who are away from the browser: once per break, after
``BREAK_REMINDER_MINUTES``, Slack-linked users get a DM with an End break button.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Dict

from app import db
from app.models import TimeEntry, User
from app.models.time_entry import local_now
from app.utils.db import safe_commit

logger = logging.getLogger(__name__)

BREAK_REMINDER_MINUTES = 30


class BreakReminderService:
    def run(self, now=None) -> Dict[str, int]:
        """Send due break reminders; called by the scheduler every minute."""
        from app.integrations.slack_attendance_connector import SlackAttendanceConnector

        counts = {"due": 0, "sent": 0}
        connector = SlackAttendanceConnector.for_global()
        if connector is None or not connector._is_ready():
            return counts

        now = now or local_now()
        cutoff = now - timedelta(minutes=BREAK_REMINDER_MINUTES)
        entries = (
            TimeEntry.query.join(User, User.id == TimeEntry.user_id)
            .filter(
                TimeEntry.end_time.is_(None),
                TimeEntry.paused_at.isnot(None),
                TimeEntry.paused_at <= cutoff,
                db.or_(
                    TimeEntry.break_reminder_sent_at.is_(None),
                    TimeEntry.break_reminder_sent_at < TimeEntry.paused_at,
                ),
                User.is_active.is_(True),
                User.slack_user_id.isnot(None),
                User.slack_break_reminder_enabled.is_(True),
            )
            .all()
        )
        for entry in entries:
            counts["due"] += 1
            # Mark first so a failing Slack call never turns into a reminder every minute.
            entry.break_reminder_sent_at = now
            if not safe_commit("break_reminder_mark_sent", {"entry_id": entry.id}):
                continue
            try:
                if connector.send_break_over_reminder(entry.user, entry):
                    counts["sent"] += 1
            except Exception:
                logger.warning("Slack break reminder failed for time entry %s", entry.id, exc_info=True)
        return counts
