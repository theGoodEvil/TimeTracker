"""Compatibility endpoints backed by EvilTime project timers.

Older desktop/mobile clients call these workday URLs. They now operate on the
same project timer as the rest of EvilTime so a second attendance clock can no
longer diverge from project time.
"""

from flask import g, request

from app.routes.api_v1 import api_v1_bp
from app.utils.api_auth import require_api_token
from app.utils.api_responses import error_response, success_response


@api_v1_bp.route("/workday/status", methods=["GET"])
@require_api_token("read:time_entries")
def api_workday_status():
    timer = g.api_user.active_timer
    return success_response(
        data={
            "active": timer is not None,
            "session": timer.to_dict() if timer else None,
            "timer": timer.to_dict() if timer else None,
            "paused": bool(timer and timer.is_paused),
        }
    )


@api_v1_bp.route("/workday/start", methods=["POST"])
@require_api_token("write:time_entries")
def api_workday_start():
    data = request.get_json(silent=True) or {}
    notes = (data.get("notes") or "").strip() or None
    project_id = data.get("project_id") or g.api_user.default_project_id
    if not project_id:
        return error_response(
            message="Choose a project or configure a default project in EvilTime settings",
            status_code=400,
            error_code="project_required",
        )

    from app.services.time_tracking_service import TimeTrackingService
    from app.utils.scope_filter import user_can_clock_project

    if not user_can_clock_project(g.api_user, int(project_id)):
        return error_response(message="You do not have access to this project", status_code=403)
    result = TimeTrackingService().start_timer(g.api_user.id, int(project_id), notes=notes)
    if not result["success"]:
        return error_response(
            message=result.get("message", "Could not start workday"),
            status_code=400,
            error_code=result.get("error"),
        )
    from app.utils.realtime import emit_timer_state

    emit_timer_state("timer_started", result["timer"])
    return success_response(
        data={"session": result["timer"].to_dict(), "timer": result["timer"].to_dict()},
        message=result["message"],
    )


@api_v1_bp.route("/workday/end", methods=["POST"])
@require_api_token("write:time_entries")
def api_workday_end():
    from app.services.workday_session_service import parse_workday_end_time

    data = request.get_json(silent=True) or {}
    notes = (data.get("notes") or "").strip() or None
    end_raw = data.get("end_time") or data.get("at_time")
    at_time = None
    if end_raw:
        at_time = parse_workday_end_time(str(end_raw))
        if at_time is None:
            return error_response(
                message="Invalid leave time",
                status_code=400,
                error_code="invalid_end_time",
            )

    from app.services.time_tracking_service import TimeTrackingService

    result = TimeTrackingService().stop_timer(g.api_user.id, end_time=at_time)
    if not result["success"] and result.get("error") == "no_active_timer":
        from app.services.workday_session_service import WorkdaySessionService

        legacy = WorkdaySessionService().get_active_session(g.api_user.id)
        if legacy:
            legacy_result = WorkdaySessionService().end_workday(g.api_user.id, notes=notes, at_time=at_time)
            if legacy_result["success"]:
                return success_response(
                    data={"session": legacy_result["session"].to_dict(), "legacy": True},
                    message="Legacy attendance session closed",
                )
    if not result["success"]:
        return error_response(
            message=result.get("message", "Could not end workday"),
            status_code=400,
            error_code=result.get("error"),
        )
    from app.utils.realtime import emit_timer_state

    emit_timer_state("timer_stopped", result["entry"])
    return success_response(
        data={"session": result["entry"].to_dict(), "timer": result["entry"].to_dict()},
        message=result["message"],
    )


@api_v1_bp.route("/workday/auto-closed/<int:session_id>/resolve", methods=["POST"])
@require_api_token("write:time_entries")
def api_resolve_auto_closed_workday(session_id):
    from app.services.workday_session_service import WorkdaySessionService
    from app.services.workday_session_service import parse_workday_end_time

    data = request.get_json(silent=True) or {}
    keep = data.get("keep") in (True, 1, "1")
    reason = (data.get("reason") or "").strip() or None
    at_time = None
    if not keep:
        end_raw = data.get("end_time") or data.get("at_time")
        if end_raw:
            at_time = parse_workday_end_time(str(end_raw))
            if at_time is None:
                return error_response(
                    message="Invalid leave time",
                    status_code=400,
                    error_code="invalid_end_time",
                )

    result = WorkdaySessionService().resolve_auto_closed_session(
        g.api_user.id,
        session_id,
        end_time=at_time,
        keep=keep,
        reason=reason,
    )
    if not result["success"]:
        return error_response(
            message=result.get("message", "Could not resolve auto-closed workday"),
            status_code=400,
            error_code=result.get("error"),
        )

    from app.utils.cache import get_cache

    try:
        get_cache().delete(f"dashboard:stats:{g.api_user.id}")
    except Exception:
        pass

    return success_response(
        data={
            "session": result["session"].to_dict(),
            "applied": result.get("applied", False),
            "pending_review": result.get("pending_review", False),
            "already_resolved": result.get("already_resolved", False),
        },
        message=result["message"],
    )
