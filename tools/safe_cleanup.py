#!/usr/bin/env python3
"""
Safely move unwanted files/dirs to a timestamped .trash folder, based on
cleanup_candidates.txt. Nothing is deleted permanently.

Usage:
  python tools/safe_cleanup.py [--manifest cleanup_candidates.txt] [--dry-run]

Notes:
  - Supports simple glob patterns (*, ?, **)
  - Preserves relative paths inside .trash/<timestamp>/
  - Writes a manifest JSON in the trash folder for easy restore
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import shutil
from datetime import datetime
from typing import List


def read_candidates(manifest_path: Path) -> List[str]:
    items: List[str] = []
    for line in manifest_path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        items.append(s)
    return items


def expand_globs(pattern: str) -> List[Path]:
    # Use pathlib glob with ** support
    p = Path(pattern)
    if any(ch in pattern for ch in ["*", "?", "["]):
        # Expand from repo root
        return [Path(x) for x in Path('.').glob(pattern)]
    else:
        return [p]


def move_to_trash(paths: List[Path], trash_root: Path, dry_run: bool = False) -> List[dict]:
    moved: List[dict] = []
    for src in paths:
        if not src.exists():
            continue
        # Normalize and ensure within repo
        rel = src.resolve().relative_to(Path('.').resolve()) if src.is_absolute() else src
        dest = trash_root / rel
        if dry_run:
            print(f"[DRY-RUN] Move {rel} -> {dest}")
        else:
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(rel), str(dest))
            print(f"Moved {rel} -> {dest}")
        moved.append({"source": str(rel), "trash": str(dest)})
    return moved


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", default="cleanup_candidates.txt", help="Path to cleanup manifest")
    ap.add_argument("--dry-run", action="store_true", help="Show what would be moved")
    args = ap.parse_args()

    manifest = Path(args.manifest)
    if not manifest.exists():
        raise SystemExit(f"Manifest not found: {manifest}")

    items = read_candidates(manifest)
    # Build list of actual paths from patterns, de-duplicate while preserving order
    seen = set()
    to_move: List[Path] = []
    for pat in items:
        for m in expand_globs(pat):
            # Skip non-existing now; will be ignored later
            key = str(m)
            if key not in seen:
                seen.add(key)
                to_move.append(m)

    # Prepare trash root
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    trash_root = Path(".trash") / ts
    if not args.dry_run:
        trash_root.mkdir(parents=True, exist_ok=True)

    moved = move_to_trash(to_move, trash_root, dry_run=args.dry_run)

    if not args.dry_run:
        # Write manifest of moved items
        manifest_json = {
            "timestamp": ts,
            "moved": moved,
        }
        (trash_root / "trash_manifest.json").write_text(
            json.dumps(manifest_json, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"\nWrote {trash_root / 'trash_manifest.json'}")
        print("Safe cleanup complete. You can restore with tools/restore_from_trash.py")
    else:
        print("\nDry run complete. Nothing moved.")


if __name__ == "__main__":
    main()

