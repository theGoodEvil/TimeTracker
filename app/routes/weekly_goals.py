from datetime import datetime, timedelta

from flask import Blueprint, current_app, flash, jsonify, redirect, render_template, request, url_for
from flask_babel import gettext as _
from flask_login import current_user, login_required
from sqlalchemy import func

from app import db, log_event, track_event
from app.models import TimeEntry, User, WeeklyTimeGoal
from app.utils.db import safe_commit
from app.utils.module_helpers import module_enabled

weekly_goals_bp = Blueprint("weekly_goals", __name__)


@weekly_goals_bp.route("/goals")
@login_required
def index():
    """Display EvilTime's expected/actual calendar-week ledger."""
    current_app.logger.info(f"GET /goals user={current_user.username}")

    from app.services.weekly_work_service import WeeklyWorkService

    target_user = current_user
    requested_user_id = request.args.get("user_id", type=int)
    if requested_user_id and requested_user_id != current_user.id:
        if not current_user.is_admin:
            flash(_("You do not have permission to view another user's weekly overview."), "error")
            return redirect(url_for("weekly_goals.index"))
        target_user = User.query.get_or_404(requested_user_id)

    ledger_rows = WeeklyWorkService.rows(target_user, limit=None)
    users = User.query.order_by(User.username).all() if current_user.is_admin else []
    track_event(user_id=current_user.id, event_name="weekly_goals_viewed")
    return render_template(
        "weekly_goals/index.html",
        ledger_rows=ledger_rows,
        ledger_user=target_user,
        ledger_users=users,
    )


@weekly_goals_bp.route("/work-weeks/adjust", methods=["POST"])
@login_required
def adjust_week():
    """Create or amend an expected/actual calendar-week record."""
    from app.services.weekly_work_service import WeeklyWorkService

    try:
        week = datetime.strptime((request.form.get("week_start") or "").strip(), "%Y-%m-%d").date()
        expected = float(request.form.get("expected_hours", ""))
        actual_raw = (request.form.get("actual_hours") or "").strip()
        actual = float(actual_raw) if actual_raw else None
        if not 0 <= expected <= 168 or (actual is not None and not 0 <= actual <= 168):
            raise ValueError
    except (TypeError, ValueError):
        flash(_("Enter a valid week and hours between 0 and 168."), "error")
        return redirect(request.referrer or url_for("weekly_goals.index"))

    target_user = current_user
    target_user_id = request.form.get("user_id", type=int)
    if target_user_id and target_user_id != current_user.id:
        if not current_user.is_admin:
            flash(_("You do not have permission to change another user's weekly hours."), "error")
            return redirect(url_for("weekly_goals.index"))
        target_user = User.query.get_or_404(target_user_id)

    WeeklyWorkService.upsert_adjustment(
        target_user,
        week,
        expected,
        actual_override=actual,
        notes=(request.form.get("notes") or "").strip() or None,
    )
    if safe_commit("weekly_work_adjustment", {"user_id": target_user.id, "week_start": week.isoformat()}):
        flash(_("Calendar week updated."), "success")
    else:
        flash(_("Could not update the calendar week."), "error")
    return redirect(request.referrer or url_for("weekly_goals.index"))


@weekly_goals_bp.route("/goals/create", methods=["GET", "POST"])
@login_required
@module_enabled("weekly_goals")
def create():
    """Create a new weekly time goal"""
    if request.method == "GET":
        current_app.logger.info(f"GET /goals/create user={current_user.username}")
        return render_template("weekly_goals/create.html")

    # POST request
    current_app.logger.info(f"POST /goals/create user={current_user.username}")

    target_hours = request.form.get("target_hours", type=float)
    week_start_date_str = request.form.get("week_start_date")
    notes = request.form.get("notes", "").strip()
    exclude_weekends = request.form.get("exclude_weekends") == "1"

    if not target_hours or target_hours <= 0:
        flash(_("Please enter a valid target hours (greater than 0)"), "error")
        return redirect(url_for("weekly_goals.create"))

    # Parse week start date
    week_start_date = None
    if week_start_date_str:
        try:
            week_start_date = datetime.strptime(week_start_date_str, "%Y-%m-%d").date()
        except ValueError:
            flash(_("Invalid date format"), "error")
            return redirect(url_for("weekly_goals.create"))

    # Check if goal already exists for this week
    if week_start_date:
        existing_goal = WeeklyTimeGoal.query.filter(
            WeeklyTimeGoal.user_id == current_user.id,
            WeeklyTimeGoal.week_start_date == week_start_date,
            WeeklyTimeGoal.status != "cancelled",
        ).first()

        if existing_goal:
            flash(_("A goal already exists for this week. Please edit the existing goal instead."), "warning")
            return redirect(url_for("weekly_goals.edit", goal_id=existing_goal.id))

    # Create new goal
    goal = WeeklyTimeGoal(
        user_id=current_user.id,
        target_hours=target_hours,
        week_start_date=week_start_date,
        notes=notes,
        exclude_weekends=exclude_weekends,
    )

    db.session.add(goal)

    if safe_commit(db.session):
        flash(_("Weekly time goal created successfully!"), "success")
        log_event(
            "weekly_goal.created",
            user_id=current_user.id,
            resource_type="weekly_goal",
            resource_id=goal.id,
            target_hours=target_hours,
            week_label=goal.week_label,
        )
        track_event(
            user_id=current_user.id,
            event_name="weekly_goal_created",
            properties={"target_hours": target_hours, "week_label": goal.week_label},
        )
        return redirect(url_for("weekly_goals.index"))
    else:
        flash(_("Failed to create goal. Please try again."), "error")
        return redirect(url_for("weekly_goals.create"))


