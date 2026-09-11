"""Per-day state for the automatic clock-out after the daily working hours."""

from datetime import datetime

from app import db


class AutoClockOutState(db.Model):
    """Extensions, pending warning, and outcome of auto clock-out for one user-day."""

    __tablename__ = "auto_clock_out_states"
    __table_args__ = (db.UniqueConstraint("user_id", "work_date", name="uq_auto_clock_out_user_day"),)

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    work_date = db.Column(db.Date, nullable=False, index=True)
    # Minutes of overtime the user approved on top of their standard hours.
    extension_minutes = db.Column(db.Integer, nullable=False, default=0)
    # Pending warning: sent at ``warned_at`` for the running ``warned_entry_id``
    # at ``warned_limit_seconds``; the timer is stopped at ``deadline_at``.
    warned_at = db.Column(db.DateTime, nullable=True)
    warned_entry_id = db.Column(db.Integer, db.ForeignKey("time_entries.id", ondelete="SET NULL"), nullable=True)
    warned_limit_seconds = db.Column(db.Integer, nullable=True)
    deadline_at = db.Column(db.DateTime, nullable=True)
    auto_clocked_out_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def clear_warning(self):
        self.warned_at = None
        self.warned_entry_id = None
        self.warned_limit_seconds = None
        self.deadline_at = None

    def __repr__(self):
        return f"<AutoClockOutState user={self.user_id} day={self.work_date} +{self.extension_minutes}m>"
