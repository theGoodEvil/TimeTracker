import io
from datetime import datetime, time, timedelta
from pathlib import Path

from app import db
from app.models import ApiToken, Project, TimeEntry, TimerEvent
from app.models.time_entry import local_now
from app.services.weekly_work_service import WeeklyWorkService
from app.utils.template_filters import format_hours_minutes
from app.version import get_eviltime_version


def test_decimal_hours_are_rendered_as_hours_and_minutes():
    assert format_hours_minutes(-19.9) == "-19:54h"
    assert format_hours_minutes(-19.8) == "-19:48h"
    assert format_hours_minutes(1.5) == "1:30h"
    assert format_hours_minutes(0, show_plus=True) == "0:00h"
    assert format_hours_minutes(0.5, show_plus=True) == "+0:30h"


def test_eviltime_version_is_independent_from_upstream(monkeypatch):
    monkeypatch.delenv("EVILTIME_VERSION", raising=False)
    assert get_eviltime_version() == "5.11.4-evil"


def test_pdf_layout_preview_supports_get(admin_authenticated_client):
    response = admin_authenticated_client.get("/admin/pdf-layout/preview")
    assert response.status_code == 200
    assert response.mimetype in {"application/pdf", "text/html"}


def test_productivity_dashboard_contains_live_refresh(authenticated_client, active_timer):
    response = authenticated_client.get("/dashboard/productivity")
    assert response.status_code == 200
    assert b"setInterval" in response.data
    assert b"active_timer" in response.data


def test_dashboard_renders_running_timer_before_javascript(authenticated_client, active_timer):
    active_timer.start_time = local_now() - timedelta(minutes=5)
    db.session.commit()

    response = authenticated_client.get("/dashboard")

    assert response.status_code == 200
    assert b'id="eviltime-active-timer"' in response.data
    assert b">00:05:" in response.data
    assert b'data-timer-running="true"' in response.data
    assert b"Clocked in at" in response.data


def test_read_only_timeline_events_are_not_interactive_buttons(authenticated_client, active_timer, user, monkeypatch):
    monkeypatch.setattr(user.__class__, "has_permission", lambda self, permission: False)

    response = authenticated_client.get("/dashboard")

    assert response.status_code == 200
    assert b'data-can-edit="false"' in response.data
    assert b"<div data-timeline-event" in response.data
    assert b'<button type="button" data-timeline-event' not in response.data
    assert b"data-timeline-edit" not in response.data
    assert b'id="timelineEditModal"' not in response.data


def test_paused_dashboard_and_status_show_live_break_duration(authenticated_client, active_timer):
    active_timer.paused_at = local_now() - timedelta(minutes=2)
    db.session.commit()

    status_response = authenticated_client.get("/timer/status")
    assert status_response.status_code == 200
    assert status_response.get_json()["timer"]["paused_duration_seconds"] >= 120

    dashboard_response = authenticated_client.get("/dashboard")
    assert dashboard_response.status_code == 200
    assert b"Current break" in dashboard_response.data
    assert b'data-timer-display="break"' in dashboard_response.data
    assert b">00:02:" in dashboard_response.data
    assert b"Break started at" in dashboard_response.data


def test_shared_timer_control_json_actions(authenticated_client, active_timer, multiple_projects):
    paused = authenticated_client.post("/api/timer/pause-current")
    assert paused.status_code == 200
    db.session.refresh(active_timer)
    assert active_timer.paused_at is not None

    resumed = authenticated_client.post("/api/timer/resume-current")
    assert resumed.status_code == 200
    db.session.refresh(active_timer)
    assert active_timer.paused_at is None

    switched = authenticated_client.post(
        "/api/timer/switch",
        json={"project_id": multiple_projects[0].id},
    )
    assert switched.status_code == 200
    assert switched.get_json()["timer"]["project_id"] == multiple_projects[0].id


def test_dashboard_identifies_project_switch(authenticated_client, active_timer, user, project):
    active_timer.start_time = local_now() - timedelta(minutes=5)
    previous_start = active_timer.start_time - timedelta(hours=1)
    db.session.add(
        TimeEntry(
            user_id=user.id,
            project_id=project.id,
            start_time=previous_start,
            end_time=active_timer.start_time,
            duration_seconds=3600,
            source="auto",
        )
    )
    db.session.commit()

    response = authenticated_client.get("/dashboard")
    assert response.status_code == 200
    assert b"Switched project at" in response.data


