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

    current_break_seconds = 0
    status_action = None
    status_action_at = None
    if active_timer:
        if active_timer.paused_at:
            paused_at = active_timer._naive_dt(active_timer.paused_at)
            current_break_seconds = max(0, int((local_now() - paused_at).total_seconds())) if paused_at else 0
            status_action = "break_started"
            status_action_at = paused_at
        else:
            status_action = "clocked_in"
            status_action_at = active_timer.start_time
            previous_entry = (
                TimeEntry.query.filter(
                    TimeEntry.user_id == current_user.id,
                    TimeEntry.id != active_timer.id,
                    TimeEntry.end_time.isnot(None),
                    TimeEntry.end_time <= active_timer.start_time + timedelta(seconds=10),
                )
                .order_by(TimeEntry.end_time.desc())
                .first()
            )
            if previous_entry and previous_entry.end_time:
                switch_gap = abs((active_timer.start_time - previous_entry.end_time).total_seconds())
                if switch_gap <= 10:
                    status_action = "switched_project"

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
    from sqlalchemy import or_

    from app.utils.timezone import now_in_user_timezone, user_day_bounds_app_naive

    timeline_date = now_in_user_timezone(current_user).date()
    day_start, day_end = user_day_bounds_app_naive(current_user, timeline_date)
    today_entries = TimeEntry.query.filter(
        TimeEntry.user_id == current_user.id,
        TimeEntry.start_time >= day_start,
        TimeEntry.start_time < day_end,
    ).all()
    timeline_entries = TimeEntry.query.filter(
        TimeEntry.user_id == current_user.id,
        TimeEntry.start_time < day_end,
        or_(TimeEntry.end_time.is_(None), TimeEntry.end_time > day_start),
    ).all()
    from app.services.timer_event_service import build_timeline, build_timeline_segments, current_timeline_position
    from app.utils.timezone import get_app_timezone, get_user_timezone_name

    today_timeline = build_timeline(current_user, timeline_entries, timeline_date=timeline_date)
    timeline_segments = build_timeline_segments(today_timeline, user=current_user, timeline_date=timeline_date)
    timeline_now = current_timeline_position(user=current_user, timeline_date=timeline_date)
    timeline_timezone = get_user_timezone_name(current_user) or get_app_timezone()

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
        current_break_seconds=current_break_seconds,
        current_break_formatted=format_elapsed(current_break_seconds),
        status_action=status_action,
        status_action_at=status_action_at,
        today_timeline=today_timeline,
        timeline_segments=timeline_segments,
        timeline_date=timeline_date,
        timeline_now=timeline_now,
        timeline_timezone=timeline_timezone,
        can_edit_timeline=(current_user.is_admin or current_user.has_permission("edit_own_time_entries")),
    )


