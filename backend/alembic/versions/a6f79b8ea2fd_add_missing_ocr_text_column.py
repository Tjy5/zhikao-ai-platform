"""add missing question_images columns

Revision ID: a6f79b8ea2fd
Revises: 0dedcafa2bef
Create Date: 2025-09-16 09:30:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a6f79b8ea2fd'
down_revision: Union[str, None] = '0dedcafa2bef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _copy_column_if_both_exist(source: str, target: str) -> None:
    op.execute(
        f"""
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'question_images' AND column_name = '{source}'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'question_images' AND column_name = '{target}'
    ) THEN
        EXECUTE 'UPDATE question_images SET {target} = {source} WHERE {target} IS NULL';
    END IF;
END $$;
"""
    )


def upgrade() -> None:
    # Bring legacy databases up to date with the latest model definition
    op.execute("ALTER TABLE question_images ADD COLUMN IF NOT EXISTS ocr_text TEXT")
    op.execute("ALTER TABLE question_images ADD COLUMN IF NOT EXISTS context_text TEXT")
    op.execute("ALTER TABLE question_images ADD COLUMN IF NOT EXISTS paragraph_index INTEGER")
    op.execute("ALTER TABLE question_images ADD COLUMN IF NOT EXISTS position_in_question INTEGER")
    op.execute("ALTER TABLE question_images ADD COLUMN IF NOT EXISTS order_index INTEGER")

    _copy_column_if_both_exist('image_order', 'order_index')
    _copy_column_if_both_exist('source_paragraph_index', 'paragraph_index')


def downgrade() -> None:
    op.execute("ALTER TABLE question_images DROP COLUMN IF EXISTS order_index")
    op.execute("ALTER TABLE question_images DROP COLUMN IF EXISTS position_in_question")
    op.execute("ALTER TABLE question_images DROP COLUMN IF EXISTS paragraph_index")
    op.execute("ALTER TABLE question_images DROP COLUMN IF EXISTS context_text")
    op.execute("ALTER TABLE question_images DROP COLUMN IF EXISTS ocr_text")
