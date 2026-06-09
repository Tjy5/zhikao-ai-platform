"""CLI for validating content pack manifests."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Optional, Sequence


BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
sys.path.insert(0, str(BACKEND_ROOT))


def main(argv: Optional[Sequence[str]] = None) -> int:
    from app.services.content_pack_validator import validate_content_packs

    parser = argparse.ArgumentParser(description="Validate content pack directories.")
    parser.add_argument(
        "pack_dirs",
        nargs="*",
        help="Content pack directories. Defaults to repository content-samples/.",
    )
    args = parser.parse_args(argv)

    pack_dirs = [Path(value) for value in args.pack_dirs]
    if not pack_dirs:
        pack_dirs = [REPO_ROOT / "content-samples"]

    reports = validate_content_packs(pack_dirs)
    failed = False
    for report in reports:
        status = "OK" if report.valid else "FAIL"
        pack_id = report.pack_id or "(unknown pack)"
        print(f"[{status}] {report.pack_dir} pack={pack_id} items={report.item_count}")
        for warning in report.warnings:
            print(f"  warning: {warning}")
        for error in report.errors:
            print(f"  error: {error}")
        failed = failed or not report.valid

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