@main_bp.route("/dashboard/timeline/delete_event", methods=["POST"])
@login_required
def delete_timeline_event():
    """Delete a specific captured timeline event (e.g. a break) without deleting the whole entry."""
    if not (current_user.is_admin or current_user.has_permission("edit_own_time_entries")):
        flash(_("You do not have permission to edit time entries."), "error")
        return redirect(url_for("main.dashboard"))

    from app.models import TimerEvent, TimeEntry
    from app.services.time_tracking_service import TimeTrackingService
    from app.utils.db import safe_commit

    event_id = request.form.get("event_id", type=int)
    entry_id = request.form.get("entry_id", type=int)
    event_type = request.form.get("event_type")

    event = None
    if event_id:
        event = TimerEvent.query.filter_by(id=event_id, user_id=current_user.id).first()
        if not event:
            flash(_("Timeline event not found."), "error")
            return redirect(url_for("main.dashboard"))
        entry = event.entry
        event_type = event.event_type
    else:
        if not entry_id:
            flash(_("Missing event reference."), "error")
            return redirect(url_for("main.dashboard"))
        entry = TimeEntry.query.filter_by(id=entry_id, user_id=current_user.id).first()
        if not entry:
            flash(_("Related time entry not found."), "error")
            return redirect(url_for("main.dashboard"))

    if event_type == "clock_in":
        # Deleting a clock_in deletes the whole entry
        from app.models.timer_event import TimerEvent

        TimerEvent.query.filter_by(time_entry_id=entry.id).delete(synchronize_session=False)
        db.session.delete(entry)
        if safe_commit("delete_time_entry", {"user_id": current_user.id, "entry_id": entry.id}):
            flash(_("Work session deleted."), "success")
        else:
            flash(_("Failed to delete work session."), "error")
        return redirect(url_for("main.dashboard"))

    elif event_type == "clock_out":
        # Resuming the timer by clearing end_time
        can_start, block_reason = TimeTrackingService().can_start_timer(current_user.id)
        if not can_start:
            flash(_("You already have an active timer. Cannot resume this session."), "error")
            return redirect(url_for("main.dashboard"))

        # Resuming a session that has later sessions stacked after it would
        # overlap them; refuse instead of silently corrupting the day.
        has_later_session = (
            TimeEntry.query.filter(
                TimeEntry.user_id == current_user.id,
                TimeEntry.id != entry.id,
                TimeEntry.start_time > entry.start_time,
            ).first()
            is not None
        )
        if has_later_session:
            flash(
                _("This clock-out cannot be deleted because later sessions exist after it. Edit the times instead."),
                "error",
            )
            return redirect(url_for("main.dashboard"))

        entry.end_time = None
        entry.duration_seconds = None
        entry.calculate_duration()  # Will mark as active
        if safe_commit("resume_time_entry", {"user_id": current_user.id, "entry_id": entry.id}):
            flash(_("Clock-out event deleted. Timer resumed."), "success")
        else:
            flash(_("Failed to resume timer."), "error")
        return redirect(url_for("main.dashboard"))

    elif event_type == "project_switch":
        flash(
            _("Cannot directly delete a project switch. Please edit or delete the subsequent session instead."), "error"
        )
        return redirect(url_for("main.dashboard"))

    if not event:
        flash(_("Cannot delete this inferred event."), "error")
        return redirect(url_for("main.dashboard"))

    # For breaks, delete the pair
    if event_type in ["break_start", "break_end"]:
        from app.services.timer_event_service import get_break_events

        all_breaks = get_break_events(current_user.id, entry.id)

        event_index = next((index for index, item in enumerate(all_breaks) if item.id == event.id), None)
        to_delete = [event]

        if event_index is not None:
            if event_type == "break_start" and event_index + 1 < len(all_breaks):
                next_ev = all_breaks[event_index + 1]
                if next_ev.event_type == "break_end":
                    to_delete.append(next_ev)
            elif event_type == "break_end" and event_index > 0:
                prev_ev = all_breaks[event_index - 1]
                if prev_ev.event_type == "break_start":
                    to_delete.append(prev_ev)

        for ev in to_delete:
            db.session.delete(ev)

        db.session.flush()

        # Recompute exact break seconds from remaining break pairs
        from app.services.timer_event_service import get_break_events, sum_break_seconds

        entry.break_seconds = sum_break_seconds(get_break_events(current_user.id, entry.id))
        if entry.end_time:
            entry.calculate_duration()

    else:
        db.session.delete(event)

    if safe_commit("delete_timeline_event", {"user_id": current_user.id, "event_id": event_id}):
        flash(_("Timeline event deleted successfully."), "success")
    else:
        flash(_("Could not delete timeline event."), "error")

    return redirect(url_for("main.dashboard"))


