"""Tests for content-pack validation."""
from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any, Dict, List

from app.services.content_pack_validator import validate_content_pack


REPO_ROOT = Path(__file__).resolve().parents[2]


def test_bundled_demo_pack_is_valid():
    report = validate_content_pack(REPO_ROOT / "content-samples")

    assert report.valid is True
    assert report.errors == []
    assert report.pack_id == "open-civil-service-demo"
    assert report.item_count == 6


def test_missing_license_fails(tmp_path):
    pack_dir = _write_pack(tmp_path)
    manifest_path = pack_dir / "manifest.json"
    manifest = _read_json(manifest_path)
    manifest.pop("license")
    _write_json(manifest_path, manifest)

    report = validate_content_pack(pack_dir)

    assert report.valid is False
    assert _has_error(report.errors, "manifest: license")


def test_missing_origin_declaration_fails(tmp_path):
    pack_dir = _write_pack(tmp_path)
    item_path = pack_dir / "questions" / "sample.json"
    item = _read_json(item_path)
    item.pop("originality_declaration")
    _write_json(item_path, item)

    report = validate_content_pack(pack_dir)

    assert report.valid is False
    assert _has_error(report.errors, "original_only item needs originality_declaration")


def test_unsafe_path_fails(tmp_path):
    pack_dir = _write_pack(tmp_path)
    manifest_path = pack_dir / "manifest.json"
    manifest = _read_json(manifest_path)
    manifest["items"][0]["path"] = "../outside.json"
    _write_json(manifest_path, manifest)

    report = validate_content_pack(pack_dir)

    assert report.valid is False
    assert _has_error(report.errors, "escapes the pack directory")


def test_duplicate_item_id_fails(tmp_path):
    pack_dir = _write_pack(tmp_path)
    manifest_path = pack_dir / "manifest.json"
    manifest = _read_json(manifest_path)
    second_entry = copy.deepcopy(manifest["items"][0])
    second_entry["path"] = "questions/duplicate.json"
    manifest["items"].append(second_entry)
    _write_json(manifest_path, manifest)

    original_item = _read_json(pack_dir / "questions" / "sample.json")
    _write_json(pack_dir / "questions" / "duplicate.json", original_item)

    report = validate_content_pack(pack_dir)

    assert report.valid is False
    assert _has_error(report.errors, "duplicate item_id")


def test_private_or_legacy_trace_fails(tmp_path):
    pack_dir = _write_pack(tmp_path)
    item_path = pack_dir / "questions" / "sample.json"
    item = _read_json(item_path)
    item["body"]["explanation"] = "Do not import private_material corpus text."
    _write_json(item_path, item)

    report = validate_content_pack(pack_dir)

    assert report.valid is False
    assert _has_error(report.errors, "private or legacy trace")


def _write_pack(tmp_path: Path) -> Path:
    pack_dir = tmp_path / "pack"
    question_dir = pack_dir / "questions"
    question_dir.mkdir(parents=True)

    manifest = {
        "schema_version": "1.0",
        "pack_id": "test-pack",
        "title": "Test Pack",
        "description": "A minimal test pack.",
        "version": "0.1.0",
        "license": "CC-BY-4.0",
        "copyright_holder": "Test contributors",
        "origin_policy": "original_only",
        "review_status": "approved",
        "items": [
            {
                "path": "questions/sample.json",
                "item_id": "sample-question-001",
                "item_type": "practice_question",
                "title": "Sample Question",
                "license": "CC-BY-4.0",
                "origin_policy": "original_only",
                "review_status": "approved",
                "originality_declaration": "Created from scratch for tests.",
            }
        ],
    }
    item = {
        "item_id": "sample-question-001",
        "item_type": "practice_question",
        "title": "Sample Question",
        "license": "CC-BY-4.0",
        "copyright_holder": "Test contributors",
        "origin_policy": "original_only",
        "review_status": "approved",
        "source_refs": [],
        "originality_declaration": "Created from scratch for tests.",
        "body": {
            "stem": "Which option improves a public service workflow?",
            "options": [
                {"key": "A", "text": "Repeat the same form fields."},
                {"key": "B", "text": "Remove duplicate fields and show status."},
            ],
            "answer_key": "B",
            "explanation": "This is an original unit-test item.",
        },
    }
    _write_json(pack_dir / "manifest.json", manifest)
    _write_json(question_dir / "sample.json", item)
    return pack_dir


def _read_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _has_error(errors: List[str], needle: str) -> bool:
    return any(needle in error for error in errors)
