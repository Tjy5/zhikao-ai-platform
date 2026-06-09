"""Writing feedback prompt builder."""

from __future__ import annotations

from typing import Optional


_SYSTEM_PROMPT = """你是一位资深的写作评阅专家，请对用户作答进行批改。

输出要求：直接输出 Markdown 格式的批改报告，禁止输出 JSON、代码块或内部说明。
"""


def build_raw_grading_system_prompt() -> str:
    """Return the writing feedback system prompt."""
    return _SYSTEM_PROMPT


def build_raw_grading_user_prompt(
    writing_content: str,
    task_type: Optional[str] = None,
) -> str:
    """Build the user prompt for a raw writing feedback request."""
    parts: list[str] = []
    if task_type:
        parts.append(f"【任务类型】{task_type}\n")
    parts.append(f"【材料与作答】\n{writing_content}")
    return "\n".join(parts)


__all__ = [
    "build_raw_grading_system_prompt",
    "build_raw_grading_user_prompt",
]
