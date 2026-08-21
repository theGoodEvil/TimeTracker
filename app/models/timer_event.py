"""Auditable clock and break events used by the dashboard timeline."""

from datetime import datetime

from app import db


class TimerEvent(db.Model):
    __tablename__ = "timer_events"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    time_entry_id = db.Column(
        db.Integer, db.ForeignKey("time_entries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    related_entry_id = db.Column(
        db.Integer, db.ForeignKey("time_entries.id", ondelete="SET NULL"), nullable=True, index=True
    )
    event_type = db.Column(db.String(30), nullable=False, index=True)
    occurred_at = db.Column(db.DateTime, nullable=False, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    entry = db.relationship("TimeEntry", foreign_keys=[time_entry_id])
    related_entry = db.relationship("TimeEntry", foreign_keys=[related_entry_id])
