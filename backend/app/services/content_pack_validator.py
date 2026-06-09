"""Content-pack manifest validation for public and private content packs."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Sequence, Set, Union

from pydantic import BaseModel, ConfigDict, Field, ValidationError


AllowedLicense = Literal[
    "CC-BY-4.0",
    "CC0-1.0",
    "Apache-2.0",
    "LicenseRef-Private-Commercial",
    "LicenseRef-Internal-Only",
]
OriginPolicy = Literal[
    "original_only",
    "official_source_based",
    "mixed_with_review",
    "licensed_private",
]
ItemType = Literal["knowledge_point", "practice_question", "writing_task"]
ReviewStatus = Literal["draft", "needs_review", "approved", "rejected"]


PUBLIC_LICENSES: Set[str] = {"CC-BY-4.0", "CC0-1.0", "Apache-2.0"}
PRIVATE_LICENSES: Set[str] = {
    "LicenseRef-Private-Commercial",
    "LicenseRef-Internal-Only",
}

PRIVATE_TRACE_PATTERNS = (
    "private_material",
    "private_corpus",
    "legacy_corpus",
    "licensed_private_pack",
    "commercial_training_pack",
    "unlicensed_question_bank",
    "local_private_backup",
)

PRIVATE_PATH_SEGMENTS = {
    "private",
    "private-content",
    "private-material",
    "licensed-private",
    "legacy-corpus",
}

REAL_EXAM_PATTERNS = (
    re.compile(r"真题"),
    re.compile(r"原题"),
    re.compile(r"官方答案"),
    re.compile(r"官方解析"),
    re.compile(r"历年.{0,8}(试题|试卷|真题|原题)"),
    re.compile(r"(19|20)\d{2}.{0,16}(国考|省考|联考|公务员考试|事业单位考试).{0,16}(试题|试卷|真题|原题)"),
)


class SourceRef(BaseModel):
    """External source reference attached to a content item."""

    model_config = ConfigDict(extra="forbid")

    type: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    url: str = Field(..., min_length=1)


class ManifestItem(BaseModel):
    """Manifest entry for a content item file."""

    model_config = ConfigDict(extra="forbid")

    path: str = Field(..., min_length=1)
    item_id: str = Field(..., min_length=1)
    item_type: ItemType
    title: str = Field(..., min_length=1)
    license: AllowedLicense
    origin_policy: OriginPolicy
    review_status: ReviewStatus
    source_refs: List[SourceRef] = Field(default_factory=list)
    originality_declaration: Optional[str] = None


class ContentPackManifest(BaseModel):
    """Top-level content-pack manifest."""

    model_config = ConfigDict(extra="forbid")

    schema_version: str = Field(..., min_length=1)
    pack_id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    version: str = Field(..., min_length=1)
    license: AllowedLicense
    copyright_holder: str = Field(..., min_length=1)
    origin_policy: OriginPolicy
    review_status: ReviewStatus
    source_refs: List[SourceRef] = Field(default_factory=list)
    items: List[ManifestItem] = Field(..., min_length=1)


class ContentItem(BaseModel):
    """Validated content item loaded from a pack."""

    model_config = ConfigDict(extra="forbid")

    item_id: str = Field(..., min_length=1)
    item_type: ItemType
    title: str = Field(..., min_length=1)
    license: AllowedLicense
    copyright_holder: str = Field(..., min_length=1)
    origin_policy: OriginPolicy
    review_status: ReviewStatus
    source_refs: List[SourceRef] = Field(default_factory=list)
    originality_declaration: Optional[str] = None
    body: Dict[str, Any] = Field(..., min_length=1)


class ContentPackValidationReport(BaseModel):
    """Structured report returned by content-pack validation."""

    pack_dir: str
    pack_id: Optional[str] = None
    item_count: int = 0
    valid: bool = False
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


def validate_content_packs(
    pack_dirs: Sequence[Union[Path, str]]
) -> List[ContentPackValidationReport]:
    """Validate multiple content pack directories."""
    return [validate_content_pack(pack_dir) for pack_dir in pack_dirs]


def validate_content_pack(pack_dir: Union[Path, str]) -> ContentPackValidationReport:
    """Validate a content pack manifest and all declared item files."""
    root = Path(pack_dir)
    report = ContentPackValidationReport(pack_dir=str(root))
    errors = report.errors

    manifest = _load_manifest(root, errors)
    if manifest is None:
        return _finalize_report(report)

    report.pack_id = manifest.pack_id
    _validate_manifest_metadata(manifest, root, errors)
    report.item_count = _validate_manifest_items(manifest, root, errors)

    if not errors and manifest.license != "CC-BY-4.0":
        report.warnings.append("public demo packs should normally use CC-BY-4.0")

    return _finalize_report(report)


def _load_manifest(
    root: Path,
    errors: List[str],
) -> Optional[ContentPackManifest]:
    manifest_path = root / "manifest.json"
    if not manifest_path.exists():
        errors.append("manifest.json is missing")
        return None

    manifest_data = _load_json(manifest_path, errors, label="manifest")
    if manifest_data is None:
        return None

    _append_trace_errors(manifest_data, errors, "manifest")

    try:
        return ContentPackManifest.model_validate(manifest_data)
    except ValidationError as exc:
        errors.extend(_format_validation_errors("manifest", exc))
        return None


def _validate_manifest_metadata(
    manifest: ContentPackManifest,
    root: Path,
    errors: List[str],
) -> None:
    if manifest.review_status != "approved":
        errors.append("manifest.review_status must be approved for public validation")
    if manifest.license in PRIVATE_LICENSES and _looks_like_public_sample(root):
        errors.append("content-samples cannot use a private license")
    if manifest.origin_policy == "licensed_private" and _looks_like_public_sample(root):
        errors.append("content-samples cannot use licensed_private origin_policy")


def _validate_manifest_items(
    manifest: ContentPackManifest,
    root: Path,
    errors: List[str],
) -> int:
    seen_item_ids: Set[str] = set()
    pack_root = root.resolve()

    for entry in manifest.items:
        item = _load_manifest_item(entry, pack_root, errors)
        if item is None:
            continue

        if item.item_id in seen_item_ids:
            errors.append(f"duplicate item_id: {item.item_id}")
        seen_item_ids.add(item.item_id)

        if item.license in PRIVATE_LICENSES and _looks_like_public_sample(root):
            errors.append(f"{entry.path}: public sample item cannot use private license")

    return len(seen_item_ids)


def _load_manifest_item(
    entry: ManifestItem,
    pack_root: Path,
    errors: List[str],
) -> Optional[ContentItem]:
    item_path = _resolve_item_path(pack_root, entry.path, errors)
    if item_path is None:
        return None

    _validate_manifest_entry(entry, errors)

    item_data = _load_json(item_path, errors, label=entry.path)
    if item_data is None:
        return None

    _append_trace_errors(item_data, errors, entry.path)

    try:
        item = ContentItem.model_validate(item_data)
    except ValidationError as exc:
        errors.extend(_format_validation_errors(entry.path, exc))
        return None

    _validate_item_contract(entry, item, errors)
    _validate_content_origin(item, errors, context=entry.path)
    return item


def _load_json(
    path: Path,
    errors: List[str],
    *,
    label: str,
) -> Optional[Dict[str, Any]]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        errors.append(f"{label}: invalid JSON: {exc.msg}")
        return None
    if not isinstance(payload, dict):
        errors.append(f"{label}: top-level JSON value must be an object")
        return None
    return payload


def _resolve_item_path(
    pack_root: Path,
    relative_path: str,
    errors: List[str],
) -> Optional[Path]:
    candidate = Path(relative_path)
    if candidate.is_absolute():
        errors.append(f"{relative_path}: item path must be relative")
        return None
    if "\\" in relative_path:
        errors.append(f"{relative_path}: item path must use forward slashes")
        return None
    if candidate.suffix.lower() != ".json":
        errors.append(f"{relative_path}: item path must end with .json")
        return None
    if any(segment in PRIVATE_PATH_SEGMENTS for segment in candidate.parts):
        errors.append(f"{relative_path}: item path contains a private content segment")
        return None

    resolved = (pack_root / candidate).resolve()
    try:
        resolved.relative_to(pack_root)
    except ValueError:
        errors.append(f"{relative_path}: item path escapes the pack directory")
        return None

    if not resolved.exists():
        errors.append(f"{relative_path}: item file does not exist")
        return None
    return resolved


def _validate_manifest_entry(entry: ManifestItem, errors: List[str]) -> None:
    context = entry.path
    if entry.review_status != "approved":
        errors.append(f"{context}: manifest entry review_status must be approved")
    if entry.origin_policy == "original_only" and not _has_text(
        entry.originality_declaration
    ):
        errors.append(f"{context}: original_only manifest entry needs originality_declaration")
    if entry.origin_policy == "official_source_based" and not entry.source_refs:
        errors.append(f"{context}: official_source_based manifest entry needs source_refs")


def _validate_item_contract(
    entry: ManifestItem,
    item: ContentItem,
    errors: List[str],
) -> None:
    comparable_fields = (
        "item_id",
        "item_type",
        "title",
        "license",
        "origin_policy",
        "review_status",
    )
    for field_name in comparable_fields:
        entry_value = getattr(entry, field_name)
        item_value = getattr(item, field_name)
        if entry_value != item_value:
            errors.append(
                f"{entry.path}: manifest {field_name}={entry_value!r} "
                f"does not match item {field_name}={item_value!r}"
            )


def _validate_content_origin(
    item: ContentItem,
    errors: List[str],
    *,
    context: str,
) -> None:
    if item.review_status != "approved":
        errors.append(f"{context}: item review_status must be approved")
    if item.origin_policy == "original_only" and not _has_text(
        item.originality_declaration
    ):
        errors.append(f"{context}: original_only item needs originality_declaration")
    if item.origin_policy == "official_source_based" and not item.source_refs:
        errors.append(f"{context}: official_source_based item needs source_refs")
    if item.origin_policy == "licensed_private" and item.license not in PRIVATE_LICENSES:
        errors.append(f"{context}: licensed_private items must use a private LicenseRef")


def _append_trace_errors(payload: Dict[str, Any], errors: List[str], context: str) -> None:
    text = json.dumps(payload, ensure_ascii=False).lower()
    for pattern in PRIVATE_TRACE_PATTERNS:
        if pattern.lower() in text:
            errors.append(f"{context}: contains private or legacy trace {pattern!r}")
    for regex in REAL_EXAM_PATTERNS:
        if regex.search(text):
            errors.append(f"{context}: contains real-exam marker matching {regex.pattern!r}")


def _format_validation_errors(context: str, exc: ValidationError) -> List[str]:
    formatted = []
    for err in exc.errors():
        loc = ".".join(str(part) for part in err.get("loc", ()))
        msg = err.get("msg", "validation error")
        formatted.append(f"{context}: {loc}: {msg}")
    return formatted


def _looks_like_public_sample(pack_dir: Path) -> bool:
    return pack_dir.name == "content-samples"


def _has_text(value: Optional[str]) -> bool:
    return bool(value and value.strip())


def _finalize_report(report: ContentPackValidationReport) -> ContentPackValidationReport:
    report.valid = not report.errors
    return report