def test_dashboard_behaviour_is_in_compiled_source():
    source = Path("app/static/eviltime-workflow.js").read_text(encoding="utf-8")
    assert "drawTimers" in source
    assert "eviltime-week-actual" in source
    assert "eviltime-week-today" in source
    assert "Notification.requestPermission" in source
    assert "data-week-edit" in source
    assert "initWeeklyHoursPreviews" in source
    assert "normalizedWeekStart" in source
    assert "Math.max(0, trackedHours + adjustmentHours)" in source
    assert "isCounted ? actualHours - expectedHours : 0" in source
    assert "eviltime-time-balance" in source
    assert "data-timeline-edit" in source
    assert "ctxRelatedEntryId" in source
    assert "confirmSwitch" in source
    assert "timelineConfirmModal" in source
    assert "grabOffset" in source
    assert "snappedMinute" in source

    palette_source = Path("app/static/js/command-palette.js").read_text(encoding="utf-8")
    assert "input?.addEventListener('keydown', onPaletteKeydown)" in palette_source
    assert "setMode('projects'" in palette_source
    assert "setMode('edit-project'" in palette_source
    assert "setMode('view-project'" in palette_source
    assert "closePalette();\n        setTimeout" not in palette_source

    timer_source = Path("app/static/timer-control.js").read_text(encoding="utf-8")
    assert "/api/timer/switch" in timer_source
    assert "action + '-current'" in timer_source


def test_dashboard_project_bubbles_scroll_and_week_has_no_daily_target(authenticated_client, multiple_projects):
    response = authenticated_client.get("/dashboard")
    assert response.status_code == 200
    assert b"overflow-x-auto" in response.data
    assert b"hover:scale-110" in response.data
    assert b"expected_hours" not in response.data
    assert b"Time balance" in response.data
    assert b">Sat<" not in response.data
    assert b">Sun<" not in response.data


def test_weekend_is_shown_when_it_has_tracked_time(app, user, project):
    week_start = WeeklyWorkService.week_start(local_now().date(), user)
    saturday = week_start + timedelta(days=5)
    db.session.add(
        TimeEntry(
            user_id=user.id,
            project_id=project.id,
            start_time=datetime.combine(saturday, time(hour=10)),
            end_time=datetime.combine(saturday, time(hour=11)),
            duration_seconds=3600,
        )
    )
    db.session.commit()

    days = WeeklyWorkService.current_week_days(user)
    assert [day["weekday_index"] for day in days] == [0, 1, 2, 3, 4, 5]


def test_week_edit_uses_viewport_modal(authenticated_client):
    response = authenticated_client.get("/goals")
    assert response.status_code == 200
    assert b'id="weeklyEditModal"' in response.data
    assert b"fixed inset-0" in response.data


def test_project_icon_can_be_uploaded_and_served(admin_authenticated_client, app, project, tmp_path):
    app.config["UPLOAD_FOLDER"] = str(tmp_path)
    project_id = project.id
    png_data = b"\x89PNG\r\n\x1a\nproject-icon-test"
    response = admin_authenticated_client.post(
        f"/projects/{project_id}/edit",
        data={
            "name": project.name,
            "client_id": str(project.client_id),
            "description": project.description or "",
            "billable": "on",
            "hourly_rate": str(project.hourly_rate or ""),
            "project_icon_type": "png",
            "project_icon": (io.BytesIO(png_data), "project.png"),
        },
        content_type="multipart/form-data",
    )
    assert response.status_code == 302

    db.session.expire_all()
    saved_project = db.session.get(Project, project_id)
    assert saved_project.icon_filename.endswith(".png")
    assert saved_project.icon_emoji is None
    icon_response = admin_authenticated_client.get(f"/uploads/project-icons/{saved_project.icon_filename}")
    assert icon_response.status_code == 200
    assert icon_response.data == png_data


