"""Capture and present project timer state transitions."""

from __future__ import annotations

from app import db
from app.models import TimerEvent
from app.utils.db import safe_commit

TIMELINE_START_MINUTE = 8 * 60
TIMELINE_END_MINUTE = 22 * 60


def record_timer_event(event_type, entry, *, occurred_at=None, related_entry_id=None):
    """Persist an event after a timer mutation; updates existing boundary events to avoid duplicates."""
    if not entry or event_type not in {"clock_in", "project_switch", "clock_out", "break_start", "break_end"}:
        return None
    event_time = occurred_at or entry.start_time
    # If a boundary TimerEvent for this entry and event_type already exists, update it
    if event_type in {"clock_in", "clock_out", "project_switch"}:
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
            TimerEvent.event_type.in_(["break_start", "break_end"])
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
    for index, item in enumerate(timeline):
        occurred_at = item["occurred_at"]
        minute = occurred_at.hour * 60 + occurred_at.minute + occurred_at.second / 60
        item["timeline_position"] = round(max(0, min(100, (minute - TIMELINE_START_MINUTE) / span * 100)), 4)
        item["timeline_lane"] = index % 2
        item["outside_timeline"] = minute < TIMELINE_START_MINUTE or minute > TIMELINE_END_MINUTE
    return timeline