@weekly_goals_bp.route("/goals/<int:goal_id>")
@login_required
@module_enabled("weekly_goals")
def view(goal_id):
    """View details of a specific weekly goal"""
    current_app.logger.info(f"GET /goals/{goal_id} user={current_user.username}")

    goal = WeeklyTimeGoal.query.get_or_404(goal_id)

    # Ensure user can only view their own goals
    if goal.user_id != current_user.id:
        flash(_("You do not have permission to view this goal"), "error")
        return redirect(url_for("weekly_goals.index"))

    # Update goal status
    goal.update_status()

    # Get time entries for this week
    time_entries = (
        TimeEntry.query.filter(
            TimeEntry.user_id == current_user.id,
            TimeEntry.end_time.isnot(None),
            func.date(TimeEntry.start_time) >= goal.week_start_date,
            func.date(TimeEntry.start_time) <= goal.week_end_date,
        )
        .order_by(TimeEntry.start_time.desc())
        .all()
    )

    # Calculate daily breakdown
    daily_hours = {}
    for entry in time_entries:
        entry_date = entry.start_time.date()
        # If exclude_weekends is True, skip weekend entries
        if goal.exclude_weekends and entry_date.weekday() >= 5:
            continue
        if entry_date not in daily_hours:
            daily_hours[entry_date] = 0
        daily_hours[entry_date] += entry.duration_seconds / 3600

    # Fill in missing days with 0 (excluding weekends if exclude_weekends is True)
    current_date = goal.week_start_date
    while current_date <= goal.week_end_date:
        # Skip weekends if exclude_weekends is True
        if goal.exclude_weekends and current_date.weekday() >= 5:
            current_date += timedelta(days=1)
            continue
        if current_date not in daily_hours:
            daily_hours[current_date] = 0
        current_date += timedelta(days=1)

    # Sort by date
    daily_hours = dict(sorted(daily_hours.items()))

    track_event(
        user_id=current_user.id,
        event_name="weekly_goal_viewed",
        properties={"goal_id": goal_id, "week_label": goal.week_label},
    )

    return render_template("weekly_goals/view.html", goal=goal, time_entries=time_entries, daily_hours=daily_hours)


@weekly_goals_bp.route("/goals/<int:goal_id>/edit", methods=["GET", "POST"])
@login_required
@module_enabled("weekly_goals")
def edit(goal_id):
    """Edit a weekly time goal"""
    goal = WeeklyTimeGoal.query.get_or_404(goal_id)

    # Ensure user can only edit their own goals
    if goal.user_id != current_user.id:
        flash(_("You do not have permission to edit this goal"), "error")
        return redirect(url_for("weekly_goals.index"))

    if request.method == "GET":
        current_app.logger.info(f"GET /goals/{goal_id}/edit user={current_user.username}")
        return render_template("weekly_goals/edit.html", goal=goal)

    # POST request
    current_app.logger.info(f"POST /goals/{goal_id}/edit user={current_user.username}")

    target_hours = request.form.get("target_hours", type=float)
    notes = request.form.get("notes", "").strip()
    status = request.form.get("status")
    exclude_weekends = request.form.get("exclude_weekends") == "1"

    if not target_hours or target_hours <= 0:
        flash(_("Please enter a valid target hours (greater than 0)"), "error")
        return redirect(url_for("weekly_goals.edit", goal_id=goal_id))

    # Update goal
    old_target = goal.target_hours
    old_exclude_weekends = goal.exclude_weekends
    goal.target_hours = target_hours
    goal.notes = notes
    goal.exclude_weekends = exclude_weekends

    # If exclude_weekends changed, recalculate week_end_date
    if old_exclude_weekends != exclude_weekends:
        if exclude_weekends:
            goal.week_end_date = goal.week_start_date + timedelta(days=4)  # Monday to Friday
        else:
            goal.week_end_date = goal.week_start_date + timedelta(days=6)  # Monday to Sunday

    if status and status in ["active", "completed", "failed", "cancelled"]:
        goal.status = status

    if safe_commit(db.session):
        flash(_("Weekly time goal updated successfully!"), "success")
        log_event(
            "weekly_goal.updated",
            user_id=current_user.id,
            resource_type="weekly_goal",
            resource_id=goal.id,
            old_target=old_target,
            new_target=target_hours,
            week_label=goal.week_label,
        )
        track_event(
            user_id=current_user.id,
            event_name="weekly_goal_updated",
            properties={"goal_id": goal_id, "new_target": target_hours},
        )
        return redirect(url_for("weekly_goals.view", goal_id=goal_id))
    else:
        flash(_("Failed to update goal. Please try again."), "error")
        return redirect(url_for("weekly_goals.edit", goal_id=goal_id))


