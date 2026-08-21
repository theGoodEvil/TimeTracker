import os
from datetime import datetime, timedelta

from flask import (
    Blueprint,
    current_app,
    flash,
    jsonify,
    make_response,
    redirect,
    render_template,
    request,
    send_from_directory,
    session,
    url_for,
)
from flask_babel import gettext as _
from flask_login import current_user, login_required
from sqlalchemy import text

from app import csrf, db, limiter, track_page_view
from app.models import Activity, Client, Project, Settings, TimeEntry, TimeEntryTemplate, User, WeeklyTimeGoal
from app.models.time_entry import local_now
from app.utils.posthog_segmentation import update_user_segments_if_needed

main_bp = Blueprint("main", __name__)


@main_bp.route("/")
@main_bp.route("/dashboard")
@login_required
def dashboard():
    """Fast, unified EvilTime project-work dashboard."""
    track_page_view("dashboard")
    active_timer = current_user.active_timer

    # Preserve the dashboard cache contract used by invalidation hooks and API
    # consumers. The redesigned page itself renders authoritative live values.
    try:
        from app.utils.cache import get_cache

        dashboard_cache = get_cache()
        stats_key = f"dashboard:stats:{current_user.id}"
        chart_key = f"dashboard:chart:{current_user.id}"
        if dashboard_cache.get(stats_key) is None:
            dashboard_cache.set(stats_key, {"time_tracking": {"today_hours": 0.0}}, ttl=300)
        if dashboard_cache.get(chart_key) is None:
            dashboard_cache.set(chart_key, [], ttl=300)
    except Exception:
        current_app.logger.debug("Dashboard cache warmup failed", exc_info=True)

    from app.repositories import TimeEntryRepository
    from app.utils.scope_filter import get_active_clockable_projects_for_user
    from app.services.weekly_work_service import WeeklyWorkService

    recent_entries = TimeEntryRepository().get_by_user(user_id=current_user.id, limit=10, include_relations=True)
    active_projects = get_active_clockable_projects_for_user(current_user)
    active_project_by_id = {project.id: project for project in active_projects}
    recent_projects = []
    seen_project_ids = set()
    for entry in recent_entries:
        project = active_project_by_id.get(entry.project_id)
        if project and project.id not in seen_project_ids:
            recent_projects.append(project)
            seen_project_ids.add(project.id)
    if (
        current_user.default_project_id in active_project_by_id
        and current_user.default_project_id not in seen_project_ids
    ):
        recent_projects.append(active_project_by_id[current_user.default_project_id])
        seen_project_ids.add(current_user.default_project_id)
    for project in active_projects:
        if project.id not in seen_project_ids:
            recent_projects.append(project)
            seen_project_ids.add(project.id)
    weekly_rows = WeeklyWorkService.rows(current_user, limit=12, include_future=False)
    current_week_days = WeeklyWorkService.current_week_days(current_user)

    # Include the live entry. The browser then advances these values locally,
    # while Socket.IO events trigger an immediate refresh after state changes.
    today_local = local_now().date()
    today_entries = TimeEntry.query.filter(
        TimeEntry.user_id == current_user.id,
        TimeEntry.start_time >= datetime.combine(today_local, datetime.min.time()),
        TimeEntry.start_time <= datetime.combine(today_local, datetime.max.time()),
    ).all()
    today_work_seconds = sum(
        entry.current_duration_seconds if entry.end_time is None else (entry.duration_seconds or 0)
        for entry in today_entries
    )
    today_break_seconds = sum(
        (entry.break_seconds or 0)
        + (
            int((local_now() - entry._naive_dt(entry.paused_at)).total_seconds())
            if entry.end_time is None and entry.paused_at
            else 0
        )
        for entry in today_entries
    )

    def format_elapsed(seconds):
        seconds = max(0, int(seconds or 0))
        hours, remainder = divmod(seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"

    return render_template(
        "main/dashboard.html",
        active_timer=active_timer,
        active_projects=active_projects,
        recent_projects=recent_projects,
        recent_entries=recent_entries,
        weekly_rows=weekly_rows,
        current_week_days=current_week_days,
        today_work_seconds=today_work_seconds,
        today_break_seconds=today_break_seconds,
        today_work_formatted=format_elapsed(today_work_seconds),
        today_break_formatted=format_elapsed(today_break_seconds),
    )


@main_bp.route("/dashboard/productivity")
@login_required
def productivity_dashboard():
    """Personal productivity dashboard: streaks, focus, project mix, heatmap."""
    track_page_view("productivity_dashboard")

    from app.services.productivity_service import ProductivityService

    summary = ProductivityService.get_summary(current_user)
    daily_breakdown = ProductivityService.get_daily_breakdown(current_user, days=14)
    streak = ProductivityService.get_streak(current_user)
    focus = ProductivityService.get_focus_stats(current_user, days=30)
    projects = ProductivityService.get_project_breakdown(current_user, days=30)
    heatmap = ProductivityService.get_weekly_heatmap(current_user, weeks=12)
    insights = ProductivityService.get_insights(current_user, summary, daily_breakdown, streak, focus, projects)

    standard_hours_per_day = float(getattr(current_user, "standard_hours_per_day", 8.0) or 8.0)

    return render_template(
        "main/productivity_dashboard.html",
        summary=summary,
        daily_breakdown=daily_breakdown,
        streak=streak,
        focus=focus,
        projects=projects,
        heatmap=heatmap,
        insights=insights,
        standard_hours_per_day=standard_hours_per_day,
        period_days=30,
    )


@main_bp.route("/_health")
def health_check():
    """Liveness probe: shallow checks only, no DB access"""
    return {"status": "healthy"}, 200


@main_bp.route("/_ready")
def readiness_check():
    """Readiness probe: verify DB connectivity and critical dependencies"""
    try:
        db.session.execute(text("SELECT 1"))
        return {"status": "ready", "timestamp": local_now().isoformat()}, 200
    except Exception as e:
        return {"status": "not_ready", "error": "db_unreachable"}, 503


@main_bp.route("/about")
def about():
    """About page"""
    return render_template("main/about.html")


@main_bp.route("/help")
def help():
    """Help page"""
    return render_template("main/help.html")


@main_bp.route("/debug/i18n")
@login_required
def debug_i18n():
    """Debug endpoint to check i18n status (admin only)"""
    from flask_login import current_user

    if not current_user.is_admin:
        return jsonify({"error": "Admin only"}), 403

    import os

    from flask_babel import get_locale

    locale = str(get_locale())
    session_lang = session.get("preferred_language")
    user_lang = getattr(current_user, "preferred_language", None)

    # Check if .mo file exists for current locale
    base_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    translations_dir = os.path.join(base_path, "translations")
    mo_path = os.path.join(translations_dir, locale, "LC_MESSAGES", "messages.mo")
    po_path = os.path.join(translations_dir, locale, "LC_MESSAGES", "messages.po")

    return jsonify(
        {
            "current_locale": locale,
            "session_language": session_lang,
            "user_language": user_lang,
            "mo_file_exists": os.path.exists(mo_path),
            "po_file_exists": os.path.exists(po_path),
            "mo_path": mo_path,
            "nb_mo_exists": os.path.exists(os.path.join(translations_dir, "nb", "LC_MESSAGES", "messages.mo")),
            "no_mo_exists": os.path.exists(os.path.join(translations_dir, "no", "LC_MESSAGES", "messages.mo")),
        }
    )


@main_bp.route("/i18n/set-language", methods=["POST", "GET"])
def set_language():
    """Set preferred UI language via session or user profile."""
    lang = (
        request.args.get("lang")
        or (request.form.get("lang") if request.method == "POST" else None)
        or (request.json.get("lang") if request.is_json else None)
        or "en"
    )
    lang = lang.strip().lower()
    from flask import current_app

    supported = list(current_app.config.get("LANGUAGES", {}).keys()) or ["en"]
    if lang not in supported:
        lang = current_app.config.get("BABEL_DEFAULT_LOCALE", "en")

    # Make session permanent to ensure it persists across requests
    session.permanent = True

    # Persist in session for guests
    session["preferred_language"] = lang
    session.modified = True  # Force session save

    # If authenticated, persist to user profile
    try:
        from flask_login import current_user

        if current_user and getattr(current_user, "is_authenticated", False):
            # Update user preference in database
            current_user.preferred_language = lang
            # Add to session and commit
            db.session.add(current_user)
            db.session.commit()
            # Expire all cached objects to ensure fresh load on next request
            db.session.expire_all()
    except Exception as e:
        # If database save fails, rollback but continue with session
        try:
            db.session.rollback()
        except Exception:
            # A rollback that itself fails leaves the session unusable — surface it.
            current_app.logger.error("Rollback failed after settings save error", exc_info=True)

    # Redirect back if referer exists, add timestamp to force reload
    next_url = request.headers.get("Referer") or url_for("main.dashboard")
    # Add cache-busting parameter to ensure fresh page load
    import time

    separator = "&" if "?" in next_url else "?"
    next_url = f"{next_url}{separator}_lang_refresh={int(time.time())}"
    response = make_response(redirect(next_url))
    # Ensure no caching
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


@main_bp.route("/search")
@login_required
def search():
    """Search time entries"""
    query = request.args.get("q", "").strip()
    page = request.args.get("page", 1, type=int)

    if not query:
        return redirect(url_for("main.dashboard"))

    # Search in time entries
    from sqlalchemy import or_

    entries = (
        TimeEntry.query.filter(
            TimeEntry.user_id == current_user.id,
            TimeEntry.end_time.isnot(None),
            or_(TimeEntry.notes.ilike(f"%{query}%"), TimeEntry.tags.ilike(f"%{query}%")),
        )
        .order_by(TimeEntry.start_time.desc())
        .paginate(page=page, per_page=20, error_out=False)
    )

    return render_template("main/search.html", entries=entries, query=query)


@main_bp.route("/manifest.webmanifest")
def manifest():
    """Legacy URL: canonical manifest is /static/manifest.json."""
    return redirect(url_for("static", filename="manifest.json"), code=302)


@main_bp.route("/offline")
def offline_page():
    """Public offline fallback for PWA (no login required)."""
    resp = make_response(render_template("offline.html"))
    resp.headers["Cache-Control"] = "public, max-age=3600"
    return resp


@main_bp.route("/service-worker.js")
def service_worker():
    """Site-scoped service worker; implementation lives in app/static/js/sw.js."""
    return send_from_directory(current_app.static_folder, "js/sw.js", mimetype="application/javascript")


@main_bp.route("/csp-report", methods=["POST"])
@csrf.exempt
@limiter.limit("60 per hour")
def csp_report():
    """
    Collection point for Content-Security-Policy violation reports.

    The strict, nonce-based policy ships as Content-Security-Policy-Report-Only (see
    apply_security_headers in app/__init__.py) so violations can be observed before the
    policy is enforced. Without a report-uri the browser has nowhere to send them —
    Firefox warns that such a policy "will not block and cannot report violations" — so
    the reports only reached each user's own console, where nobody sees them.

    Unauthenticated and CSRF-exempt by necessity: the browser posts these itself, with
    no session or token. Rate-limited because the endpoint is world-writable and a
    misconfigured or hostile client could otherwise flood the log.
    """
    payload = request.get_json(force=True, silent=True) or {}
    report = payload.get("csp-report", payload)

    if not isinstance(report, dict):
        return "", 204

    current_app.logger.warning(
        "CSP violation: directive=%s blocked=%s document=%s",
        report.get("violated-directive") or report.get("effective-directive") or "?",
        report.get("blocked-uri") or "?",
        report.get("document-uri") or "?",
    )
    return "", 204
