"""Regression tests for dashboard timeline mutations (add / edit / delete events)."""

from datetime import datetime, timedelta

from app import db
from app.models import TimeEntry, TimerEvent


def _seed_day(app, user, project):
    """One finished session 08:00-17:00 with a 12:00-13:00 break, fully captured."""
    base = datetime.utcnow().replace(hour=8, minute=0, second=0, microsecond=0)
    end = base.replace(hour=17)

    entry = TimeEntry(
        user_id=user.id,
        project_id=project.id,
        start_time=base,
        end_time=end,
        source="manual",
        break_seconds=3600,
    )
    db.session.add(entry)
    db.session.flush()
    for event_type, at in [
        ("clock_in", base),
        ("break_start", base + timedelta(hours=4)),
        ("break_end", base + timedelta(hours=5)),
        ("clock_out", end),
    ]:
        db.session.add(TimerEvent(user_id=user.id, time_entry_id=entry.id, event_type=event_type, occurred_at=at))
    db.session.commit()
    return entry


def _post_timeline(client, url, **data):
    response = client.post(url, data=data, follow_redirects=True)
    assert response.status_code == 200, f"{url} -> {response.status_code}"
    return response


def _events(entry_id):
    return (
        TimerEvent.query.filter_by(time_entry_id=entry_id)
        .order_by(TimerEvent.occurred_at.asc(), TimerEvent.id.asc())
        .all()
    )


def test_delete_break_end_keeps_clock_out_position(app, client, authenticated_client, user, project):
    """Deleting a break end removes only the break pair; boundaries stay untouched."""
    entry = _seed_day(app, user, project)
    break_end = next(e for e in _events(entry.id) if e.event_type == "break_end")

    _post_timeline(
        client,
        "/dashboard/timeline/delete_event",
        event_id=break_end.id,
        event_type="break_end",
    )

    remaining = [(e.event_type, e.occurred_at.strftime("%H:%M")) for e in _events(entry.id)]
    assert remaining == [("clock_in", "08:00"), ("clock_out", "17:00")]
    assert entry.end_time.strftime("%H:%M") == "17:00"
    assert entry.break_seconds == 0


def test_delete_break_start_deletes_whole_pair(app, client, authenticated_client, user, project):
    entry = _seed_day(app, user, project)
    break_start = next(e for e in _events(entry.id) if e.event_type == "break_start")

    _post_timeline(
        client,
        "/dashboard/timeline/delete_event",
        event_id=break_start.id,
        event_type="break_start",
    )

    assert [e.event_type for e in _events(entry.id)] == ["clock_in", "clock_out"]
    assert entry.break_seconds == 0


def test_delete_clock_in_removes_entire_session(app, client, authenticated_client, user, project):
    entry = _seed_day(app, user, project)

    _post_timeline(
        client,
        "/dashboard/timeline/delete_event",
        entry_id=entry.id,
        event_type="clock_in",
    )

    assert TimeEntry.query.get(entry.id) is None
    assert TimerEvent.query.filter_by(time_entry_id=entry.id).count() == 0


def test_delete_clock_out_resumes_latest_session(app, client, authenticated_client, user, project):
    entry = _seed_day(app, user, project)

    _post_timeline(
        client,
        "/dashboard/timeline/delete_event",
        entry_id=entry.id,
        event_type="clock_out",
    )

    assert entry.end_time is None
    assert entry.duration_seconds is None


def test_delete_clock_out_refuses_when_later_sessions_exist(app, client, authenticated_client, user, project):
    """Resuming an older session must not overlap sessions that came after it."""
    entry = _seed_day(app, user, project)
    later = TimeEntry(
        user_id=user.id,
        project_id=project.id,
        start_time=entry.start_time.replace(hour=18),
        end_time=entry.start_time.replace(hour=19),
        source="manual",
    )
    db.session.add(later)
    db.session.commit()

    _post_timeline(
        client,
        "/dashboard/timeline/delete_event",
        entry_id=entry.id,
        event_type="clock_out",
    )

    assert entry.end_time is not None, "clock-out delete must be refused when later sessions exist"


def test_add_and_move_break(app, client, authenticated_client, user, project):
    entry = _seed_day(app, user, project)
    date = entry.start_time.strftime("%Y-%m-%d")

    _post_timeline(
        client,
        "/dashboard/timeline/add",
        event_kind="break",
        start_at=f"{date}T14:00",
        end_at=f"{date}T14:30",
    )

    breaks = [e for e in _events(entry.id) if e.event_type in ("break_start", "break_end")]
    assert [(e.occurred_at.strftime("%H:%M"), e.event_type) for e in breaks] == [
        ("12:00", "break_start"),
        ("13:00", "break_end"),
        ("14:00", "break_start"),
        ("14:30", "break_end"),
    ]
    assert entry.break_seconds == 5400

    second_start = breaks[2]
    _post_timeline(
        client,
        "/dashboard/timeline/edit",
        entry_id=entry.id,
        related_entry_id="",
        event_id=second_start.id,
        event_type="break_start",
        occurred_at=f"{date}T14:15",
    )
    assert second_start.occurred_at.strftime("%H:%M") == "14:15"
    # 60 min first break (12:00-13:00) + 15 min moved second break (14:15-14:30)
    assert entry.break_seconds == 75 * 60


def test_lane_assignment_is_group_scoped(app, client, authenticated_client, user, project):
    """Boundary markers keep their label row when break markers come and go."""
    from app.services.timer_event_service import build_timeline

    entry = _seed_day(app, user, project)
    today_entries = TimeEntry.query.filter_by(user_id=user.id, id=entry.id).all()

    before = {item["event_type"]: item["timeline_lane"] for item in build_timeline(user, today_entries)}
    break_end = next(e for e in _events(entry.id) if e.event_type == "break_end")
    db.session.delete(break_end)
    next(e for e in _events(entry.id) if e.event_type == "break_start")
    db.session.query(TimerEvent).filter(
        TimerEvent.time_entry_id == entry.id, TimerEvent.event_type == "break_start"
    ).delete(synchronize_session=False)
    entry.break_seconds = 0
    db.session.commit()

    after = {item["event_type"]: item["timeline_lane"] for item in build_timeline(user, today_entries)}
    assert after["clock_in"] == before["clock_in"]
    assert after["clock_out"] == before["clock_out"]


def test_dashboard_renders_now_indicator(app, client, authenticated_client, user, project):
    _seed_day(app, user, project)
    html = client.get("/dashboard").get_data(as_text=True)
    assert 'id="timeline-now-indicator"' in html
