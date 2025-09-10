#!/usr/bin/env python3
"""
Restore files moved by tools/safe_cleanup.py from the latest .trash/<timestamp>
folder back to their original locations.

Usage:
  python tools/restore_from_trash.py [--timestamp 20240101-120000] [--force]

Notes:
  - If --timestamp is omitted, the newest .trash/<timestamp> is used.
  - Without --force, existing destination files are not overwritten.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import shutil


def latest_trash() -> Path | None:
    t = Path('.trash')
    if not t.exists():
        return None
    subs = [p for p in t.iterdir() if p.is_dir()]
    if not subs:
        return None
    return sorted(subs)[-1]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--timestamp", help="Trash timestamp folder name, e.g. 20240101-120000")
    ap.add_argument("--force", action="store_true", help="Overwrite existing destination files")
    args = ap.parse_args()

    trash_root = Path('.trash') / args.timestamp if args.timestamp else latest_trash()
    if not trash_root or not trash_root.exists():
        raise SystemExit("No trash folder found.")

    manifest = trash_root / 'trash_manifest.json'
    if not manifest.exists():
        raise SystemExit(f"Manifest not found in {trash_root}")

    data = json.loads(manifest.read_text(encoding='utf-8'))
    restored = 0
    for entry in data.get('moved', []):
        src = trash_root / entry['source']
        dest = Path(entry['source'])
        if not src.exists():
            print(f"Skip missing in trash: {src}")
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.exists() and not args.force:
            print(f"Skip existing (use --force to overwrite): {dest}")
            continue
        if dest.exists() and args.force:
            if dest.is_dir():
                shutil.rmtree(dest)
            else:
                dest.unlink()
        shutil.move(str(src), str(dest))
        print(f"Restored {dest}")
        restored += 1

    print(f"\nRestored {restored} item(s) from {trash_root}")


if __name__ == "__main__":
    main()