@main_bp.route("/dashboard/timeline/edit", methods=["POST"])
@login_required
def edit_timeline_event():
    """Adjust a clock boundary or captured break event from today's timeline."""
    if not (current_user.is_admin or current_user.has_permission("edit_own_time_entries")):
        flash(_("You do not have permission to edit your time entries."), "error")
        return redirect(url_for("main.dashboard"))

    from app.models import TimerEvent
    from app.services.timer_event_service import recompute_break_seconds
    from app.utils.db import safe_commit
    from app.utils.timezone import parse_user_local_datetime_from_string

    entry_id = request.form.get("entry_id", type=int)
    event_id = request.form.get("event_id", type=int)
    event_type = (request.form.get("event_type") or "").strip()
    new_time = parse_user_local_datetime_from_string(request.form.get("occurred_at"), user=current_user)
    entry = TimeEntry.query.filter_by(id=entry_id, user_id=current_user.id).first()
    event = TimerEvent.query.filter_by(id=event_id, user_id=current_user.id).first() if event_id else None
    if not entry or event_type not in {"clock_in", "project_switch", "clock_out", "break_start", "break_end"}:
        flash(_("Timeline event not found."), "error")
        return redirect(url_for("main.dashboard"))
    if event_id and not event:
        flash(_("Timeline event not found."), "error")
        return redirect(url_for("main.dashboard"))
    if event and (event.time_entry_id != entry.id or event.event_type != event_type):
        flash(_("Timeline event does not match this time entry."), "error")
        return redirect(url_for("main.dashboard"))
    if not new_time:
        flash(_("Choose a valid timestamp."), "error")
        return redirect(url_for("main.dashboard"))

    try:
        old_time = event.occurred_at if event else (entry.end_time if event_type == "clock_out" else entry.start_time)
        if event_type == "clock_in":
            if entry.end_time and new_time >= entry.end_time:
                raise ValueError(_("Clock-in must be before clock-out."))
            previous = (
                TimeEntry.query.filter(
                    TimeEntry.user_id == current_user.id,
                    TimeEntry.id != entry.id,
                    TimeEntry.end_time.isnot(None),
                    TimeEntry.end_time > new_time,
                    TimeEntry.start_time < entry.start_time,
                )
                .order_by(TimeEntry.end_time.desc())
                .first()
            )
            if previous:
                raise ValueError(_("The adjusted time would overlap another entry."))
            entry.start_time = new_time
            # Update all clock_in TimerEvents for this entry and clean up duplicates
            in_events = TimerEvent.query.filter_by(
                user_id=current_user.id, time_entry_id=entry.id, event_type="clock_in"
            ).all()
            for idx, ev in enumerate(in_events):
                if idx == 0:
                    ev.occurred_at = new_time
                else:
                    db.session.delete(ev)
            # Clamp any breaks that started before new clock-in
            breaks = TimerEvent.query.filter_by(user_id=current_user.id, time_entry_id=entry.id).all()
            for b in breaks:
                if b.occurred_at < new_time:
                    b.occurred_at = new_time
            recompute_break_seconds(entry)
        elif event_type == "clock_out":
            if not entry.end_time or new_time <= entry.start_time:
                raise ValueError(_("Clock-out must be after clock-in."))
            following = (
                TimeEntry.query.filter(
                    TimeEntry.user_id == current_user.id,
                    TimeEntry.id != entry.id,
                    TimeEntry.start_time < new_time,
                    TimeEntry.start_time > entry.start_time,
                )
                .order_by(TimeEntry.start_time.asc())
                .first()
            )
            if following:
                raise ValueError(_("The adjusted time would overlap another entry."))
            entry.end_time = new_time
            # Update all clock_out TimerEvents for this entry and clean up duplicates
            out_events = TimerEvent.query.filter_by(
                user_id=current_user.id, time_entry_id=entry.id, event_type="clock_out"
            ).all()
            for idx, ev in enumerate(out_events):
                if idx == 0:
                    ev.occurred_at = new_time
                else:
                    db.session.delete(ev)
            # Clamp any breaks that ended after new clock-out
            breaks = TimerEvent.query.filter_by(user_id=current_user.id, time_entry_id=entry.id).all()
            for b in breaks:
                if b.occurred_at > new_time:
                    b.occurred_at = new_time
            recompute_break_seconds(entry)
        elif event_type == "project_switch":
            related_id = (event.related_entry_id if event else None) or request.form.get("related_entry_id", type=int)
            previous = TimeEntry.query.filter_by(id=related_id, user_id=current_user.id).first() if related_id else None
            if not previous or new_time <= previous.start_time or (entry.end_time and new_time >= entry.end_time):
                raise ValueError(_("The project switch must remain between the two entries."))
            previous.end_time = new_time
            previous.calculate_duration()
            entry.start_time = new_time
            switch_events = TimerEvent.query.filter_by(
                user_id=current_user.id, time_entry_id=entry.id, event_type="project_switch"
            ).all()
            for idx, ev in enumerate(switch_events):
                if idx == 0:
                    ev.occurred_at = new_time
                else:
                    db.session.delete(ev)
        else:
            if not event:
                raise ValueError(_("Historical break details were not recorded and cannot be adjusted individually."))
            events = (
                TimerEvent.query.filter_by(user_id=current_user.id, time_entry_id=entry.id)
                .filter(TimerEvent.event_type.in_(["break_start", "break_end"]))
                .order_by(TimerEvent.occurred_at.asc(), TimerEvent.id.asc())
                .all()
            )
            event_index = next((index for index, item in enumerate(events) if item.id == event.id), None)
            previous_event = events[event_index - 1] if event_index is not None and event_index > 0 else None
            next_event = events[event_index + 1] if event_index is not None and event_index + 1 < len(events) else None
            if new_time < entry.start_time:
                raise ValueError(_("The break event cannot start before clock-in."))
            if entry.end_time and new_time > entry.end_time:
                raise ValueError(_("The break event cannot end after clock-out."))
            if previous_event and new_time < previous_event.occurred_at:
                raise ValueError(_("The timestamp must remain after the previous timeline event."))
            if next_event and new_time > next_event.occurred_at:
                raise ValueError(_("The timestamp must remain before the next timeline event."))

            event.occurred_at = new_time
            if event_type == "break_start" and entry.paused_at and not next_event:
                entry.paused_at = new_time

            recompute_break_seconds(entry)

        if event:
            event.occurred_at = new_time
        if entry.end_time:
            entry.calculate_duration()
        if not safe_commit(
            "edit_timeline_event",
            {"user_id": current_user.id, "entry_id": entry.id, "event_type": event_type},
        ):
            raise ValueError(_("The timeline change could not be saved."))
        Activity.log(
            user_id=current_user.id,
            action="updated",
            entity_type="timer_event",
            entity_id=event.id if event else entry.id,
            entity_name=event_type,
            description=f"Adjusted {event_type} from {old_time.isoformat()} to {new_time.isoformat()}",
            extra_data={"time_entry_id": entry.id, "old_time": old_time.isoformat(), "new_time": new_time.isoformat()},
            ip_address=request.remote_addr,
            user_agent=request.headers.get("User-Agent"),
        )
        flash(_("Timeline updated."), "success")
    except ValueError as exc:
        db.session.rollback()
        flash(str(exc), "error")
    return redirect(url_for("main.dashboard"))


