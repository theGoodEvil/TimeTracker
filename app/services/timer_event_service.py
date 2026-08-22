"""Capture and present project timer state transitions."""

from __future__ import annotations

from flask import has_app_context

from app import db
from app.models import TimerEvent
from app.utils.db import safe_commit

TIMELINE_START_MINUTE = 8 * 60
TIMELINE_END_MINUTE = 22 * 60

BREAK_EVENT_TYPES = ("break_start", "break_end")
BOUNDARY_EVENT_TYPES = ("clock_in", "clock_out", "project_switch")


def record_timer_event(event_type, entry, *, occurred_at=None, related_entry_id=None):
    """Persist an event after a timer mutation; updates existing boundary events to avoid duplicates."""
    if not entry or event_type not in {"clock_in", "project_switch", "clock_out", "break_start", "break_end"}:
        return None
    # Unit tests exercise the services outside a Flask app context; timer events are
    # a persistence side effect and can be skipped when there is nowhere to persist.
    if not has_app_context():
        return None
    event_time = occurred_at or entry.start_time
    # If a boundary TimerEvent for this entry and event_type already exists, update it
    if event_type in BOUNDARY_EVENT_TYPES:
        existing = TimerEvent.query.filter_by(
            user_id=entry.user_id,
            time_entry_id=entry.id,
            event_type=event_type,
        ).first()
        if existing:
            existing.occurred_at = event_time
            if related_entry_id is not None:
                existing.related_entry_id = related_entry_id
            safe_commit("record_timer_event_update", {"entry_id": entry.id, "event_type": event_type})
            return existing

    event = TimerEvent(
        user_id=entry.user_id,
        time_entry_id=entry.id,
        related_entry_id=related_entry_id,
        event_type=event_type,
        occurred_at=event_time,
    )
    db.session.add(event)
    if safe_commit("record_timer_event", {"entry_id": entry.id, "event_type": event_type}):
        return event
    return None


def get_break_events(user_id, entry_id):
    """All captured break events for one entry, in chronological order."""
    return (
        TimerEvent.query.filter_by(user_id=user_id, time_entry_id=entry_id)
        .filter(TimerEvent.event_type.in_(BREAK_EVENT_TYPES))
        .order_by(TimerEvent.occurred_at.asc(), TimerEvent.id.asc())
        .all()
    )


def get_break_pairs(user_id, entry_id):
    """Matched (break_start, break_end) event pairs for one entry."""
    pairs = []
    current_start = None
    for event in get_break_events(user_id, entry_id):
        if event.event_type == "break_start":
            current_start = event
        elif event.event_type == "break_end" and current_start is not None:
            pairs.append({"start": current_start, "end": event})
            current_start = None
    return pairs


def sum_break_seconds(events):
    """Total break seconds across ordered break_start/break_end events."""
    total = 0
    current_start = None
    for event in events:
        if event.event_type == "break_start":
            current_start = event.occurred_at
        elif event.event_type == "break_end" and current_start is not None:
            if event.occurred_at > current_start:
                total += int((event.occurred_at - current_start).total_seconds())
            current_start = None
    return total


def recompute_break_seconds(entry):
    """Recompute entry.break_seconds from its captured break event pairs."""
    events = get_break_events(entry.user_id, entry.id)
    entry.break_seconds = sum_break_seconds(events)
    if entry.end_time:
        entry.calculate_duration()
    return entry.break_seconds


def replace_break_events(entry, breaks):
    """Replace captured break events with the given (start, end) datetime pairs.

    The caller owns the surrounding transaction; nothing is committed here so the
    break sync stays atomic with whatever else the caller persists.
    """
    TimerEvent.query.filter_by(user_id=entry.user_id, time_entry_id=entry.id).filter(
        TimerEvent.event_type.in_(BREAK_EVENT_TYPES)
    ).delete(synchronize_session=False)
    total = 0
    for start_at, end_at in breaks:
        db.session.add(
            TimerEvent(user_id=entry.user_id, time_entry_id=entry.id, event_type="break_start", occurred_at=start_at)
        )
        db.session.add(
            TimerEvent(user_id=entry.user_id, time_entry_id=entry.id, event_type="break_end", occurred_at=end_at)
        )
        total += int((end_at - start_at).total_seconds())
    return total