@weekly_goals_bp.route("/goals/<int:goal_id>/delete", methods=["POST"])
@login_required
@module_enabled("weekly_goals")
def delete(goal_id):
    """Delete a weekly time goal"""
    current_app.logger.info(f"POST /goals/{goal_id}/delete user={current_user.username}")

    goal = WeeklyTimeGoal.query.get_or_404(goal_id)

    # Ensure user can only delete their own goals
    if goal.user_id != current_user.id:
        flash(_("You do not have permission to delete this goal"), "error")
        return redirect(url_for("weekly_goals.index"))

    week_label = goal.week_label

    db.session.delete(goal)

    if safe_commit(db.session):
        flash(_("Weekly time goal deleted successfully"), "success")
        log_event(
            "weekly_goal.deleted",
            user_id=current_user.id,
            resource_type="weekly_goal",
            resource_id=goal_id,
            week_label=week_label,
        )
        track_event(user_id=current_user.id, event_name="weekly_goal_deleted", properties={"goal_id": goal_id})
    else:
        flash(_("Failed to delete goal. Please try again."), "error")

    return redirect(url_for("weekly_goals.index"))


# API Endpoints


@weekly_goals_bp.route("/api/goals/current")
@login_required
@module_enabled("weekly_goals")
def api_current_goal():
    """API endpoint to get current week's goal"""
    current_app.logger.info(f"GET /api/goals/current user={current_user.username}")

    goal = WeeklyTimeGoal.get_current_week_goal(current_user.id)

    if goal:
        goal.update_status()
        return jsonify(goal.to_dict())
    else:
        return jsonify({"error": "No goal set for current week"}), 404


@weekly_goals_bp.route("/api/goals")
@login_required
@module_enabled("weekly_goals")
def api_list_goals():
    """API endpoint to list all goals for current user"""
    current_app.logger.info(f"GET /api/goals user={current_user.username}")

    limit = request.args.get("limit", 12, type=int)
    status_filter = request.args.get("status")

    query = WeeklyTimeGoal.query.filter_by(user_id=current_user.id)

    if status_filter:
        query = query.filter_by(status=status_filter)

    goals = query.order_by(WeeklyTimeGoal.week_start_date.desc()).limit(limit).all()

    # Update status for all goals
    for goal in goals:
        goal.update_status()

    return jsonify([goal.to_dict() for goal in goals])


@weekly_goals_bp.route("/api/goals/<int:goal_id>")
@login_required
@module_enabled("weekly_goals")
def api_get_goal(goal_id):
    """API endpoint to get a specific goal"""
    current_app.logger.info(f"GET /api/goals/{goal_id} user={current_user.username}")

    goal = WeeklyTimeGoal.query.get_or_404(goal_id)

    # Ensure user can only view their own goals
    if goal.user_id != current_user.id:
        return jsonify({"error": "Unauthorized"}), 403

    goal.update_status()
    return jsonify(goal.to_dict())


@weekly_goals_bp.route("/api/goals/stats")
@login_required
@module_enabled("weekly_goals")
def api_stats():
    """API endpoint to get goal statistics"""
    current_app.logger.info(f"GET /api/goals/stats user={current_user.username}")

    # Get all goals for the user
    goals = (
        WeeklyTimeGoal.query.filter_by(user_id=current_user.id).order_by(WeeklyTimeGoal.week_start_date.desc()).all()
    )

    # Update status for all goals
    for goal in goals:
        goal.update_status()

    # Calculate statistics
    total = len(goals)
    completed = sum(1 for g in goals if g.status == "completed")
    failed = sum(1 for g in goals if g.status == "failed")
    active = sum(1 for g in goals if g.status == "active")
    cancelled = sum(1 for g in goals if g.status == "cancelled")

    completion_rate = 0
    if total > 0:
        completed_or_failed = completed + failed
        if completed_or_failed > 0:
            completion_rate = round((completed / completed_or_failed) * 100, 1)

    # Calculate average target hours
    avg_target = 0
    if total > 0:
        avg_target = round(sum(g.target_hours for g in goals) / total, 2)

    # Calculate average actual hours
    avg_actual = 0
    if total > 0:
        avg_actual = round(sum(g.actual_hours for g in goals) / total, 2)

    # Get current streak (consecutive weeks with completed goals)
    current_streak = 0
    for goal in goals:
        if goal.status == "completed":
            current_streak += 1
        elif goal.status in ["failed", "cancelled"]:
            break

    return jsonify(
        {
            "total_goals": total,
            "completed": completed,
            "failed": failed,
            "active": active,
            "cancelled": cancelled,
            "completion_rate": completion_rate,
            "average_target_hours": avg_target,
            "average_actual_hours": avg_actual,
            "current_streak": current_streak,
        }
    )
