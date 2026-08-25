"""Small Socket.IO helpers for EvilTime's user-scoped work state."""


def emit_timer_state(event: str, entry, user_id=None) -> None:
    """Publish a timer transition to the owning user's authenticated room."""
    from app import socketio

    owner_id = user_id or entry.user_id
    payload = {
        "user_id": owner_id,
        "timer_id": entry.id,
        "project_id": entry.project_id,
        "project_name": entry.project.name if entry.project else None,
        "paused": bool(entry.is_paused),
        "break_seconds": entry.break_seconds or 0,
    }
    if entry.start_time:
        payload["start_time"] = entry.start_time.isoformat()
    if entry.end_time:
        payload["end_time"] = entry.end_time.isoformat()
        payload["duration"] = entry.duration_formatted
    socketio.emit(event, payload, room=f"user_{owner_id}")
