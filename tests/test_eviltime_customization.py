import io
from datetime import datetime, time, timedelta
from pathlib import Path

from app import db
from app.models import Project, TimeEntry
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
    assert "Notification.requestPermission" in source
    assert "data-week-edit" in source


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
    response = admin_authenticated_client.post(
        f"/projects/{project_id}/edit",
        data={
            "name": project.name,
            "client_id": str(project.client_id),
            "description": project.description or "",
            "billable": "on",
            "hourly_rate": str(project.hourly_rate or ""),
            "project_icon": (io.BytesIO(b"valid-enough-for-upload-validation"), "project.webp"),
        },
        content_type="multipart/form-data",
    )
    assert response.status_code == 302

    db.session.expire_all()
    saved_project = db.session.get(Project, project_id)
    assert saved_project.icon_filename.endswith(".webp")
    icon_response = admin_authenticated_client.get(f"/uploads/project-icons/{saved_project.icon_filename}")
    assert icon_response.status_code == 200
    assert icon_response.data == b"valid-enough-for-upload-validation"
