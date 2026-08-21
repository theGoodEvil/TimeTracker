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

from app import csrf, db, limiter, track_event, track_page_view
from app.models import Activity, Client, Project, Settings, TimeEntry, TimeEntryTemplate, User, WeeklyTimeGoal
from app.models.time_entry import local_now
from app.utils.license_utils import is_license_activated
from app.utils.posthog_segmentation import update_user_segments_if_needed

main_bp = Blueprint("main", __name__)


@main_bp.route("/")
@main_bp.route("/dashboard")
@login_required
def dashboard():
    """Fast, unified EvilTime project-work dashboard."""
    track_page_view("dashboard")
    active_timer = current_user.active_timer

    from app.repositories import TimeEntryRepository
    from app.utils.scope_filter import get_active_clockable_projects_for_user
    from app.services.weekly_work_service import WeeklyWorkService

    recent_entries = TimeEntryRepository().get_by_user(user_id=current_user.id, limit=10, include_relations=True)
    active_projects = get_active_clockable_projects_for_user(current_user)
    weekly_rows = WeeklyWorkService.rows(current_user, limit=12)

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
    return render_template(
        "main/dashboard.html",
        active_timer=active_timer,
        active_projects=active_projects,
        recent_entries=recent_entries,
        weekly_rows=weekly_rows,
        today_work_seconds=today_work_seconds,
        today_break_seconds=today_break_seconds,
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


@main_bp.route("/donate")
@login_required
def donate():
    """Donation page explaining why donations are important"""
    from app.models import TimeEntry

    # Get user engagement metrics
    days_since_signup = (datetime.utcnow() - current_user.created_at).days if current_user.created_at else 0
    time_entries_count = TimeEntry.query.filter_by(user_id=current_user.id).count()
    total_hours = current_user.total_hours if hasattr(current_user, "total_hours") else 0.0

    # Record page view (only if table exists)
    try:
        from app.models import DonationInteraction

        DonationInteraction.record_interaction(
            user_id=current_user.id,
            interaction_type="page_viewed",
            source="donate_page",
            user_metrics={
                "days_since_signup": days_since_signup,
                "time_entries_count": time_entries_count,
                "total_hours": total_hours,
            },
        )
    except Exception:
        # Don't fail the page if tracking fails (e.g. table doesn't exist yet).
        current_app.logger.debug("Could not record donate page view", exc_info=True)

    return render_template(
        "main/donate.html",
        days_since_signup=days_since_signup,
        time_entries_count=time_entries_count,
        total_hours=total_hours,
    )


@main_bp.route("/donate/track-click", methods=["POST"])
@login_required
def track_donation_click():
    """Track donation link clicks"""
    try:
        from app.models import DonationInteraction

        data = request.get_json() or {}
        source = data.get("source", "unknown")
        variant = data.get("variant")

        # Get user metrics
        metrics = DonationInteraction.get_user_engagement_metrics(current_user.id)

        # Record click (variant for A/B segmentation)
        DonationInteraction.record_interaction(
            user_id=current_user.id,
            interaction_type="link_clicked",
            source=source,
            user_metrics=metrics,
            variant=variant,
        )

        return jsonify({"success": True})
    except Exception as e:
        # Return success even if tracking fails (e.g., table doesn't exist yet)
        return jsonify({"success": True, "note": "Tracking unavailable"})


@main_bp.route("/donate/track-banner-dismissal", methods=["POST"])
@login_required
def track_banner_dismissal():
    """Track banner dismissals"""
    try:
        from app.models import DonationInteraction

        data = request.get_json() or {}
        variant = data.get("variant")

        # Get user metrics
        metrics = DonationInteraction.get_user_engagement_metrics(current_user.id)

        # Record dismissal (variant for A/B segmentation)
        DonationInteraction.record_interaction(
            user_id=current_user.id,
            interaction_type="banner_dismissed",
            source="banner",
            user_metrics=metrics,
            variant=variant,
        )

        return jsonify({"success": True})
    except Exception as e:
        # Return success even if tracking fails (e.g., table doesn't exist yet)
        return jsonify({"success": True, "note": "Tracking unavailable"})


@main_bp.route("/donate/track-impression", methods=["POST"])
@login_required
def track_support_impression():
    """Track support banner impression (banner_impression -> cta_click funnel)."""
    try:
        from app.models import DonationInteraction

        data = request.get_json() or {}
        source = data.get("source", "banner")
        variant = data.get("variant")

        metrics = DonationInteraction.get_user_engagement_metrics(current_user.id)
        DonationInteraction.record_interaction(
            user_id=current_user.id,
            interaction_type="banner_impression",
            source=source,
            user_metrics=metrics,
            variant=variant,
        )
        return jsonify({"success": True})
    except Exception:
        return jsonify({"success": True, "note": "Tracking unavailable"})


@main_bp.route("/donate/request-soft-prompt", methods=["POST"])
@login_required
def request_soft_support_prompt():
    """Authorize a single long-session soft prompt (session rules enforced server-side)."""
    from app.models import DonationInteraction, Settings
    from app.services.support_prompt_service import SupportPromptService

    data = request.get_json() or {}
    kind = (data.get("kind") or "long_session").strip()
    if kind != "long_session":
        return jsonify({"show": False})

    settings_obj = Settings.get_settings()
    is_supporter = is_license_activated(settings_obj)
    ui_show = getattr(current_user, "ui_show_donate", True)
    try:
        suppressed = DonationInteraction.has_recent_donation_click(current_user.id, days=30)
    except Exception:
        suppressed = False

    if not SupportPromptService.long_session_prompt_allowed(
        session,
        ui_show_donate=ui_show,
        is_supporter=is_supporter,
        support_banner_suppressed=suppressed,
    ):
        return jsonify({"show": False})

    SupportPromptService.mark_prompt_shown(session, SupportPromptService.VARIANT_LONG_SESSION)
    return jsonify({"show": True, "variant": "long_session"})


@main_bp.route("/donate/track-support-event", methods=["POST"])
@login_required
def track_support_event():
    """Telemetry + DonationInteraction funnel for support UI (best-effort)."""
    from app.models import DonationInteraction

    data = request.get_json() or {}
    event = (data.get("event") or "").strip()
    variant = data.get("variant")
    source = (data.get("source") or "support_ui").strip()

    event_map = {
        "modal_opened": ("support.modal_opened", "support_modal_opened"),
        "donation_clicked": ("support.donation_clicked", "support_donation_clicked"),
        "license_clicked": ("support.license_clicked", "support_license_clicked"),
        "prompt_shown": ("support.prompt_shown", "support_prompt_shown"),
        "prompt_dismissed": ("support.prompt_dismissed", "support_prompt_dismissed"),
    }
    if event not in event_map:
        return jsonify({"success": False, "error": "unknown event"}), 400

    analytics_name, interaction_type = event_map[event]
    props = {"variant": variant, "source": source}
    track_event(current_user.id, analytics_name, props)

    try:
        metrics = DonationInteraction.get_user_engagement_metrics(current_user.id)
        DonationInteraction.record_interaction(
            user_id=current_user.id,
            interaction_type=interaction_type,
            source=source,
            user_metrics=metrics,
            variant=variant,
        )
    except Exception:
        current_app.logger.debug("Could not record donation interaction", exc_info=True)

    return jsonify({"success": True})


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