def test_project_icon_can_use_emoji_and_is_rendered_on_dashboard(admin_authenticated_client, project):
    project.icon_filename = "old-project.png"
    db.session.commit()

    response = admin_authenticated_client.post(
        f"/projects/{project.id}/edit",
        data={
            "name": project.name,
            "client_id": str(project.client_id),
            "description": project.description or "",
            "billable": "on",
            "hourly_rate": str(project.hourly_rate or ""),
            "project_icon_type": "emoji",
            "project_icon_emoji": "🐙",
        },
    )
    assert response.status_code == 302

    db.session.expire_all()
    saved_project = db.session.get(Project, project.id)
    assert saved_project.icon_emoji == "🐙"
    assert saved_project.icon_filename is None

    dashboard = admin_authenticated_client.get("/dashboard")
    assert dashboard.status_code == 200
    assert "🐙".encode() in dashboard.data


def test_project_icon_picker_only_accepts_valid_png(admin_authenticated_client, project, tmp_path, app):
    app.config["UPLOAD_FOLDER"] = str(tmp_path)
    response = admin_authenticated_client.post(
        f"/projects/{project.id}/edit",
        data={
            "name": project.name,
            "client_id": str(project.client_id),
            "project_icon_type": "png",
            "project_icon": (io.BytesIO(b"not a png"), "project.png"),
        },
        content_type="multipart/form-data",
    )
    assert response.status_code == 200
    assert b"Project icons must be valid PNG files" in response.data


def test_project_forms_render_emoji_png_selector(admin_authenticated_client, project):
    create_response = admin_authenticated_client.get("/projects/create")
    edit_response = admin_authenticated_client.get(f"/projects/{project.id}/edit")

    assert create_response.status_code == 200
    assert edit_response.status_code == 200
    for response in (create_response, edit_response):
        assert b"data-project-icon-picker" in response.data
        assert b'data-project-icon-mode="emoji"' in response.data
        assert b'data-project-icon-mode="png"' in response.data
        assert b"data-project-emoji-picker-host" in response.data
        assert b"vendor/emoji-picker-data/en.json" in response.data
        assert b'accept="image/png,.png"' in response.data


def test_each_user_can_create_and_revoke_a_general_mcp_token(authenticated_client, user):
    page = authenticated_client.get("/settings/mcp")
    assert page.status_code == 200
    assert b"/mcp" in page.data

    created = authenticated_client.post(
        "/settings/mcp/tokens",
        data={"name": "Old tracker migration", "expires_days": "30"},
    )
    assert created.status_code == 200
    assert b"tt_" in created.data
    token = ApiToken.query.filter_by(user_id=user.id, scopes="mcp:access").one()
    assert token.is_active is True

    revoked = authenticated_client.post(f"/settings/mcp/tokens/{token.id}/revoke")
    assert revoked.status_code == 302
    db.session.refresh(token)
    assert token.is_active is False


def test_mcp_import_is_user_scoped_and_retry_safe(client, user, project):
    token, plain = ApiToken.create_token(
        user_id=user.id,
        name="MCP migration",
        scopes="mcp:migrate",
        expires_days=30,
    )
    db.session.add(token)
    db.session.commit()
    headers = {"Authorization": f"Bearer {plain}", "Accept": "application/json"}

    initialized = client.post(
        "/mcp",
        json={"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18"}},
        headers=headers,
    )
    assert initialized.status_code == 200
    assert initialized.get_json()["result"]["serverInfo"]["name"] == "EvilTime MCP"

    context = client.post(
        "/mcp",
        json={
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {"name": "eviltime_get_migration_context", "arguments": {}},
        },
        headers=headers,
    ).get_json()["result"]["structuredContent"]
    assert project.id in [item["id"] for item in context["projects"]]

    call = {
        "jsonrpc": "2.0",
        "id": 3,
        "method": "tools/call",
        "params": {
            "name": "eviltime_import_time_entries",
            "arguments": {
                "entries": [
                    {
                        "project_id": project.id,
                        "start": "2024-01-02T09:00:00Z",
                        "end": "2024-01-02T10:30:00Z",
                        "notes": "Migrated from old tracker",
                    }
                ]
            },
        },
    }
    first = client.post("/mcp", json=call, headers=headers).get_json()["result"]["structuredContent"]
    second = client.post("/mcp", json=call, headers=headers).get_json()["result"]["structuredContent"]
    assert first["created"] == 1
    assert second["duplicates"] == 1
    assert TimeEntry.query.filter_by(user_id=user.id, notes="Migrated from old tracker").count() == 1


