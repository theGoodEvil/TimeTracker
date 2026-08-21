"""REST API v1 endpoints for attendance compliance (Belgium 2027)."""

from flask import g, request

from app.routes.api_v1 import api_v1_bp
from app.services.attendance_compliance_service import AttendanceComplianceService
from app.utils.api_auth import require_api_token
from app.utils.api_responses import error_response, success_response


@api_v1_bp.route("/attendance/status", methods=["GET"])
@require_api_token("read:time_entries")
def api_attendance_status():
    timer = g.api_user.active_timer
    status = {
        "active": timer is not None,
        "work_active": timer is not None,
        "on_break": bool(timer and timer.is_paused),
        "timer": timer.to_dict() if timer else None,
        "work_period": timer.to_dict() if timer else None,
    }
    return success_response(data=status)


@api_v1_bp.route("/attendance/break/start", methods=["POST"])
@require_api_token("write:time_entries")
def api_attendance_break_start():
    from app.services.time_tracking_service import TimeTrackingService

    result = TimeTrackingService().pause_timer(g.api_user.id)
    if not result["success"]:
        return error_response(
            message=result.get("message", "Could not start break"),
            status_code=400,
            error_code=result.get("error"),
        )
    from app.utils.realtime import emit_timer_state

    emit_timer_state("timer_paused", result["entry"])
    return success_response(
        data={"break": result["entry"].to_dict(), "timer": result["entry"].to_dict()}, message=result["message"]
    )


@api_v1_bp.route("/attendance/break/end", methods=["POST"])
@require_api_token("write:time_entries")
def api_attendance_break_end():
    from app.services.time_tracking_service import TimeTrackingService

    result = TimeTrackingService().resume_timer(g.api_user.id)
    if not result["success"]:
        return error_response(
            message=result.get("message", "Could not end break"),
            status_code=400,
            error_code=result.get("error"),
        )
    from app.utils.realtime import emit_timer_state

    emit_timer_state("timer_resumed", result["entry"])
    return success_response(
        data={"break": result["entry"].to_dict(), "timer": result["entry"].to_dict()}, message=result["message"]
    )


@api_v1_bp.route("/attendance/history", methods=["GET"])
@require_api_token("read:time_entries")
def api_attendance_history():
    from datetime import datetime, timedelta

    days = request.args.get("days", 30, type=int)
    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=max(1, days))
    records = AttendanceComplianceService().list_days(g.api_user.id, start_date, end_date, include_periods=False)
    return success_response(
        data={
            "records": [r.to_dict(include_periods=True) for r in records],
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        }
    )


@api_v1_bp.route("/attendance/corrections", methods=["POST"])
@require_api_token("write:time_entries")
def api_attendance_request_correction():
    data = request.get_json(silent=True) or {}
    result = AttendanceComplianceService().request_correction(
        attendance_day_id=data.get("attendance_day_id"),
        entity_type=data.get("entity_type"),
        entity_id=data.get("entity_id"),
        corrected_values=data.get("corrected_values") or {},
        reason=data.get("reason") or "",
        requested_by=g.api_user.id,
    )
    if not result["success"]:
        return error_response(message=result.get("message", "Could not request correction"), status_code=400)
    return success_response(data={"correction": result["correction"].to_dict()})


@api_v1_bp.route("/reports/compliance/belgium-attendance", methods=["GET"])
@require_api_token("read:reports")
def api_belgium_attendance_report():
    from datetime import datetime

    start = request.args.get("start_date")
    end = request.args.get("end_date")
    user_id = request.args.get("user_id", type=int)

    if not g.api_user.is_admin:
        user_id = g.api_user.id

    if not start or not end:
        return error_response(message="start_date and end_date are required", status_code=400)

    start_date = datetime.strptime(start, "%Y-%m-%d").date()
    end_date = datetime.strptime(end, "%Y-%m-%d").date()

    rows = AttendanceComplianceService().belgium_inspector_rows(
        start_date=start_date,
        end_date=end_date,
        user_id=user_id,
    )
    return success_response(data={"rows": rows, "count": len(rows)})
