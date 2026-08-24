"""Add optional uploaded project icons.

Revision ID: 178_add_project_icons
Revises: 177_remove_donation_feature
"""

import sqlalchemy as sa
from alembic import op

revision = "178_add_project_icons"
down_revision = "177_remove_donation_feature"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("projects")}
    if "icon_filename" not in columns:
        with op.batch_alter_table("projects") as batch:
            batch.add_column(sa.Column("icon_filename", sa.String(length=255), nullable=True))


def downgrade():
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("projects")}
    if "icon_filename" in columns:
        with op.batch_alter_table("projects") as batch:
            batch.drop_column("icon_filename")