def delete_entry_events(entry_id):
    """Remove all timer events attached to an entry; call before deleting the entry itself."""
    if not has_app_context():
        return
    TimerEvent.query.filter_by(time_entry_id=entry_id).delete(synchronize_session=False)


def fabricate_centered_break(entry, break_seconds, session_start, session_end):
    """Insert one break event pair of the given total duration, centered in the session.

    Manual entries only record an aggregate break amount; centering it in the session
    gives that amount a concrete place on the dashboard timeline. Caller commits.
    """
    from datetime import timedelta

    midpoint = session_start + (session_end - session_start) / 2
    half_break = timedelta(seconds=break_seconds / 2)
    break_start = max(midpoint - half_break, session_start)
    break_end = min(midpoint + half_break, session_end)

    db.session.add_all(
        [
            TimerEvent(user_id=entry.user_id, time_entry_id=entry.id, event_type="break_start", occurred_at=break_start),
            TimerEvent(user_id=entry.user_id, time_entry_id=entry.id, event_type="break_end", occurred_at=break_end),
        ]
    )


def _minute_in_user_timezone(dt, user):
    """Minute-of-day of a datetime as seen in the user's timezone.

    Aware datetimes are converted directly; naive ones are treated as stored
    app-timezone values (the convention used across the database).
    """
    from app.utils.timezone import convert_app_datetime_to_user, get_timezone_for_user

    if dt is None:
        return None
    if dt.tzinfo is not None:
        shown = dt.astimezone(get_timezone_for_user(user))
    else:
        shown = convert_app_datetime_to_user(dt, user) or dt
    return shown.hour * 60 + shown.minute + shown.second / 60


def current_timeline_position(now=None, user=None):
    """Percent position of 'now' on the dashboard timeline, clamped to [0, 100].

    Uses the user's timezone so the indicator lands where "now" actually sits
    relative to the displayed event times, even when the app timezone differs.
    """
    from app.utils.timezone import now_in_user_timezone

    if now is None:
        now = now_in_user_timezone(user)
    minute = _minute_in_user_timezone(now, user)
    span = TIMELINE_END_MINUTE - TIMELINE_START_MINUTE
    return round(max(0.0, min(100.0, (minute - TIMELINE_START_MINUTE) / span * 100)), 4)


def build_timeline_segments(timeline, now=None, user=None):
    """Derive colored work/break segments from an ordered timeline for rendering."""
    segments = []
    current_status = "none"
    last_position = None

    def close_segment(end_position):
        if last_position is None or current_status == "none":
            return
        segments.append(
            {
                "type": current_status,
                "start": last_position,
                "width": max(0, end_position - last_position),
            }
        )

    status_by_type = {
        "clock_in": "active",
        "project_switch": "active",
        "break_end": "active",
        "break_start": "break",
        "clock_out": "none",
    }
    for event in timeline:
        position = event["timeline_position"]
        close_segment(position)
        current_status = status_by_type.get(event["event_type"], current_status)
        last_position = position

    if last_position is not None and current_status != "none":
        now_position = current_timeline_position(now=now, user=user)
        if now_position > last_position:
            segments.append({"type": current_status, "start": last_position, "width": now_position - last_position})

    return segments


