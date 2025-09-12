"""add history table

Revision ID: 20250912_0001
Revises: 475eb1c6d425
Create Date: 2025-09-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20250912_0001'
down_revision: Union[str, None] = '475eb1c6d425'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'history',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('kind', sa.String(), nullable=False),
        sa.Column('question_type', sa.String(), nullable=True),
        sa.Column('score', sa.Float(), nullable=True),
        sa.Column('request_json', sa.JSON(), nullable=False),
        sa.Column('response_json', sa.JSON(), nullable=False),
        sa.Column('extra_json', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_history_id'), 'history', ['id'], unique=False)
    op.create_index(op.f('ix_history_created_at'), 'history', ['created_at'], unique=False)
    op.create_index(op.f('ix_history_kind'), 'history', ['kind'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_history_kind'), table_name='history')
    op.drop_index(op.f('ix_history_created_at'), table_name='history')
    op.drop_index(op.f('ix_history_id'), table_name='history')
    op.drop_table('history')

