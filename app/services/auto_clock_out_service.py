"""Automatic clock-out once the day's standard working hours are reached.

Flow for one user-day:

1. While a timer runs, the scheduler compares the hours worked that day with
   the user's standard hours per day plus any extensions approved that day.
2. When the limit is reached the user is warned (dashboard, browser push,
   Slack DM with buttons) and has ``GRACE_MINUTES`` to extend the day.
3. Without an extension the timer is stopped when the grace period ends. The
   entry's end is set to the moment the limit was reached, so unconfirmed
   overtime is never recorded.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any, Dict, Optional

from app import db
from app.models import AutoClockOutState, TimeEntry, User
from app.models.time_entry import local_now
from app.utils.db import safe_commit

logger = logging.getLogger(__name__)

GRACE_MINUTES = 15
EXTENSION_CHOICES = (15, 30, 60)
MAX_EXTENSION_MINUTES_PER_REQUEST = 8 * 60
AUTO_CLOCK_OUT_NOTE = "Automatically clocked out: daily working time reached"


class AutoClockOutService:
    """Detect reached daily hours, warn, accept extensions, and auto clock-out."""

    # ------------------------------------------------------------------
    # Limits and worked time
    # ------------------------------------------------------------------
    @staticmethod
    def is_enabled(user) -> bool:
        return bool(getattr(user, "auto_clock_out_enabled", True))

    @staticmethod
    def base_limit_seconds(user) -> int:
        hours = float(getattr(user, "standard_hours_per_day", 8.0) or 8.0)
        return int(round(hours * 3600))

    @staticmethod
    def work_date_for(user, entry=None):
        """User-local calendar day a running entry counts towards (its start day)."""
        from app.utils.timezone import convert_app_datetime_to_user, now_in_user_timezone

        if entry is not None and entry.start_time is not None:
            return convert_app_datetime_to_user(entry._naive_dt(entry.start_time), user).date()
        return now_in_user_timezone(user).date()

    @staticmethod
    def _running_seconds(entry, now) -> int:
        """Worked seconds of an active entry at ``now`` (same rule as ``current_duration_seconds``)."""
        start = entry._naive_dt(entry.start_time)
        end_ref = entry._naive_dt(entry.paused_at) if entry.paused_at else now
        if start is None or end_ref is None:
            return 0
        return max(0, int((end_ref - start).total_seconds()) - int(entry.break_seconds or 0))

    def worked_seconds(self, user, work_date, now=None) -> int:
        """Worked seconds (breaks excluded) for entries starting on ``work_date``."""
        from app.utils.timezone import user_day_bounds_app_naive

        now = now or local_now()
        day_start, day_end = user_day_bounds_app_naive(user, work_date)
        entries = TimeEntry.query.filter(
            TimeEntry.user_id == user.id,
            TimeEntry.start_time >= day_start,
            TimeEntry.start_time < day_end,
        ).all()
        return int(
            sum(
                self._running_seconds(entry, now) if entry.end_time is None else (entry.duration_seconds or 0)
                for entry in entries
            )
        )

    @staticmethod
    def get_state(user_id: int, work_date, create: bool = False) -> Optional[AutoClockOutState]:
        state = AutoClockOutState.query.filter_by(user_id=user_id, work_date=work_date).first()
        if state is None and create:
            state = AutoClockOutState(user_id=user_id, work_date=work_date, extension_minutes=0)
            db.session.add(state)
        return state

    def limit_seconds(self, user, state: Optional[AutoClockOutState]) -> int:
        extension = int(state.extension_minutes or 0) if state else 0
        return self.base_limit_seconds(user) + extension * 60

    # ------------------------------------------------------------------
    # Read model for dashboard / API
    # ------------------------------------------------------------------
    def status(self, user, entry=None, now=None) -> Dict[str, Any]:
        now = now or local_now()
        entry = entry if entry is not None else user.active_timer
        work_date = self.work_date_for(user, entry)
        state = self.get_state(user.id, work_date)
        limit = self.limit_seconds(user, state)
        worked = self.worked_seconds(user, work_date, now)
        enabled = self.is_enabled(user)
        warning_active = bool(
            enabled
            and entry is not None
            and state is not None
            and state.deadline_at is not None
            and state.warned_entry_id == entry.id
        )
        running = entry is not None and entry.paused_at is None
        limit_reached_at = None
        if enabled and running and worked < limit:
            limit_reached_at = now + timedelta(seconds=limit - worked)
        return {
            "enabled": enabled,
            "work_date": work_date,
            "limit_seconds": limit,
            "base_limit_seconds": self.base_limit_seconds(user),
            "extension_minutes": int(state.extension_minutes or 0) if state else 0,
            "worked_seconds": worked,
            "remaining_seconds": max(0, limit - worked),
            "limit_reached_at": limit_reached_at,
            "warning_active": warning_active,
            "deadline_at": state.deadline_at if warning_active else None,
            "auto_clocked_out_at": state.auto_clocked_out_at if state else None,
            "extension_choices": EXTENSION_CHOICES,
            "grace_minutes": GRACE_MINUTES,
        }

    # ------------------------------------------------------------------
    # User actions
    # ------------------------------------------------------------------
    def extend(self, user, minutes: int) -> Dict[str, Any]:
        """Approve ``minutes`` of extra work for the current work day."""
        try:
            minutes = int(minutes)
        except (TypeError, ValueError):
            minutes = 0
        if minutes <= 0 or minutes > MAX_EXTENSION_MINUTES_PER_REQUEST:
            return {"success": False, "message": "Choose a valid extension.", "error": "invalid_extension"}

        entry = user.active_timer
        work_date = self.work_date_for(user, entry)
        state = self.get_state(user.id, work_date, create=True)
        state.extension_minutes = int(state.extension_minutes or 0) + minutes
        state.clear_warning()
        if not safe_commit("auto_clock_out_extend", {"user_id": user.id, "minutes": minutes}):
            return {"success": False, "message": "Could not save the extension.", "error": "database_error"}

        limit = self.limit_seconds(user, state)
        self._emit(user.id, "overtime_extended", {"limit_seconds": limit, "extension_minutes": state.extension_minutes})
        return {
            "success": True,
            "message": "Work time extended.",
            "limit_seconds": limit,
            "extension_minutes": state.extension_minutes,
        }

    # ------------------------------------------------------------------
    # Scheduler
    # ------------------------------------------------------------------
    def run(self, now=None) -> Dict[str, int]:
        """Evaluate every running timer; called by the scheduler every minute."""
        counts = {"checked": 0, "warned": 0, "clocked_out": 0}
        entries = (
            TimeEntry.query.join(User, User.id == TimeEntry.user_id)
            .filter(
                TimeEntry.end_time.is_(None),
                User.is_active.is_(True),
                User.auto_clock_out_enabled.is_(True),
            )
            .all()
        )
        for entry in entries:
            counts["checked"] += 1
            try:
                outcome = self.process_entry(entry, now=now)
            except Exception:
                db.session.rollback()
                logger.exception("Auto clock-out check failed for time entry %s", entry.id)
                continue
            if outcome in counts:
                counts[outcome] += 1
        return counts

    def process_entry(self, entry: TimeEntry, now=None) -> Optional[str]:
        """Warn or clock out one running entry. Returns ``warned``, ``clocked_out`` or ``None``."""
        if entry.end_time is not None:
            return None
        user = entry.user
        if user is None or not self.is_enabled(user):
            return None
        now = now or local_now()
        work_date = self.work_date_for(user, entry)
        state = self.get_state(user.id, work_date)
        limit = self.limit_seconds(user, state)
        worked = self.worked_seconds(user, work_date, now)

        if worked < limit:
            if state is not None and state.deadline_at is not None:
                # Entries were edited or shortened below the limit: warning no longer applies.
                state.clear_warning()
                safe_commit("auto_clock_out_clear_warning", {"user_id": user.id})
            return None

        if state is None:
            state = self.get_state(user.id, work_date, create=True)

        warning_current = (
            state.deadline_at is not None and state.warned_entry_id == entry.id and state.warned_limit_seconds == limit
        )
        if not warning_current:
            state.warned_at = now
            state.warned_entry_id = entry.id
            state.warned_limit_seconds = limit
            state.deadline_at = now + timedelta(minutes=GRACE_MINUTES)
            if not safe_commit("auto_clock_out_warn", {"user_id": user.id, "entry_id": entry.id}):
                return None
            self._notify_warning(user, entry, state, limit)
            return "warned"

        if now < state.deadline_at:
            return None

        return "clocked_out" if self._clock_out(user, entry, state, limit, worked - limit, now) else None

    # ------------------------------------------------------------------
    # Clock-out
    # ------------------------------------------------------------------
    def _clock_out(self, user, entry, state, limit, overshoot, now) -> bool:
        from app.integrations.slack_attendance_connector import suppress_channel_announcements
        from app.models import TimerEvent
        from app.services.timer_event_service import BREAK_EVENT_TYPES, record_timer_event

        cap, removed_break_seconds = self.cap_point(entry, overshoot, now)

        entry.paused_at = None
        entry.break_seconds = max(0, int(entry.break_seconds or 0) - removed_break_seconds)
        entry.end_time = cap
        entry.notes = f"{entry.notes}\n{AUTO_CLOCK_OUT_NOTE}" if entry.notes else AUTO_CLOCK_OUT_NOTE
        entry.calculate_duration()
        # Breaks after the new end describe time outside the entry.
        TimerEvent.query.filter(
            TimerEvent.time_entry_id == entry.id,
            TimerEvent.event_type.in_(BREAK_EVENT_TYPES),
            db.or_(
                db.and_(TimerEvent.event_type == "break_start", TimerEvent.occurred_at >= cap),
                db.and_(TimerEvent.event_type == "break_end", TimerEvent.occurred_at > cap),
            ),
        ).delete(synchronize_session=False)

        state.auto_clocked_out_at = now
        state.clear_warning()
        if not safe_commit("auto_clock_out", {"user_id": user.id, "entry_id": entry.id}):
            return False

        with suppress_channel_announcements():
            record_timer_event("clock_out", entry, occurred_at=entry.end_time)

        try:
            from app.models import Activity

            Activity.log(
                user_id=user.id,
                action="stopped",
                entity_type="time_entry",
                entity_id=entry.id,
                entity_name=entry.project.name if entry.project else None,
                description=f"{AUTO_CLOCK_OUT_NOTE} ({limit // 3600}:{(limit % 3600) // 60:02d} h)",
                extra_data={"auto_clock_out": True, "limit_seconds": limit, "end_time": cap.isoformat()},
            )
        except Exception:
            logger.debug("Could not log auto clock-out activity", exc_info=True)

        self._notify_clock_out(user, entry, limit)
        logger.info("Auto clocked out user %s (entry %s) at %s", user.id, entry.id, cap)
        return True

    @staticmethod
    def cap_point(entry, overshoot_seconds: int, now):
        """Return ``(end_time, removed_break_seconds)`` removing ``overshoot`` of work.

        Walks backwards from ``now`` through the entry's running periods,
        skipping over recorded breaks, so breaks taken after the limit was
        reached are not counted as work. The open break of a paused timer was
        never added to ``break_seconds``; recorded breaks that end up after the
        new end are returned so the caller can take them off ``break_seconds``.
        """
        from app.services.timer_event_service import get_break_pairs

        start = entry._naive_dt(entry.start_time)
        remaining = max(0, int(overshoot_seconds or 0))
        cursor = now
        if entry.paused_at is not None:
            cursor = min(cursor, entry._naive_dt(entry.paused_at))

        removed_break = 0
        breaks = sorted(
            (
                (entry._naive_dt(pair["start"].occurred_at), entry._naive_dt(pair["end"].occurred_at))
                for pair in get_break_pairs(entry.user_id, entry.id)
            ),
            key=lambda pair: pair[1],
            reverse=True,
        )
        for break_start, break_end in breaks:
            if break_end > cursor or break_start < start or break_end <= break_start:
                continue
            running = int((cursor - break_end).total_seconds())
            if running >= remaining:
                break
            remaining -= running
            removed_break += int((break_end - break_start).total_seconds())
            cursor = break_start

        cap = cursor - timedelta(seconds=remaining)
        return max(cap, start), removed_break

    # ------------------------------------------------------------------
    # Notifications
    # ------------------------------------------------------------------
    @staticmethod
    def _emit(user_id: int, event: str, payload: Dict[str, Any]) -> None:
        try:
            from app import socketio

            socketio.emit(event, {"user_id": user_id, **payload}, room=f"user_{user_id}")
        except Exception:
            logger.debug("Socket emit %s failed", event, exc_info=True)

    @staticmethod
    def _push(user, title: str, message: str) -> None:
        try:
            from app.models import PushSubscription
            from app.utils.scheduled_tasks import _deliver_push_to_subscriptions

            subscriptions = PushSubscription.get_user_subscriptions(user.id)
            if subscriptions:
                _deliver_push_to_subscriptions(
                    user,
                    subscriptions,
                    {"kind": "auto_clock_out", "title": title, "message": message, "type": "warning"},
                )
        except Exception:
            logger.debug("Auto clock-out push notification skipped", exc_info=True)

    @staticmethod
    def _slack():
        try:
            from app.integrations.slack_attendance_connector import SlackAttendanceConnector

            return SlackAttendanceConnector.for_global()
        except Exception:
            return None

    def _notify_warning(self, user, entry, state, limit) -> None:
        from app.utils.timezone import convert_app_datetime_to_user

        deadline_local = convert_app_datetime_to_user(state.deadline_at, user).strftime("%H:%M")
        hours = f"{limit // 3600}:{(limit % 3600) // 60:02d} h"
        self._emit(
            user.id,
            "overtime_warning",
            {
                "timer_id": entry.id,
                "limit_seconds": limit,
                "deadline_at": state.deadline_at.isoformat(),
                "deadline_local": deadline_local,
                "title": "Daily working time reached",
                "message": f"You have worked {hours} today. You will be clocked out at {deadline_local} unless you extend.",
            },
        )
        self._push(
            user,
            "Daily working time reached",
            f"You have worked {hours} today. Extend before {deadline_local} or you will be clocked out.",
        )
        connector = self._slack()
        if connector:
            try:
                connector.send_overtime_warning(
                    user, limit_seconds=limit, deadline_at=state.deadline_at, extension_choices=EXTENSION_CHOICES
                )
            except Exception:
                logger.warning("Slack overtime warning failed for user %s", user.id, exc_info=True)

    def _notify_clock_out(self, user, entry, limit) -> None:
        try:
            from app.utils.realtime import emit_timer_state

            emit_timer_state("timer_stopped", entry)
        except Exception:
            logger.debug("Socket emit timer_stopped failed", exc_info=True)
        self._push(
            user,
            "Automatically clocked out",
            f"Your daily working time of {limit // 3600}:{(limit % 3600) // 60:02d} h was reached.",
        )
        connector = self._slack()
        if connector:
            try:
                connector.send_auto_clock_out_notice(user, entry, limit_seconds=limit)
            except Exception:
                logger.warning("Slack auto clock-out notice failed for user %s", user.id, exc_info=True)