def test_mcp_rejects_tokens_without_migration_scope(client, user):
    token, plain = ApiToken.create_token(user_id=user.id, name="Regular API", scopes="read:time_entries")
    db.session.add(token)
    db.session.commit()

    response = client.post(
        "/mcp",
        json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
        headers={"Authorization": f"Bearer {plain}"},
    )
    assert response.status_code == 403


def test_general_mcp_lists_everyday_and_openapi_tools(client, user, project):
    token, plain = ApiToken.create_token(user_id=user.id, name="General MCP", scopes="mcp:access")
    db.session.add(token)
    db.session.commit()
    headers = {"Authorization": f"Bearer {plain}"}

    response = client.post(
        "/mcp",
        json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
        headers=headers,
    )

    tools = response.get_json()["result"]["tools"]
    names = {tool["name"] for tool in tools}
    # Built-in helper tools
    assert {"eviltime_get_context", "eviltime_list_projects", "eviltime_timer"} <= names
    # Dynamic OpenAPI-wrapped tools
    assert {"api_get_projects", "api_post_projects", "api_get_time_entries", "api_get_tasks", "api_get_info"} <= names


def test_dynamic_mcp_executes_openapi_endpoints(client, user, project):
    token, plain = ApiToken.create_token(
        user_id=user.id, name="Full MCP", scopes="mcp:access,read:projects,write:tasks"
    )
    db.session.add(token)
    db.session.commit()
    headers = {"Authorization": f"Bearer {plain}"}

    # Call api_get_info
    resp_info = client.post(
        "/mcp",
        json={"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "api_get_info", "arguments": {}}},
        headers=headers,
    )
    info_data = resp_info.get_json()
    assert "result" in info_data
    assert info_data["result"]["isError"] is False
    assert "api_version" in info_data["result"]["structuredContent"]

    # Call api_get_projects
    resp_projects = client.post(
        "/mcp",
        json={
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {"name": "api_get_projects", "arguments": {"status": "active"}},
        },
        headers=headers,
    )
    proj_data = resp_projects.get_json()
    assert "result" in proj_data
    assert proj_data["result"]["isError"] is False
    assert "projects" in proj_data["result"]["structuredContent"]
    project_names = [p["name"] for p in proj_data["result"]["structuredContent"]["projects"]]
    assert project.name in project_names


def test_dashboard_timeline_records_breaks_and_uses_overlay(authenticated_client, active_timer):
    paused = authenticated_client.post("/timer/pause")
    assert paused.status_code == 302
    resumed = authenticated_client.post("/timer/resume")
    assert resumed.status_code == 302

    event_types = [event.event_type for event in TimerEvent.query.filter_by(time_entry_id=active_timer.id).all()]
    assert event_types == ["break_start", "break_end"]
    dashboard = authenticated_client.get("/dashboard")
    assert dashboard.status_code == 200
    assert b'id="timelineEditModal"' in dashboard.data
    assert b'id="timelineAddModal"' in dashboard.data
    assert b'id="timelineConfirmModal"' in dashboard.data
    assert b"data-timeline-track" in dashboard.data
    assert b"08:00" in dashboard.data
    assert b"20:00" in dashboard.data
    assert b"Break started" in dashboard.data
    assert b"Break ended" in dashboard.data


def test_timeline_can_insert_retroactive_break(authenticated_client, user, project, monkeypatch):
    now = datetime.combine(local_now().date(), time(hour=15))
    monkeypatch.setattr("app.routes.main.local_now", lambda: now)
    entry = TimeEntry(
        user_id=user.id,
        project_id=project.id,
        start_time=now - timedelta(hours=3),
        end_time=now - timedelta(minutes=15),
        source="auto",
    )
    db.session.add(entry)
    db.session.commit()
    break_start = now - timedelta(hours=2)
    break_end = break_start + timedelta(minutes=25)

    response = authenticated_client.post(
        "/dashboard/timeline/add",
        data={
            "event_kind": "break",
            "start_at": break_start.strftime("%Y-%m-%dT%H:%M"),
            "end_at": break_end.strftime("%Y-%m-%dT%H:%M"),
        },
    )

    assert response.status_code == 302
    db.session.refresh(entry)
    assert entry.break_seconds == 25 * 60
    assert entry.duration_seconds == int((entry.end_time - entry.start_time).total_seconds()) - 25 * 60
    assert [
        event.event_type
        for event in TimerEvent.query.filter_by(time_entry_id=entry.id).order_by(TimerEvent.occurred_at).all()
    ] == ["break_start", "break_end"]


def test_timeline_can_insert_completed_project_session(authenticated_client, user, project, monkeypatch):
    now = datetime.combine(local_now().date(), time(hour=15))
    monkeypatch.setattr("app.routes.main.local_now", lambda: now)
    end = now - timedelta(minutes=10)
    start = end - timedelta(minutes=40)

    response = authenticated_client.post(
        "/dashboard/timeline/add",
        data={
            "event_kind": "work_session",
            "project_id": project.id,
            "start_at": start.strftime("%Y-%m-%dT%H:%M"),
            "end_at": end.strftime("%Y-%m-%dT%H:%M"),
        },
    )

    assert response.status_code == 302
    entry = TimeEntry.query.filter_by(user_id=user.id, project_id=project.id, start_time=start).one()
    assert entry.duration_seconds == 40 * 60
    assert [
        event.event_type
        for event in TimerEvent.query.filter_by(time_entry_id=entry.id).order_by(TimerEvent.occurred_at).all()
    ] == ["clock_in", "clock_out"]


def test_timeline_break_edit_recalculates_duration(authenticated_client, user, project):
    today = local_now().date()
    entry = TimeEntry(
        user_id=user.id,
        project_id=project.id,
        start_time=datetime.combine(today, time(hour=9)),
        end_time=datetime.combine(today, time(hour=12)),
        break_seconds=1800,
        source="auto",
    )
    db.session.add(entry)
    db.session.flush()
    break_start = TimerEvent(
        user_id=user.id,
        time_entry_id=entry.id,
        event_type="break_start",
        occurred_at=datetime.combine(today, time(hour=10)),
    )
    break_end = TimerEvent(
        user_id=user.id,
        time_entry_id=entry.id,
        event_type="break_end",
        occurred_at=datetime.combine(today, time(hour=10, minute=30)),
    )
    db.session.add_all([break_start, break_end])
    db.session.commit()

    response = authenticated_client.post(
        "/dashboard/timeline/edit",
        data={
            "event_id": break_start.id,
            "entry_id": entry.id,
            "event_type": "break_start",
            "occurred_at": datetime.combine(today, time(hour=10, minute=15)).strftime("%Y-%m-%dT%H:%M"),
        },
    )
    assert response.status_code == 302
    db.session.refresh(entry)
    db.session.refresh(break_start)
    assert entry.break_seconds == 900
    assert entry.duration_seconds == 9900
    assert break_start.occurred_at.minute == 15


def test_timeline_deduplicates_duplicate_clock_outs_and_overlapping_breaks(user, project):
    from app.services.timer_event_service import build_timeline

    today = local_now().date()
    entry = TimeEntry(
        user_id=user.id,
        project_id=project.id,
        start_time=datetime.combine(today, time(hour=9)),
        end_time=datetime.combine(today, time(hour=12)),
        break_seconds=1800,
        source="auto",
    )
    db.session.add(entry)
    db.session.flush()
    # Add two clock_out events (duplicate) and a break_end at the exact same time as clock_out
    e1 = TimerEvent(user_id=user.id, time_entry_id=entry.id, event_type="clock_in", occurred_at=entry.start_time)
    e2 = TimerEvent(
        user_id=user.id,
        time_entry_id=entry.id,
        event_type="break_start",
        occurred_at=datetime.combine(today, time(hour=11, minute=30)),
    )
    e3 = TimerEvent(user_id=user.id, time_entry_id=entry.id, event_type="break_end", occurred_at=entry.end_time)
    e4 = TimerEvent(user_id=user.id, time_entry_id=entry.id, event_type="clock_out", occurred_at=entry.end_time)
    e5 = TimerEvent(user_id=user.id, time_entry_id=entry.id, event_type="clock_out", occurred_at=entry.end_time)
    db.session.add_all([e1, e2, e3, e4, e5])
    db.session.commit()

    timeline = build_timeline(user, [entry])
    event_types = [item["event_type"] for item in timeline]
    # No duplicate clock_out and no duplicate break_end overlapping at exact clock_out
    assert event_types == ["clock_in", "break_start", "clock_out"]