@main_bp.route("/dashboard/timeline/add", methods=["POST"])
@login_required
def add_timeline_event():
    """Insert a complete retroactive break or work session into today's timeline."""
    if not (current_user.is_admin or current_user.has_permission("edit_own_time_entries")):
        flash(_("You do not have permission to edit your time entries."), "error")
        return redirect(url_for("main.dashboard"))

    from sqlalchemy import or_

    from app.models import TimerEvent
    from app.services.timer_event_service import recompute_break_seconds
    from app.utils.db import safe_commit
    from app.utils.scope_filter import user_can_clock_project
    from app.utils.timezone import (
        convert_app_datetime_to_user,
        now_in_user_timezone,
        parse_user_local_datetime_from_string,
    )

    event_kind = (request.form.get("event_kind") or "break").strip()
    start = parse_user_local_datetime_from_string(request.form.get("start_at"), user=current_user)
    end = parse_user_local_datetime_from_string(request.form.get("end_at"), user=current_user)
    today = now_in_user_timezone(current_user).date()

    try:
        if event_kind not in {"break", "work_session", "project_switch"}:
            raise ValueError(_("Choose a valid timeline event."))

        if event_kind != "project_switch":
            if not start or not end or end <= start:
                raise ValueError(_("The end time must be after the start time."))
        else:
            if not start:
                raise ValueError(_("Start time is required for a project switch."))
            end = start  # dummy

        start_user_date = convert_app_datetime_to_user(start, current_user).date()
        end_user_date = convert_app_datetime_to_user(end, current_user).date()
        if start_user_date != today or end_user_date != today:
            raise ValueError(_("Dashboard timeline events must be within today."))

        if event_kind == "project_switch":
            entry = (
                TimeEntry.query.filter(
                    TimeEntry.user_id == current_user.id,
                    TimeEntry.start_time < start,
                    or_(TimeEntry.end_time.is_(None), TimeEntry.end_time > start),
                )
                .order_by(TimeEntry.start_time.desc())
                .first()
            )
            if not entry:
                raise ValueError(_("A project switch must be placed inside an existing work session."))

            project_id = request.form.get("project_id", type=int)
            if not project_id:
                raise ValueError(_("Please select a project to switch to."))
            if not user_can_clock_project(current_user, project_id):
                raise ValueError(_("You do not have access to the selected project."))

            from app.services.timer_event_service import break_event_ids_after_split, get_break_events

            break_events = get_break_events(current_user.id, entry.id)
            break_ids_to_move = break_event_ids_after_split(break_events, start)
            if break_ids_to_move is None:
                raise ValueError(_("A project switch cannot be placed inside a break."))

            paused_at = entry._naive_dt(entry.paused_at) if entry.paused_at else None
            if paused_at and paused_at < start:
                raise ValueError(_("A project switch cannot be placed inside a break."))

            # Create a duplicate entry from the split point.
            new_entry = TimeEntry(
                user_id=current_user.id,
                project_id=project_id,
                start_time=start,
                end_time=entry.end_time,
                source="manual",
                billable=entry.billable,
            )
            if paused_at and paused_at >= start:
                new_entry.paused_at = paused_at
                entry.paused_at = None
            entry.end_time = start

            db.session.add(new_entry)
            db.session.flush()

            # Move complete break pairs only; never leave one half behind.
            for break_event in break_events:
                if break_event.id in break_ids_to_move:
                    break_event.time_entry_id = new_entry.id
            for clock_out_event in TimerEvent.query.filter_by(
                user_id=current_user.id,
                time_entry_id=entry.id,
                event_type="clock_out",
            ).all():
                clock_out_event.time_entry_id = new_entry.id
            db.session.flush()

            # Recompute breaks for both halves of the split session
            from app.services.timer_event_service import get_break_events, sum_break_seconds

            for e in [entry, new_entry]:
                e.break_seconds = sum_break_seconds(get_break_events(current_user.id, e.id))
                if e.end_time:
                    e.calculate_duration()

            switch_event = TimerEvent(
                user_id=current_user.id,
                time_entry_id=new_entry.id,
                related_entry_id=entry.id,
                event_type="project_switch",
                occurred_at=start,
            )
            db.session.add(switch_event)
            db.session.flush()
            entity_id = switch_event.id
            entity_name = "project_switch"

        elif event_kind == "break":
            entry = (
                TimeEntry.query.filter(
                    TimeEntry.user_id == current_user.id,
                    TimeEntry.start_time < start,
                    or_(TimeEntry.end_time.is_(None), TimeEntry.end_time > end),
                )
                .order_by(TimeEntry.start_time.desc())
                .first()
            )
            if not entry:
                raise ValueError(_("A break must be fully inside one work session."))
            break_events = (
                TimerEvent.query.filter_by(user_id=current_user.id, time_entry_id=entry.id)
                .filter(
                    TimerEvent.event_type.in_(["break_start", "break_end"]),
                    TimerEvent.occurred_at >= entry.start_time,
                )
                .order_by(TimerEvent.occurred_at.asc(), TimerEvent.id.asc())
                .all()
            )
            open_break = None
            for item in break_events:
                if item.event_type == "break_start":
                    open_break = item.occurred_at
                elif open_break is not None:
                    if open_break < end and item.occurred_at > start:
                        raise ValueError(_("The new break would overlap an existing break."))
                    open_break = None
            if open_break is not None and open_break < end:
                raise ValueError(_("The new break would overlap an existing break."))

            break_start = TimerEvent(
                user_id=current_user.id,
                time_entry_id=entry.id,
                event_type="break_start",
                occurred_at=start,
            )
            break_end = TimerEvent(
                user_id=current_user.id,
                time_entry_id=entry.id,
                event_type="break_end",
                occurred_at=end,
            )
            db.session.add_all([break_start, break_end])
            db.session.flush()
            recompute_break_seconds(entry)
            entity_id = entry.id
            entity_name = "break"
        else:
            project_id = request.form.get("project_id", type=int)
            project = db.session.get(Project, project_id) if project_id else None
            if not project or project.status != "active" or not user_can_clock_project(current_user, project.id):
                raise ValueError(_("Choose a project available to you."))
            overlap = TimeEntry.query.filter(
                TimeEntry.user_id == current_user.id,
                TimeEntry.start_time < end,
                or_(TimeEntry.end_time.is_(None), TimeEntry.end_time > start),
            ).first()
            if overlap:
                raise ValueError(_("The new work session would overlap an existing entry."))
            entry = TimeEntry(
                user_id=current_user.id,
                project_id=project.id,
                start_time=start,
                end_time=end,
                source="manual",
                billable=project.billable,
            )
            db.session.add(entry)
            db.session.flush()
            entry.calculate_duration()
            db.session.add_all(
                [
                    TimerEvent(
                        user_id=current_user.id,
                        time_entry_id=entry.id,
                        event_type="clock_in",
                        occurred_at=start,
                    ),
                    TimerEvent(
                        user_id=current_user.id,
                        time_entry_id=entry.id,
                        event_type="clock_out",
                        occurred_at=end,
                    ),
                ]
            )
            entity_id = entry.id
            entity_name = "work_session"

        if not safe_commit(
            "add_timeline_event",
            {"user_id": current_user.id, "entry_id": entity_id, "event_kind": entity_name},
        ):
            raise ValueError(_("The timeline event could not be saved."))
        Activity.log(
            user_id=current_user.id,
            action="created",
            entity_type="timer_event",
            entity_id=entity_id,
            entity_name=entity_name,
            description=f"Inserted {entity_name} from {start.isoformat()} to {end.isoformat()}",
            extra_data={"start": start.isoformat(), "end": end.isoformat()},
            ip_address=request.remote_addr,
            user_agent=request.headers.get("User-Agent"),
        )
        flash(_("Timeline event added."), "success")
    except ValueError as exc:
        db.session.rollback()
        flash(str(exc), "error")
    return redirect(url_for("main.dashboard"))


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
