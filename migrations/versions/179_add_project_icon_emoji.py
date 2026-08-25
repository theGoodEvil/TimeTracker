"""Add emoji project icons.

Revision ID: 179_add_project_icon_emoji
Revises: 178_add_project_icons
"""

import sqlalchemy as sa
from alembic import op

revision = "179_add_project_icon_emoji"
down_revision = "178_add_project_icons"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("projects")}
    if "icon_emoji" not in columns:
        with op.batch_alter_table("projects") as batch:
            batch.add_column(sa.Column("icon_emoji", sa.String(length=32), nullable=True))


def downgrade():
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("projects")}
    if "icon_emoji" in columns:
        with op.batch_alter_table("projects") as batch:
            batch.drop_column("icon_emoji")
