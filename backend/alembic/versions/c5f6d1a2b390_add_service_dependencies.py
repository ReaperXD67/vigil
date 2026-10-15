"""Add private directed service dependencies.

Revision ID: c5f6d1a2b390
Revises: 81c61159f5c4
"""
from alembic import op
import sqlalchemy as sa

revision = "c5f6d1a2b390"
down_revision = "81c61159f5c4"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "service_dependencies",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("owner_id", sa.String(36), nullable=False),
        sa.Column("upstream_id", sa.String(36), nullable=False),
        sa.Column("service_id", sa.String(36), nullable=False),
        sa.Column("is_sample", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["upstream_id"], ["services.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["service_id"], ["services.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("owner_id", "upstream_id", "service_id", name="uq_dependency_owner_endpoints"),
        sa.CheckConstraint("upstream_id <> service_id", name="ck_dependency_not_self"),
    )
    for column in ("owner_id", "upstream_id", "service_id"):
        op.create_index(f"ix_service_dependencies_{column}", "service_dependencies", [column])


def downgrade():
    op.drop_table("service_dependencies")
