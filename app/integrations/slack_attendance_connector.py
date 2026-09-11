"""
Workspace-level Slack attendance connector.

Employees run /in [project], /switch [project], /brb, /back, and /out. The
commands operate on the same project timer as the EvilTime web app.

Reliability notes
-----------------
* Slack gives slash commands and interactive buttons 3 seconds to answer.
  When Slack supplies a ``response_url`` the request is acknowledged at once
  and the work runs in the background; the result is delivered through the
  ``response_url`` (valid for 30 minutes), so slow database or network moments
  no longer surface as ``operation_timeout`` in Slack.
* Timer transitions made anywhere else (web, API, kiosk, MCP, auto clock-out)
  reach Slack through :meth:`SlackAttendanceConnector.notify_timer_event`,
  which ``record_timer_event`` calls after every persisted transition.
* Slack API failures are logged and stored on the integration row
  (``last_error``) so admins can see why messages are missing.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import threading
import time
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Callable, Dict, Optional

import requests

from app.integrations.base import BaseConnector
from app.utils.db import safe_commit
from app.utils.secret_crypto import decrypt_if_needed, encrypt_if_possible
from app.utils.secret_crypto import is_configured as secrets_encryption_configured

logger = logging.getLogger(__name__)

PROVIDER_KEY = "slack_attendance"
HTTP_TIMEOUT = 10
SLACK_API = "https://slack.com/api"
SLACK_POST_MESSAGE = f"{SLACK_API}/chat.postMessage"
SLACK_USERS_INFO = f"{SLACK_API}/users.info"
SLACK_CONVERSATIONS_JOIN = f"{SLACK_API}/conversations.join"
SLACK_SIGNATURE_VERSION = "v0"
SLACK_REQUEST_MAX_AGE = 60 * 5

ATTENDANCE_COMMANDS = {
    "/in": "clock_in",
    "/switch": "switch",
    "/brb": "start_break",
    "/back": "end_break",
    "/out": "clock_out",
}

# Timer event types (see timer_event_service) mapped to channel announcements.
TIMER_EVENT_ACTIONS = {
    "clock_in": "clock_in",
    "project_switch": "switch",
    "clock_out": "clock_out",
    "break_start": "start_break",
    "break_end": "end_break",
}

ACTION_EXTEND = "eviltime_extend"
ACTION_CLOCK_OUT = "eviltime_clock_out"

# Hints shown to admins for the Slack API errors that silently drop messages.
SLACK_ERROR_HINTS = {
    "not_in_channel": "Invite the EvilTime bot to the attendance channel (/invite @YourBot).",
    "channel_not_found": "Check the attendance channel ID and invite the bot to that channel.",
    "invalid_auth": "The bot token is invalid. Paste a fresh xoxb- token.",
    "token_revoked": "The bot token was revoked. Reinstall the Slack app and paste the new token.",
    "account_inactive": "The bot token belongs to a deactivated app. Reinstall the Slack app.",
    "missing_scope": "Add the missing OAuth scope in the Slack app and reinstall it.",
    "ratelimited": "Slack rate-limited the bot. Messages resume automatically.",
}

_SUPPRESS_FLAG = "_slack_attendance_suppress_announcements"


def _enc(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = (value or "").strip()
    if not value:
        return ""
    if secrets_encryption_configured():
        try:
            return encrypt_if_possible(value)
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Slack attendance secret encryption failed: %s", exc)
    return value


def _dec(value: Optional[str]) -> str:
    if not value:
        return ""
    try:
        return decrypt_if_needed(value)
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Slack attendance secret decryption failed: %s", exc)
        return ""


@contextmanager
def suppress_channel_announcements():
    """Skip automatic channel announcements for transitions made in this block.

    Used when the caller answers Slack itself (slash commands reply in channel,
    auto clock-out posts its own wording) so a transition is announced once.
    """
    from flask import g

    previous = getattr(g, _SUPPRESS_FLAG, False)
    setattr(g, _SUPPRESS_FLAG, True)
    try:
        yield
    finally:
        setattr(g, _SUPPRESS_FLAG, previous)


def _announcements_suppressed() -> bool:
    from flask import g, has_app_context

    return bool(has_app_context() and getattr(g, _SUPPRESS_FLAG, False))


def run_in_background(fn: Callable, *args, request_path: Optional[str] = None) -> None:
    """Run ``fn`` outside the current request with a fresh app context.

    ``request_path`` wraps the call in a synthetic request context for code
    that expects one (e.g. flask-login's ``current_user``). Under the eventlet
    gunicorn worker threads are green threads, so this is cheap. Tests run the
    function inline (``SLACK_ATTENDANCE_INLINE`` defaults to ``TESTING``) so
    its effects can be asserted deterministically.
    """
    from flask import current_app

    app = current_app._get_current_object()
    if app.config.get("SLACK_ATTENDANCE_INLINE", app.testing):
        fn(*args)
        return

    def runner():
        from app import db

        context = app.test_request_context(request_path) if request_path else app.app_context()
        with context:
            try:
                fn(*args)
            except Exception:
                logger.exception("Slack attendance background task failed")
            finally:
                db.session.remove()

    threading.Thread(target=runner, name="slack-attendance", daemon=True).start()


def format_hours(seconds: int) -> str:
    minutes = max(0, int(round((seconds or 0) / 60)))
    return f"{minutes // 60}:{minutes % 60:02d} h"


class SlackAttendanceConnector(BaseConnector):
    """Global Slack integration for workspace attendance slash commands."""

    display_name = "EvilTime Slack"
    description = "Track project work from Slack with /in, /switch, /brb, /back, /out"
    icon = "slack"

    def __init__(self, integration=None, credentials=None):
        super().__init__(integration, credentials)

    @property
    def provider_name(self) -> str:
        return PROVIDER_KEY

    def get_authorization_url(self, redirect_uri: str, state: str = None) -> str:
        raise NotImplementedError("SlackAttendanceConnector uses a bot token (no OAuth flow here)")

    def exchange_code_for_tokens(self, code: str, redirect_uri: str) -> Dict[str, Any]:
        raise NotImplementedError("SlackAttendanceConnector uses a bot token (no OAuth flow here)")

    def refresh_access_token(self) -> Dict[str, Any]:
        return {"access_token": self._bot_token() or None}

    def test_connection(self) -> Dict[str, Any]:
        if not self._is_ready():
            return {"success": False, "message": "Integration not configured"}
        try:
            resp = requests.post(
                f"{SLACK_API}/auth.test",
                headers={"Authorization": f"Bearer {self._bot_token()}"},
                timeout=HTTP_TIMEOUT,
            )
        except requests.RequestException as exc:
            return {"success": False, "message": f"Connection error: {exc}"}
        data = resp.json() or {}
        if data.get("ok"):
            return {"success": True, "message": f"Connected as {data.get('user') or 'Unknown'}"}
        return {"success": False, "message": data.get("error") or "auth.test failed"}

    def _cfg(self) -> Dict[str, Any]:
        return dict(self.integration.config or {}) if self.integration else {}

    def _bot_token(self) -> str:
        return _dec(self._cfg().get("bot_token"))

    def _signing_secret(self) -> str:
        return _dec(self._cfg().get("signing_secret"))

    def _is_ready(self) -> bool:
        return bool(self.integration and self.integration.is_active and self._bot_token())

    def _channel(self) -> Optional[str]:
        return (self._cfg().get("attendance_channel_id") or "").strip() or None

    def _dashboard_url(self) -> Optional[str]:
        base = (self._cfg().get("public_base_url") or "").strip().rstrip("/")
        return f"{base}/dashboard" if base else None

    @classmethod
    def save_config(cls, integration, payload: Dict[str, Any], base_url: Optional[str] = None) -> Dict[str, Any]:
        if not integration:
            return {"ok": False, "error": "Integration not configured"}
        cfg: Dict[str, Any] = dict(integration.config or {})

        bot_token = (payload.get("bot_token") or "").strip()
        if bot_token:
            cfg["bot_token"] = _enc(bot_token)
        signing = (payload.get("signing_secret") or "").strip()
        if signing:
            cfg["signing_secret"] = _enc(signing)

        if "attendance_channel_id" in payload:
            cfg["attendance_channel_id"] = (payload.get("attendance_channel_id") or "").strip() or None
        if base_url:
            cfg["public_base_url"] = base_url.strip().rstrip("/")

        integration.config = cfg
        integration.is_active = bool(cfg.get("bot_token") and cfg.get("signing_secret"))
        integration.last_error = None
        integration.updated_at = datetime.utcnow()

        if not safe_commit("slack_attendance_save_config", {"integration_id": integration.id}):
            return {"ok": False, "error": "Database error while saving configuration"}
        return {"ok": True, "is_active": bool(integration.is_active)}

    def verify_signature(
        self,
        signature: Optional[str],
        timestamp: Optional[str],
        raw_body: Optional[bytes],
    ) -> bool:
        secret = self._signing_secret()
        if not secret or not signature or not timestamp or raw_body is None:
            return False
        try:
            ts_int = int(timestamp)
        except (TypeError, ValueError):
            return False
        if abs(time.time() - ts_int) > SLACK_REQUEST_MAX_AGE:
            logger.warning("Rejected Slack request with stale timestamp (server clock skew?): %s", timestamp)
            return False
        base = f"{SLACK_SIGNATURE_VERSION}:{timestamp}:".encode("utf-8") + raw_body
        expected = SLACK_SIGNATURE_VERSION + "=" + hmac.new(secret.encode("utf-8"), base, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)

    # ------------------------------------------------------------------
    # Slash commands
    # ------------------------------------------------------------------
    def dispatch_slash_command(self, form: Dict[str, str]) -> Optional[Dict[str, Any]]:
        """Handle a slash command, deferring to ``response_url`` when Slack sent one.

        Returns the synchronous result, or ``None`` once the command has been
        handed to a background task (the caller should then answer Slack with
        an empty 200 right away).
        """
        response_url = (form.get("response_url") or "").strip()
        if not response_url:
            return self.handle_slash_command(form)

        integration_id = self.integration.id

        def work():
            connector = SlackAttendanceConnector._for_integration_id(integration_id)
            if connector is None:
                return
            try:
                result = connector.handle_slash_command(form)
            except Exception:
                logger.exception("Slack slash command %s failed", form.get("command"))
                result = connector._ephemeral("Something went wrong in EvilTime. Please try again or use the website.")
            connector._respond(response_url, result.get("body") or {})

        run_in_background(work, request_path="/api/integrations/slack/attendance")
        return None

    def handle_slash_command(self, form: Dict[str, str]) -> Dict[str, Any]:
        if not self._is_ready():
            return self._ephemeral("Slack attendance integration is not configured.")

        channel_id = (form.get("channel_id") or "").strip()
        allowed_channel = self._channel() or ""
        if allowed_channel and channel_id and channel_id != allowed_channel:
            return self._ephemeral("This command can only be used in the configured EvilTime channel.")

        command = (form.get("command") or "").strip().lower()
        action = ATTENDANCE_COMMANDS.get(command)
        if not action:
            return self._ephemeral("Unknown command. Available: `/in`, `/switch`, `/brb`, `/back`, `/out`.")

        slack_user_id = (form.get("user_id") or "").strip()
        if not slack_user_id:
            return self._ephemeral("Missing Slack user ID.")

        user = self.resolve_user(slack_user_id)
        if not user:
            return self._ephemeral(
                "Your Slack account is not linked to EvilTime. "
                f"Add your Slack member ID `{slack_user_id}` in EvilTime → Settings → Slack user ID, "
                "or ensure your Slack profile email matches your EvilTime email."
            )

        # The slash command reply is the channel announcement for this action.
        with suppress_channel_announcements():
            return self._dispatch_action(action, user, (form.get("text") or "").strip())

    def resolve_user(self, slack_user_id: str):
        from app import db
        from app.models import User

        user = User.query.filter_by(slack_user_id=slack_user_id).first()
        if user:
            return user

        email = self._fetch_slack_user_email(slack_user_id)
        if not email:
            return None

        user = User.query.filter(db.func.lower(User.email) == email.lower()).first()
        if not user:
            return None

        existing = User.query.filter_by(slack_user_id=slack_user_id).first()
        if existing and existing.id != user.id:
            return None

        user.slack_user_id = slack_user_id
        if not safe_commit("slack_attendance_link_user", {"user_id": user.id, "slack_user_id": slack_user_id}):
            db.session.rollback()
            return None
        return user

    def _fetch_slack_user_email(self, slack_user_id: str) -> Optional[str]:
        token = self._bot_token()
        if not token:
            return None
        try:
            resp = requests.get(
                SLACK_USERS_INFO,
                headers={"Authorization": f"Bearer {token}"},
                params={"user": slack_user_id},
                timeout=HTTP_TIMEOUT,
            )
        except requests.RequestException as exc:
            logger.warning("Slack users.info failed for %s: %s", slack_user_id, exc)
            return None
        data = resp.json() or {}
        if not data.get("ok"):
            logger.warning("Slack users.info error for %s: %s", slack_user_id, data.get("error"))
            return None
        profile = (data.get("user") or {}).get("profile") or {}
        email = (profile.get("email") or "").strip()
        return email or None

    def _resolve_project(self, user, query: str):
        from app import db
        from app.models import Project

        if not query:
            project = getattr(user, "default_project", None)
            return project if project and project.status == "active" else None

        from app.utils.scope_filter import get_clockable_project_ids

        allowed = get_clockable_project_ids(user)
        candidates = Project.query.filter(Project.status == "active")
        if allowed is not None:
            candidates = candidates.filter(Project.id.in_(allowed))
        exact = candidates.filter(
            db.or_(db.func.lower(Project.name) == query.lower(), db.func.lower(Project.code) == query.lower())
        ).first()
        if exact:
            return exact
        partial = candidates.filter(db.func.lower(Project.name).like(f"%{query.lower()}%"))
        matches = partial.limit(2).all()
        return matches[0] if len(matches) == 1 else None

    def _dispatch_action(self, action: str, user, project_query: str = "") -> Dict[str, Any]:
        from app.services.time_tracking_service import TimeTrackingService
        from app.utils.realtime import emit_timer_state

        display = self._display_name(user)
        service = TimeTrackingService()

        if action in ("clock_in", "switch"):
            project = self._resolve_project(user, project_query)
            if not project:
                if project_query:
                    return self._ephemeral(
                        f'No unique active project matches "{project_query}". Use the exact project name or code.'
                    )
                return self._ephemeral(
                    "No default project is configured. Use `/in Project name` or set one in EvilTime."
                )

            active = user.active_timer
            if action == "clock_in" and active:
                since = self._format_datetime(active.start_time, user)
                return self._ephemeral(
                    f"You are already clocked in on {self._project_name(active)} since {since}. "
                    "Use `/switch Project` to change project or `/out` to clock out."
                )
            if action == "switch" and not active:
                return self._ephemeral("You are clocked out. Use `/in Project name` to start.")
            if action == "switch" and active:
                result = service.switch_timer(user.id, project.id)
            else:
                result = service.start_timer(user.id, project.id)
            if result.get("success"):
                timer = result.get("timer")
                self._emit(emit_timer_state, "timer_started", timer)
                event = "switched to" if action == "switch" else "clocked in to"
                return self._in_channel(
                    f":white_check_mark: *{display}* {event} *{project.name}* at "
                    f"{self._format_time(timer.start_time, user)}"
                )
            return self._ephemeral(result.get("message") or "Could not clock in.")

        if action == "clock_out":
            result = service.stop_timer(user.id)
            if result.get("success"):
                entry = result.get("entry")
                self._emit(emit_timer_state, "timer_stopped", entry)
                return self._in_channel(
                    f":door: *{display}* clocked out of *{self._project_name(entry)}* at "
                    f"{self._format_time(entry.end_time, user)}"
                )
            return self._ephemeral(result.get("message") or "Could not clock out.")

        if action == "start_break":
            result = service.pause_timer(user.id)
            if result.get("success"):
                entry = result.get("entry")
                self._emit(emit_timer_state, "timer_paused", entry)
                return self._in_channel(
                    f":coffee: *{display}* started a break from *{self._project_name(entry)}* at "
                    f"{self._format_time(entry.paused_at, user)}"
                )
            return self._ephemeral(result.get("message") or "Could not start break.")

        if action == "end_break":
            result = service.resume_timer(user.id)
            if result.get("success"):
                entry = result.get("entry")
                self._emit(emit_timer_state, "timer_resumed", entry)
                return self._in_channel(f":arrow_forward: *{display}* is back on *{self._project_name(entry)}*")
            return self._ephemeral(result.get("message") or "Could not end break.")

        return self._ephemeral("Unknown action.")

    @staticmethod
    def _emit(emitter, event: str, entry) -> None:
        try:
            emitter(event, entry)
        except Exception as exc:
            logger.debug("Socket emit %s failed: %s", event, exc)

    # ------------------------------------------------------------------
    # Interactive buttons (overtime warning)
    # ------------------------------------------------------------------
    def dispatch_interaction(self, payload: Dict[str, Any]) -> None:
        response_url = (payload.get("response_url") or "").strip()
        integration_id = self.integration.id

        def work():
            connector = SlackAttendanceConnector._for_integration_id(integration_id)
            if connector is None:
                return
            body = connector.handle_interaction(payload)
            if response_url and body:
                connector._respond(response_url, body)

        run_in_background(work, request_path="/api/integrations/slack/interactions")

    def handle_interaction(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        from app.services.auto_clock_out_service import AutoClockOutService
        from app.services.time_tracking_service import TimeTrackingService
        from app.utils.realtime import emit_timer_state

        actions = payload.get("actions") or []
        action = actions[0] if actions else {}
        action_id = action.get("action_id") or ""
        slack_user_id = ((payload.get("user") or {}).get("id") or "").strip()
        user = self.resolve_user(slack_user_id) if slack_user_id else None
        if not user:
            return self._replacement("Your Slack account is not linked to EvilTime.")

        if action_id.startswith(ACTION_EXTEND):
            try:
                minutes = int(action.get("value") or 0)
            except (TypeError, ValueError):
                minutes = 0
            result = AutoClockOutService().extend(user, minutes)
            if not result.get("success"):
                return self._replacement(f":warning: {result.get('message') or 'Could not extend your work time.'}")
            return self._replacement(
                f":white_check_mark: Work time extended by {format_hours(minutes * 60)}. "
                f"You will be asked again after {format_hours(result['limit_seconds'])}."
            )

        if action_id == ACTION_CLOCK_OUT:
            result = TimeTrackingService().stop_timer(user.id)
            if not result.get("success"):
                return self._replacement(f":information_source: {result.get('message') or 'Nothing to clock out.'}")
            entry = result["entry"]
            self._emit(emit_timer_state, "timer_stopped", entry)
            return self._replacement(f":door: Clocked out at {self._format_time(entry.end_time, user)}.")

        return {}

    # ------------------------------------------------------------------
    # Auto clock-out notifications
    # ------------------------------------------------------------------
    def send_overtime_warning(self, user, *, limit_seconds: int, deadline_at, extension_choices) -> bool:
        """DM the user that their daily hours are reached, with extend buttons."""
        if not self._is_ready() or not getattr(user, "slack_user_id", None):
            return False
        deadline = self._format_time(deadline_at, user)
        text = (
            f":alarm_clock: You have reached your daily working time of *{format_hours(limit_seconds)}*. "
            f"You will be clocked out automatically at *{deadline}* unless you extend."
        )
        buttons = [
            {
                "type": "button",
                "action_id": f"{ACTION_EXTEND}_{minutes}",
                "text": {"type": "plain_text", "text": f"+{format_hours(minutes * 60)}"},
                "value": str(minutes),
            }
            for minutes in extension_choices
        ]
        buttons.append(
            {
                "type": "button",
                "action_id": ACTION_CLOCK_OUT,
                "text": {"type": "plain_text", "text": "Clock out now"},
                "style": "danger",
            }
        )
        blocks = [
            {"type": "section", "text": {"type": "mrkdwn", "text": text}},
            {"type": "actions", "elements": buttons},
        ]
        dashboard = self._dashboard_url()
        if dashboard:
            blocks.append(
                {"type": "context", "elements": [{"type": "mrkdwn", "text": f"Or extend in <{dashboard}|EvilTime>."}]}
            )
        return self._post_async(user.slack_user_id, text, blocks=blocks)

    def send_auto_clock_out_notice(self, user, entry, *, limit_seconds: int) -> None:
        display = self._display_name(user)
        at = self._format_time(entry.end_time, user)
        channel = self._channel()
        if self._is_ready() and channel:
            self._post_async(
                channel,
                f":robot_face: *{display}* was automatically clocked out of *{self._project_name(entry)}* at {at} "
                f"(daily working time of {format_hours(limit_seconds)} reached).",
            )
        if self._is_ready() and getattr(user, "slack_user_id", None):
            self._post_async(
                user.slack_user_id,
                f":door: You were automatically clocked out at *{at}* after {format_hours(limit_seconds)} of work. "
                "If you are still working, clock in again with `/in` and extend your time when asked.",
            )

    # ------------------------------------------------------------------
    # Channel announcements for web/API/kiosk transitions
    # ------------------------------------------------------------------
    @classmethod
    def notify_timer_event(cls, event_type: str, entry) -> None:
        """Announce a persisted timer transition in the attendance channel."""
        action = TIMER_EVENT_ACTIONS.get(event_type)
        if not action or entry is None or _announcements_suppressed():
            return
        # A break that ends because the timer stopped or switched is implied by
        # the following clock-out / switch announcement.
        if action == "end_break" and entry.end_time is not None:
            return
        try:
            connector = cls.for_global()
            if not connector or not connector._is_ready():
                return
            channel = connector._channel()
            if not channel:
                return
            text = connector._announcement_text(action, entry)
            if text:
                connector._post_async(channel, text)
        except Exception as exc:
            logger.warning("Slack attendance notify_timer_event failed: %s", exc)

    def _announcement_text(self, action: str, entry) -> Optional[str]:
        user = entry.user
        display = self._display_name(user)
        project = self._project_name(entry)
        if action == "clock_in":
            return f":white_check_mark: *{display}* clocked in to *{project}* at {self._format_time(entry.start_time, user)}"
        if action == "switch":
            return (
                f":white_check_mark: *{display}* switched to *{project}* at {self._format_time(entry.start_time, user)}"
            )
        if action == "clock_out":
            return f":door: *{display}* clocked out of *{project}* at {self._format_time(entry.end_time, user)}"
        if action == "start_break":
            return (
                f":coffee: *{display}* started a break from *{project}* at {self._format_time(entry.paused_at, user)}"
            )
        if action == "end_break":
            return f":arrow_forward: *{display}* is back on *{project}*"
        return None

    # ------------------------------------------------------------------
    # Formatting helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _display_name(user) -> str:
        return getattr(user, "display_name", None) or getattr(user, "username", None) or "User"

    @staticmethod
    def _project_name(entry) -> str:
        project = getattr(entry, "project", None)
        return project.name if project else "—"

    @staticmethod
    def _to_user_time(value, user):
        if not hasattr(value, "strftime"):
            return None
        try:
            from app.utils.timezone import convert_app_datetime_to_user

            return convert_app_datetime_to_user(value, user) if user is not None else value
        except Exception:
            return value

    @classmethod
    def _format_time(cls, value, user=None) -> str:
        value = cls._to_user_time(value, user)
        return value.strftime("%H:%M") if value is not None else "—"

    @classmethod
    def _format_datetime(cls, value, user=None) -> str:
        value = cls._to_user_time(value, user)
        return value.strftime("%d.%m. %H:%M") if value is not None else "—"

    @staticmethod
    def _ephemeral(text: str) -> Dict[str, Any]:
        return {"status": 200, "body": {"response_type": "ephemeral", "text": text}}

    @staticmethod
    def _in_channel(text: str) -> Dict[str, Any]:
        return {"status": 200, "body": {"response_type": "in_channel", "text": text}}

    @staticmethod
    def _replacement(text: str) -> Dict[str, Any]:
        return {"replace_original": True, "text": text}

    # ------------------------------------------------------------------
    # Slack Web API
    # ------------------------------------------------------------------
    def send_test_message(self) -> Dict[str, Any]:
        if not self._is_ready():
            return {"ok": False, "error": "Integration not configured"}
        channel = self._channel()
        if not channel:
            return {"ok": False, "error": "Attendance channel ID is required for test messages"}
        ok, error = self._post(channel, ":wave: EvilTime Slack project tracking test message.")
        self._record_delivery(error)
        if ok:
            return {"ok": True}
        hint = SLACK_ERROR_HINTS.get(error or "")
        return {"ok": False, "error": f"{error}: {hint}" if hint else (error or "Slack did not accept the message")}

    def _post_async(self, channel: str, text: str, blocks=None) -> bool:
        """Post without holding up the caller; failures are logged and recorded."""
        if not (self._bot_token() and channel and text):
            return False
        integration_id = self.integration.id

        def work():
            connector = SlackAttendanceConnector._for_integration_id(integration_id)
            if connector is None:
                return
            _ok, error = connector._post(channel, text, blocks=blocks)
            connector._record_delivery(error)

        run_in_background(work)
        return True

    def _post(self, channel: Optional[str], text: str, blocks=None) -> tuple[bool, Optional[str]]:
        token = self._bot_token()
        if not (token and channel and text):
            return False, "not_configured"
        payload: Dict[str, Any] = {"channel": channel, "text": text}
        if blocks:
            payload["blocks"] = blocks
        ok, error = self._call_post_message(token, payload)
        if not ok and error == "not_in_channel" and channel.startswith("C"):
            # Public channels can be joined with the channels:join scope.
            if self._join_channel(token, channel):
                ok, error = self._call_post_message(token, payload)
        if not ok:
            hint = SLACK_ERROR_HINTS.get(error or "", "")
            logger.warning("Slack chat.postMessage to %s failed: %s %s", channel, error, hint)
        return ok, error

    @staticmethod
    def _call_post_message(token: str, payload: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        try:
            resp = requests.post(
                SLACK_POST_MESSAGE,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json; charset=utf-8",
                },
                json=payload,
                timeout=HTTP_TIMEOUT,
            )
        except requests.RequestException as exc:
            return False, f"network_error: {exc}"
        if resp.status_code == 429:
            return False, "ratelimited"
        if resp.status_code != 200:
            return False, f"http_{resp.status_code}"
        try:
            data = resp.json() or {}
        except ValueError:
            return False, "invalid_response"
        return bool(data.get("ok")), data.get("error")

    @staticmethod
    def _join_channel(token: str, channel: str) -> bool:
        try:
            resp = requests.post(
                SLACK_CONVERSATIONS_JOIN,
                headers={"Authorization": f"Bearer {token}"},
                data={"channel": channel},
                timeout=HTTP_TIMEOUT,
            )
            data = resp.json() or {}
        except (requests.RequestException, ValueError) as exc:
            logger.warning("Slack conversations.join failed for %s: %s", channel, exc)
            return False
        if not data.get("ok"):
            logger.warning("Slack conversations.join failed for %s: %s", channel, data.get("error"))
        return bool(data.get("ok"))

    @staticmethod
    def _respond(response_url: str, body: Dict[str, Any]) -> bool:
        """Deliver a deferred slash-command/interaction result to Slack."""
        if not body:
            return False
        try:
            resp = requests.post(
                response_url,
                data=json.dumps(body),
                headers={"Content-Type": "application/json; charset=utf-8"},
                timeout=HTTP_TIMEOUT,
            )
        except requests.RequestException as exc:
            logger.warning("Slack response_url delivery failed: %s", exc)
            return False
        if resp.status_code != 200:
            logger.warning("Slack response_url delivery failed: HTTP %s %s", resp.status_code, resp.text[:200])
            return False
        return True

    def _record_delivery(self, error: Optional[str]) -> None:
        """Surface the latest Slack delivery outcome on the integration row."""
        integration = self.integration
        if integration is None:
            return
        if error:
            hint = SLACK_ERROR_HINTS.get(error, "")
            message = f"{error}: {hint}" if hint else error
            if integration.last_error == message and integration.last_sync_status == "error":
                return
            integration.last_error = message
            integration.last_sync_status = "error"
        else:
            if integration.last_sync_status == "success" and not integration.last_error:
                return
            integration.last_error = None
            integration.last_sync_status = "success"
        integration.last_sync_at = datetime.utcnow()
        safe_commit("slack_attendance_record_delivery", {"integration_id": integration.id})

    # ------------------------------------------------------------------
    # Lookup
    # ------------------------------------------------------------------
    @classmethod
    def for_global(cls) -> Optional["SlackAttendanceConnector"]:
        from app.models import Integration

        # Prefer the configured row should older installs carry duplicates.
        integration = (
            Integration.query.filter_by(provider=PROVIDER_KEY, is_global=True)
            .order_by(Integration.is_active.desc(), Integration.updated_at.desc(), Integration.id.asc())
            .first()
        )
        if not integration:
            return None
        return cls(integration=integration, credentials=None)

    @classmethod
    def _for_integration_id(cls, integration_id: int) -> Optional["SlackAttendanceConnector"]:
        from app import db
        from app.models import Integration

        integration = db.session.get(Integration, integration_id)
        return cls(integration=integration, credentials=None) if integration else None

    @classmethod
    def get_or_create_global(cls) -> "SlackAttendanceConnector":
        from app import db
        from app.models import Integration

        existing = cls.for_global()
        if existing:
            return existing
        integration = Integration(
            name="EvilTime Slack",
            provider=PROVIDER_KEY,
            user_id=None,
            is_global=True,
            is_active=False,
            config={},
        )
        db.session.add(integration)
        safe_commit("slack_attendance_create_global", {"provider": PROVIDER_KEY})
        return cls(integration=integration, credentials=None)
