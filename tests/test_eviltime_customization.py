import io

from app import db
from app.models import Project
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
    assert get_eviltime_version() == "evil1.0"


def test_pdf_layout_preview_supports_get(admin_authenticated_client):
    response = admin_authenticated_client.get("/admin/pdf-layout/preview")
    assert response.status_code == 200
    assert response.mimetype in {"application/pdf", "text/html"}


def test_productivity_dashboard_contains_live_refresh(authenticated_client, active_timer):
    response = authenticated_client.get("/dashboard/productivity")
    assert response.status_code == 200
    assert b"setInterval" in response.data
    assert b"active_timer" in response.data


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
