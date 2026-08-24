"""Add the editable timer event timeline.

Revision ID: 180_add_timer_event_timeline
Revises: 179_add_project_icon_emoji
"""

import sqlalchemy as sa
from alembic import op

revision = "180_add_timer_event_timeline"
down_revision = "179_add_project_icon_emoji"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    if "timer_events" in inspector.get_table_names():
        return
    op.create_table(
        "timer_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("time_entry_id", sa.Integer(), sa.ForeignKey("time_entries.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "related_entry_id", sa.Integer(), sa.ForeignKey("time_entries.id", ondelete="SET NULL"), nullable=True
        ),
        sa.Column("event_type", sa.String(length=30), nullable=False),
        sa.Column("occurred_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_timer_events_user_id", "timer_events", ["user_id"])
    op.create_index("ix_timer_events_time_entry_id", "timer_events", ["time_entry_id"])
    op.create_index("ix_timer_events_related_entry_id", "timer_events", ["related_entry_id"])
    op.create_index("ix_timer_events_event_type", "timer_events", ["event_type"])
    op.create_index("ix_timer_events_occurred_at", "timer_events", ["occurred_at"])


def downgrade():
    if "timer_events" in sa.inspect(op.get_bind()).get_table_names():
        op.drop_table("timer_events")
