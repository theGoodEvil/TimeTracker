"""Automatic clock-out after the daily standard hours."""

from datetime import datetime, timedelta

import pytest

from app import db
from app.models import AutoClockOutState, TimeEntry, TimerEvent
from app.services.auto_clock_out_service import GRACE_MINUTES, AutoClockOutService

DAY = datetime(2026, 9, 9)


def at(hour, minute=0):
    return DAY.replace(hour=hour, minute=minute)


@pytest.fixture
def eight_hour_user(app, user):
    user.standard_hours_per_day = 8.0
    user.auto_clock_out_enabled = True
    user.time_rounding_enabled = False
    db.session.commit()
    return user


def start_entry(user, project, start, **extra):
    entry = TimeEntry(user_id=user.id, project_id=project.id, start_time=start, source="auto", **extra)
    db.session.add(entry)
    db.session.commit()
    return entry


def add_break(entry, start, end):
    db.session.add_all(
        [
            TimerEvent(user_id=entry.user_id, time_entry_id=entry.id, event_type="break_start", occurred_at=start),
            TimerEvent(user_id=entry.user_id, time_entry_id=entry.id, event_type="break_end", occurred_at=end),
        ]
    )
    entry.break_seconds = (entry.break_seconds or 0) + int((end - start).total_seconds())
    db.session.commit()


def state_for(user):
    return AutoClockOutState.query.filter_by(user_id=user.id, work_date=DAY.date()).first()


def test_no_warning_before_standard_hours(app, eight_hour_user, project):
    entry = start_entry(eight_hour_user, project, at(9))

    assert AutoClockOutService().process_entry(entry, now=at(16, 59)) is None
    assert entry.end_time is None
    assert state_for(eight_hour_user) is None


def test_warns_at_standard_hours_and_waits_for_grace_period(app, eight_hour_user, project):
    service = AutoClockOutService()
    entry = start_entry(eight_hour_user, project, at(9))

    assert service.process_entry(entry, now=at(17, 1)) == "warned"
    state = state_for(eight_hour_user)
    assert state.warned_entry_id == entry.id
    assert state.deadline_at == at(17, 1) + timedelta(minutes=GRACE_MINUTES)

    # Warning is sent once; still inside the grace period.
    assert service.process_entry(entry, now=at(17, 10)) is None
    assert entry.end_time is None
    assert service.status(eight_hour_user, entry, now=at(17, 10))["warning_active"] is True


def test_clocks_out_at_the_moment_hours_were_reached(app, eight_hour_user, project):
    service = AutoClockOutService()
    entry = start_entry(eight_hour_user, project, at(9))
    service.process_entry(entry, now=at(17, 1))

    assert service.process_entry(entry, now=at(17, 16)) == "clocked_out"

    db.session.refresh(entry)
    assert entry.end_time == at(17)
    assert entry.duration_seconds == 8 * 3600
    assert "Automatically clocked out" in entry.notes
    assert TimerEvent.query.filter_by(time_entry_id=entry.id, event_type="clock_out").count() == 1
    state = state_for(eight_hour_user)
    assert state.auto_clocked_out_at == at(17, 16)
    assert state.deadline_at is None


def test_extension_postpones_clock_out(app, eight_hour_user, project):
    service = AutoClockOutService()
    entry = start_entry(eight_hour_user, project, at(9))
    service.process_entry(entry, now=at(17, 1))

    result = service.extend(eight_hour_user, 60)
    assert result["success"] is True
    assert result["limit_seconds"] == 9 * 3600

    assert service.process_entry(entry, now=at(17, 30)) is None
    assert entry.end_time is None
    # The extended limit is enforced the same way.
    assert service.process_entry(entry, now=at(18, 0)) == "warned"
    assert service.process_entry(entry, now=at(18, 15)) == "clocked_out"
    db.session.refresh(entry)
    assert entry.end_time == at(18)


def test_break_after_limit_is_not_counted_as_work(app, eight_hour_user, project):
    service = AutoClockOutService()
    entry = start_entry(eight_hour_user, project, at(9))
    service.process_entry(entry, now=at(17, 0))
    # User ignored the reminder, took a break 17:05–17:25 and kept working.
    add_break(entry, at(17, 5), at(17, 25))

    assert service.process_entry(entry, now=at(17, 30)) == "clocked_out"

    db.session.refresh(entry)
    assert entry.end_time == at(17)
    assert entry.break_seconds == 0
    assert entry.duration_seconds == 8 * 3600
    assert TimerEvent.query.filter_by(time_entry_id=entry.id, event_type="break_start").count() == 0


def test_breaks_before_limit_extend_the_clock_out_time(app, eight_hour_user, project):
    service = AutoClockOutService()
    entry = start_entry(eight_hour_user, project, at(9))
    add_break(entry, at(12), at(12, 30))

    assert service.process_entry(entry, now=at(17, 15)) is None
    assert service.process_entry(entry, now=at(17, 31)) == "warned"
    assert service.process_entry(entry, now=at(17, 46)) == "clocked_out"

    db.session.refresh(entry)
    assert entry.end_time == at(17, 30)
    assert entry.break_seconds == 30 * 60
    assert entry.duration_seconds == 8 * 3600