def build_timeline(user, entries):
    """Combine exact captured events (breaks) with inferred historical entry boundaries."""
    entries = sorted(entries, key=lambda item: (item.start_time, item.id))
    if not entries:
        return []

    ids = [entry.id for entry in entries]

    # ONLY fetch breaks from TimerEvent! Boundary events are always inferred from TimeEntry to prevent desync.
    break_events = (
        TimerEvent.query.filter(
            TimerEvent.user_id == user.id,
            TimerEvent.time_entry_id.in_(ids),
            TimerEvent.event_type.in_(BREAK_EVENT_TYPES)
        )
        .order_by(TimerEvent.occurred_at.asc(), TimerEvent.id.asc())
        .all()
    )

    timeline = []

    # Filter out 0-duration breaks
    valid_break_events = []
    skip_ids = set()
    for i, event in enumerate(break_events):
        if event.id in skip_ids:
            continue
        if event.event_type == "break_start":
            # Look ahead for a matching break_end at the exact same time
            if i + 1 < len(break_events):
                next_event = break_events[i + 1]
                if next_event.event_type == "break_end" and next_event.time_entry_id == event.time_entry_id:
                    if abs((next_event.occurred_at - event.occurred_at).total_seconds()) < 1:
                        skip_ids.add(next_event.id)
                        continue
        valid_break_events.append(event)
    break_events = valid_break_events

    for event in break_events:
        project = event.entry.project if event.entry else None

        # Clamp breaks strictly within TimeEntry boundaries so they don't look weird if start_time/end_time was edited
        occurred_at = event.occurred_at
        if event.entry:
            if occurred_at < event.entry.start_time:
                occurred_at = event.entry.start_time
            if event.entry.end_time and occurred_at > event.entry.end_time:
                occurred_at = event.entry.end_time

        # Skip break_end if it's exactly on top of clock_out
        if event.event_type == "break_end" and event.entry and event.entry.end_time:
            if abs((occurred_at - event.entry.end_time).total_seconds()) <= 2:
                continue

        timeline.append(
            {
                "event_id": event.id,
                "entry_id": event.time_entry_id,
                "related_entry_id": event.related_entry_id,
                "event_type": event.event_type,
                "occurred_at": occurred_at,
                "project_name": project.name if project else None,
                "captured": True,
            }
        )

    for index, entry in enumerate(entries):
        previous = entries[index - 1] if index else None
        contiguous_previous = bool(
            previous and previous.end_time and abs((entry.start_time - previous.end_time).total_seconds()) <= 10
        )
        start_type = "project_switch" if contiguous_previous else "clock_in"

        timeline.append(
            {
                "event_id": None,
                "entry_id": entry.id,
                "related_entry_id": previous.id if contiguous_previous else None,
                "event_type": start_type,
                "occurred_at": entry.start_time,
                "project_name": entry.project.name if entry.project else None,
                "captured": False,
            }
        )

        next_entry = entries[index + 1] if index + 1 < len(entries) else None
        contiguous_next = bool(
            entry.end_time and next_entry and abs((next_entry.start_time - entry.end_time).total_seconds()) <= 10
        )
        if entry.end_time and not contiguous_next:
            timeline.append(
                {
                    "event_id": None,
                    "entry_id": entry.id,
                    "related_entry_id": None,
                    "event_type": "clock_out",
                    "occurred_at": entry.end_time,
                    "project_name": entry.project.name if entry.project else None,
                    "captured": False,
                }
            )

    timeline = sorted(timeline, key=lambda item: (item["occurred_at"], item["event_id"] or 0))
    span = TIMELINE_END_MINUTE - TIMELINE_START_MINUTE
    # Lanes alternate within each event group (boundaries vs breaks) instead of
    # globally, so deleting one marker never reshuffles unrelated markers onto
    # the other label row.
    lane_counters = {"boundary": 0, "break": 0}
    for item in timeline:
        # Positions are derived from the same user-timezone view that renders
        # the displayed times, so markers always line up with their labels.
        minute = _minute_in_user_timezone(item["occurred_at"], user)
        item["timeline_position"] = round(max(0, min(100, (minute - TIMELINE_START_MINUTE) / span * 100)), 4)
        group = "break" if item["event_type"] in BREAK_EVENT_TYPES else "boundary"
        item["timeline_lane"] = lane_counters[group] % 2
        lane_counters[group] += 1
        item["outside_timeline"] = (
            minute < TIMELINE_START_MINUTE or minute > TIMELINE_END_MINUTE
        )
    return timeline
