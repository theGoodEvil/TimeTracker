"""Slack reminder after a 30-minute break."""

from datetime import datetime, timedelta
from unittest.mock import patch

import pytest

from app import db
from app.integrations.slack_attendance_connector import PROVIDER_KEY
from app.models import Integration, TimeEntry
from app.services.break_reminder_service import BreakReminderService

NOW = datetime(2026, 9, 9, 13, 0)


class _Ok:
    status_code = 200
    text = "{}"

    def json(self):
        return {"ok": True}


@pytest.fixture
def slack(app):
    integration = Integration(
        name="EvilTime Slack",
        provider=PROVIDER_KEY,
        is_global=True,
        is_active=True,
        config={"bot_token": "xoxb-test", "signing_secret": "s", "attendance_channel_id": "C1"},
    )
    db.session.add(integration)
    db.session.commit()
    return integration


@pytest.fixture
def paused_entry(app, user, project):
    user.slack_user_id = "U_BREAK"
    entry = TimeEntry(user_id=user.id, project_id=project.id, start_time=NOW - timedelta(hours=3), source="auto")
    entry.paused_at = NOW - timedelta(minutes=31)
    db.session.add(entry)
    db.session.commit()
    return entry


def _dms(mock_post):
    return [c.kwargs["json"] for c in mock_post.call_args_list if c.args[0].endswith("chat.postMessage")]


def test_reminds_once_per_break_after_30_minutes(app, slack, paused_entry):
    with patch("app.integrations.slack_attendance_connector.requests.post", return_value=_Ok()) as mock_post:
        assert BreakReminderService().run(now=NOW)["sent"] == 1
        dm = _dms(mock_post)[0]
        assert dm["channel"] == "U_BREAK"
        assert "Are you well rested?" in dm["text"]
        assert dm["blocks"][1]["elements"][0]["action_id"] == "eviltime_end_break"

        # Same break: no second reminder.
        assert BreakReminderService().run(now=NOW + timedelta(minutes=10))["sent"] == 0
        assert len(_dms(mock_post)) == 1


def test_next_break_gets_its_own_reminder(app, slack, paused_entry):
    with patch("app.integrations.slack_attendance_connector.requests.post", return_value=_Ok()):
        BreakReminderService().run(now=NOW)
        paused_entry.paused_at = NOW + timedelta(hours=2)
        db.session.commit()
        assert BreakReminderService().run(now=NOW + timedelta(hours=2, minutes=29))["sent"] == 0
        assert BreakReminderService().run(now=NOW + timedelta(hours=2, minutes=30))["sent"] == 1


def test_no_reminder_before_30_minutes_or_without_slack_link(app, slack, paused_entry, user):
    with patch("app.integrations.slack_attendance_connector.requests.post", return_value=_Ok()) as mock_post:
        assert BreakReminderService().run(now=NOW - timedelta(minutes=2))["due"] == 0
        user.slack_user_id = None
        db.session.commit()
        assert BreakReminderService().run(now=NOW)["due"] == 0
        assert _dms(mock_post) == []


def test_nothing_happens_without_slack_integration(app, paused_entry):
    assert BreakReminderService().run(now=NOW) == {"due": 0, "sent": 0}


def test_user_can_turn_off_slack_break_reminder(app, slack, paused_entry, user):
    user.slack_break_reminder_enabled = False
    db.session.commit()
    with patch("app.integrations.slack_attendance_connector.requests.post", return_value=_Ok()) as mock_post:
        assert BreakReminderService().run(now=NOW)["due"] == 0
        assert _dms(mock_post) == []


def test_settings_checkbox_controls_break_reminder(app, authenticated_client, user):
    assert user.slack_break_reminder_enabled is True
    authenticated_client.post("/settings", data={"standard_hours_per_day": "8"})
    db.session.refresh(user)
    assert user.slack_break_reminder_enabled is False

    authenticated_client.post("/settings", data={"standard_hours_per_day": "8", "slack_break_reminder_enabled": "on"})
    db.session.refresh(user)
    assert user.slack_break_reminder_enabled is True
    assert b"slack_break_reminder_enabled" in authenticated_client.get("/settings").data