def test_paused_timer_is_clocked_out_after_grace(app, eight_hour_user, project):
    service = AutoClockOutService()
    entry = start_entry(eight_hour_user, project, at(9))
    service.process_entry(entry, now=at(17, 2))
    entry.paused_at = at(17, 3)
    db.session.add(
        TimerEvent(user_id=entry.user_id, time_entry_id=entry.id, event_type="break_start", occurred_at=at(17, 3))
    )
    db.session.commit()

    assert service.process_entry(entry, now=at(17, 20)) == "clocked_out"

    db.session.refresh(entry)
    assert entry.paused_at is None
    assert entry.end_time == at(17)
    assert entry.break_seconds == 0


def test_hours_count_across_project_switches(app, eight_hour_user, project):
    service = AutoClockOutService()
    first = TimeEntry(
        user_id=eight_hour_user.id, project_id=project.id, start_time=at(8), end_time=at(13), source="auto"
    )
    db.session.add(first)
    db.session.commit()
    second = start_entry(eight_hour_user, project, at(13))

    assert service.process_entry(second, now=at(15, 59)) is None
    assert service.process_entry(second, now=at(16, 0)) == "warned"
    assert service.process_entry(second, now=at(16, 15)) == "clocked_out"
    db.session.refresh(second)
    assert second.end_time == at(16)


def test_clocking_in_again_gets_a_fresh_grace_period(app, eight_hour_user, project):
    service = AutoClockOutService()
    first = start_entry(eight_hour_user, project, at(9))
    service.process_entry(first, now=at(17))
    service.process_entry(first, now=at(17, 15))

    second = start_entry(eight_hour_user, project, at(17, 40))
    assert service.process_entry(second, now=at(17, 41)) == "warned"
    assert service.process_entry(second, now=at(17, 50)) is None
    assert second.end_time is None


def test_disabled_user_is_never_clocked_out(app, eight_hour_user, project):
    eight_hour_user.auto_clock_out_enabled = False
    db.session.commit()
    entry = start_entry(eight_hour_user, project, at(9))

    assert AutoClockOutService().process_entry(entry, now=at(20)) is None
    assert AutoClockOutService().run(now=at(20))["checked"] == 0
    assert entry.end_time is None


def test_stale_timer_from_previous_day_is_capped(app, eight_hour_user, project):
    service = AutoClockOutService()
    entry = start_entry(eight_hour_user, project, at(9))
    next_morning = at(9) + timedelta(days=1)

    assert service.process_entry(entry, now=next_morning) == "warned"
    assert service.process_entry(entry, now=next_morning + timedelta(minutes=16)) == "clocked_out"
    db.session.refresh(entry)
    assert entry.end_time == at(17)


def test_invalid_extension_is_rejected(app, eight_hour_user, project):
    start_entry(eight_hour_user, project, at(9))
    assert AutoClockOutService().extend(eight_hour_user, 0)["success"] is False
    assert AutoClockOutService().extend(eight_hour_user, "abc")["success"] is False


def test_extend_route(app, authenticated_client, eight_hour_user, project):
    start_entry(eight_hour_user, project, at(9))
    response = authenticated_client.post(
        "/timer/extend-workday", data={"minutes": 30}, headers={"X-Requested-With": "XMLHttpRequest"}
    )
    assert response.status_code == 200
    assert response.get_json()["extension_minutes"] == 30


def test_settings_toggle_persists(app, authenticated_client, eight_hour_user):
    response = authenticated_client.post("/settings", data={"standard_hours_per_day": "8"}, follow_redirects=False)
    assert response.status_code in (302, 303)
    db.session.refresh(eight_hour_user)
    assert eight_hour_user.auto_clock_out_enabled is False

    authenticated_client.post("/settings", data={"standard_hours_per_day": "8", "auto_clock_out_enabled": "on"})
    db.session.refresh(eight_hour_user)
    assert eight_hour_user.auto_clock_out_enabled is True


def test_dashboard_shows_warning_with_extend_buttons(app, authenticated_client, eight_hour_user, project):
    from app.models.time_entry import local_now

    now = local_now()
    entry = start_entry(eight_hour_user, project, now - timedelta(hours=8, minutes=5))
    AutoClockOutService().process_entry(entry, now=now)

    response = authenticated_client.get("/dashboard")
    assert response.status_code == 200
    assert b"eviltime-overtime-warning" in response.data
    assert b"/timer/extend-workday" in response.data


def test_dashboard_shows_expected_clock_out_time(app, authenticated_client, eight_hour_user, project):
    from app.models.time_entry import local_now

    start_entry(eight_hour_user, project, local_now() - timedelta(hours=1))

    response = authenticated_client.get("/dashboard")
    assert response.status_code == 200
    assert b"eviltime-overtime-warning" not in response.data
    assert b"fa-hourglass-half" in response.data
