"""Regression tests for dashboard timeline mutations (add / edit / delete events)."""

from datetime import datetime, timedelta, timezone as dt_timezone

from app import db
from app.models import Project, TimeEntry, TimerEvent
from app.services.timer_event_service import current_timeline_position


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


def _second_project(user, project):
    second = Project(
        name="Second Project",
        client_id=project.client_id,
        created_by=user.id,
        status="active",
    )
    db.session.add(second)
    db.session.commit()
    return second


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


def test_move_clock_in_recomputes_clamped_break(app, client, authenticated_client, user, project):
    entry = _seed_day(app, user, project)
    date = entry.start_time.strftime("%Y-%m-%d")

    _post_timeline(
        client,
        "/dashboard/timeline/edit",
        entry_id=entry.id,
        event_type="clock_in",
        occurred_at=f"{date}T12:30",
    )

    db.session.refresh(entry)
    breaks = [event for event in _events(entry.id) if event.event_type in ("break_start", "break_end")]
    assert [event.occurred_at.strftime("%H:%M") for event in breaks] == ["12:30", "13:00"]
    assert entry.break_seconds == 30 * 60
    assert entry.duration_seconds == 4 * 60 * 60


def test_move_clock_out_recomputes_clamped_break(app, client, authenticated_client, user, project):
    entry = _seed_day(app, user, project)
    date = entry.start_time.strftime("%Y-%m-%d")

    _post_timeline(
        client,
        "/dashboard/timeline/edit",
        entry_id=entry.id,
        event_type="clock_out",
        occurred_at=f"{date}T12:30",
    )

    db.session.refresh(entry)
    breaks = [event for event in _events(entry.id) if event.event_type in ("break_start", "break_end")]
    assert [event.occurred_at.strftime("%H:%M") for event in breaks] == ["12:00", "12:30"]
    assert entry.break_seconds == 30 * 60
    assert entry.duration_seconds == 4 * 60 * 60


def test_break_edit_cannot_extend_work_session(app, client, authenticated_client, user, project):
    entry = _seed_day(app, user, project)
    date = entry.start_time.strftime("%Y-%m-%d")
    break_end = next(event for event in _events(entry.id) if event.event_type == "break_end")

    response = _post_timeline(
        client,
        "/dashboard/timeline/edit",
        entry_id=entry.id,
        event_id=break_end.id,
        event_type="break_end",
        occurred_at=f"{date}T18:00",
    )

    db.session.refresh(entry)
    db.session.refresh(break_end)
    assert b"The break event cannot end after clock-out." in response.data
    assert entry.end_time.strftime("%H:%M") == "17:00"
    assert break_end.occurred_at.strftime("%H:%M") == "13:00"
    assert entry.break_seconds == 60 * 60


def test_project_switch_inside_break_is_rejected(app, client, authenticated_client, user, project):
    entry = _seed_day(app, user, project)
    second_project = _second_project(user, project)
    date = entry.start_time.strftime("%Y-%m-%d")

    response = _post_timeline(
        client,
        "/dashboard/timeline/add",
        event_kind="project_switch",
        project_id=second_project.id,
        start_at=f"{date}T12:30",
    )

    assert b"A project switch cannot be placed inside a break." in response.data
    assert TimeEntry.query.filter_by(user_id=user.id).count() == 1
    assert TimerEvent.query.filter_by(user_id=user.id, event_type="project_switch").count() == 0
    assert [(event.event_type, event.occurred_at.strftime("%H:%M")) for event in _events(entry.id)] == [
        ("clock_in", "08:00"),
        ("break_start", "12:00"),
        ("break_end", "13:00"),
        ("clock_out", "17:00"),
    ]


def test_project_switch_on_break_start_moves_whole_pair(app, client, authenticated_client, user, project):
    entry = _seed_day(app, user, project)
    second_project = _second_project(user, project)
    date = entry.start_time.strftime("%Y-%m-%d")

    _post_timeline(
        client,
        "/dashboard/timeline/add",
        event_kind="project_switch",
        project_id=second_project.id,
        start_at=f"{date}T12:00",
    )

    new_entry = TimeEntry.query.filter_by(user_id=user.id, project_id=second_project.id).one()
    db.session.refresh(entry)
    assert [event.event_type for event in _events(entry.id)] == ["clock_in"]
    assert [event.event_type for event in _events(new_entry.id)] == [
        "break_start",
        "project_switch",
        "break_end",
        "clock_out",
    ]
    assert entry.break_seconds == 0
    assert new_entry.break_seconds == 60 * 60


