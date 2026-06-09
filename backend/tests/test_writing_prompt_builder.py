"""Unit tests for writing feedback prompt construction."""

from __future__ import annotations

from app.services.writing_prompt_builder import (
    build_raw_grading_system_prompt,
    build_raw_grading_user_prompt,
)


SAMPLE_CONTENT = "Source material.\nUser draft."


def test_system_prompt_is_stable():
    base = build_raw_grading_system_prompt()

    assert "写作评阅专家" in base
    assert "Markdown" in base
    assert build_raw_grading_system_prompt() == base


def test_user_prompt_with_task_type():
    prompt = build_raw_grading_user_prompt(
        SAMPLE_CONTENT,
        task_type="analysis",
    )

    assert "【任务类型】analysis" in prompt
    assert prompt.endswith(f"【材料与作答】\n{SAMPLE_CONTENT}")


def test_user_prompt_without_task_type():
    prompt = build_raw_grading_user_prompt(SAMPLE_CONTENT)

    assert "【任务类型】" not in prompt
    assert prompt == f"【材料与作答】\n{SAMPLE_CONTENT}"
