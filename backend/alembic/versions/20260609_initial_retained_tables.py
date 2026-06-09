"""Initial retained application tables.

Revision ID: 20260609_initial_retained
Revises:
Create Date: 2026-06-09 17:45:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260609_initial_retained"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "history",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("task_type", sa.String(), nullable=True),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("request_json", sa.JSON(), nullable=False),
        sa.Column("response_json", sa.JSON(), nullable=False),
        sa.Column("extra_json", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_history_id"), "history", ["id"], unique=False)
    op.create_index(op.f("ix_history_user_id"), "history", ["user_id"], unique=False)
    op.create_index(op.f("ix_history_created_at"), "history", ["created_at"], unique=False)
    op.create_index(op.f("ix_history_kind"), "history", ["kind"], unique=False)

    op.create_table(
        "user_ai_model_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("provider_name", sa.String(), nullable=False),
        sa.Column("base_url", sa.String(), nullable=False),
        sa.Column("model_name", sa.String(), nullable=False),
        sa.Column("api_key_encrypted", sa.Text(), nullable=True),
        sa.Column("api_key_hint", sa.String(), nullable=True),
        sa.Column("json_fallback_enabled", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("last_test_status", sa.String(), nullable=True),
        sa.Column("last_tested_at", sa.DateTime(), nullable=True),
        sa.Column("last_failure_classification", sa.String(), nullable=True),
        sa.Column("last_successful_mode", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_user_ai_model_settings_user_id"),
    )
    op.create_index(
        op.f("ix_user_ai_model_settings_id"),
        "user_ai_model_settings",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_user_ai_model_settings_user_id"),
        "user_ai_model_settings",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_user_ai_model_settings_user_id"), table_name="user_ai_model_settings")
    op.drop_index(op.f("ix_user_ai_model_settings_id"), table_name="user_ai_model_settings")
    op.drop_table("user_ai_model_settings")

    op.drop_index(op.f("ix_history_kind"), table_name="history")
    op.drop_index(op.f("ix_history_created_at"), table_name="history")
    op.drop_index(op.f("ix_history_user_id"), table_name="history")
    op.drop_index(op.f("ix_history_id"), table_name="history")
    op.drop_table("history")

    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_table("users")