def test_project_switch_preserves_active_pause_state(app, client, authenticated_client, user, project):
    date = datetime.utcnow().replace(hour=8, minute=0, second=0, microsecond=0)
    entry = TimeEntry(
        user_id=user.id,
        project_id=project.id,
        start_time=date,
        paused_at=date.replace(hour=8, minute=45),
        source="auto",
    )
    db.session.add(entry)
    db.session.flush()
    break_start = TimerEvent(
        user_id=user.id,
        time_entry_id=entry.id,
        event_type="break_start",
        occurred_at=entry.paused_at,
    )
    db.session.add(break_start)
    db.session.commit()
    second_project = _second_project(user, project)

    _post_timeline(
        client,
        "/dashboard/timeline/add",
        event_kind="project_switch",
        project_id=second_project.id,
        start_at=f"{date.strftime('%Y-%m-%d')}T08:30",
    )

    new_entry = TimeEntry.query.filter_by(user_id=user.id, project_id=second_project.id).one()
    db.session.refresh(entry)
    db.session.refresh(break_start)
    assert entry.end_time.strftime("%H:%M") == "08:30"
    assert entry.paused_at is None
    assert new_entry.end_time is None
    assert new_entry.paused_at.strftime("%H:%M") == "08:45"
    assert break_start.time_entry_id == new_entry.id


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


def test_dashboard_timeline_visuals_share_one_axis(app, client, authenticated_client, user, project):
    """Track, events, hover preview, and now marker must use one CSS axis coordinate."""
    _seed_day(app, user, project)
    html = client.get("/dashboard").get_data(as_text=True)

    assert 'class="timeline-track ' in html
    assert 'class="timeline-axis ' in html
    assert 'class="timeline-segment ' in html
    assert 'class="timeline-hour ' in html
    assert 'class="timeline-hover-indicator hidden"' in html
    assert 'class="timeline-now-dot ' in html
    assert 'class="timeline-event-dot ' in html

    css = app.root_path + "/static/src/input.css"
    with open(css, encoding="utf-8") as stylesheet:
        source = stylesheet.read()
    assert ".timeline-track { --timeline-axis-y:" in source
    assert source.count("top: var(--timeline-axis-y);") == 2


def test_now_position_uses_user_timezone(app, user):
    """The now-marker must sit where 'now' falls in the USER's timezone, matching displayed times."""
    from app.utils.timezone import get_timezone_for_user

    user.timezone = "Asia/Tokyo"
    db.session.commit()

    # 03:00 UTC == 12:00 Tokyo on the same day
    now_utc = datetime(2026, 8, 22, 3, 0, tzinfo=dt_timezone.utc)
    position = current_timeline_position(now=now_utc, user=user)

    tokyo_minute = 12 * 60  # 12:00 local
    span = (22 - 8) * 60
    expected = (tokyo_minute - 8 * 60) / span * 100
    assert abs(position - expected) < 0.01

    # Sanity: the app timezone differs from Tokyo, so the naive UTC reading must NOT match
    utc_position = (3 * 60 - 8 * 60) / span * 100
    assert abs(position - utc_position) > 1
    assert get_timezone_for_user(user).key == "Asia/Tokyo"


def test_marker_positions_match_displayed_user_time(app, client, authenticated_client, user, project):
    """Marker percent positions must be computed on the same clock as the printed labels."""
    entry = _seed_day(app, user, project)
    from app.services.timer_event_service import build_timeline

    # App tz is Europe/Rome; put the viewer in Tokyo (+7h ahead in August).
    user.timezone = "Asia/Tokyo"
    db.session.commit()

    timeline = build_timeline(user, TimeEntry.query.filter_by(id=entry.id).all())
    by_type = {item["event_type"]: item for item in timeline if item["event_type"] != "clock_out"}

    # clock_in stored at 08:00 Rome == 15:00 Tokyo; label shows 15:00 via |user_time.
    shown_minute = 15 * 60 + ((entry.start_time.minute) or 0)
    expected = (shown_minute - 8 * 60) / ((22 - 8) * 60) * 100
    assert abs(by_type["clock_in"]["timeline_position"] - expected) < 0.01


def test_timeline_uses_one_user_timezone_clock_for_defaults_and_now_marker(app):
    with open(app.root_path + "/static/eviltime-workflow.js", encoding="utf-8") as script:
        source = script.read()

    assert "function createTimelineClock(track)" in source
    assert source.count("var timelineClock = createTimelineClock(track);") == 2
    assert "var now = timelineClock.read(new Date());" in source
    assert "now.date !== track.dataset.date" in source
    assert "now.getHours()" not in source
