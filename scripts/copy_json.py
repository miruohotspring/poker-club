#!/usr/bin/env python3
from __future__ import annotations

import csv
import re
import shutil
from pathlib import Path
from typing import Set

CSV_PATH = Path("../out2/cash6m100bb/spot_frequencies_by_position.csv")

SRC_DIR = Path("../out2/cash6m100bb")

DST_DIR = Path("../solutions/cash6m100bb")

ROOT_MARKER = "ROOT"


def sanitize_filename(preflop_actions: str) -> str:
    if not preflop_actions:
        return "root"
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", preflop_actions).strip("_")
    return safe or "node"


def normalize_actions(value: str) -> str:
    v = (value or "").strip()
    if v == ROOT_MARKER:
        return ""
    return v


def main() -> None:
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"CSV not found: {CSV_PATH}")

    DST_DIR.mkdir(parents=True, exist_ok=True)

    uniq: Set[str] = set()
    missing = 0
    copied = 0

    with CSV_PATH.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames or "preflop_actions" not in reader.fieldnames:
            raise RuntimeError("CSV must have 'preflop_actions' column")

        for row in reader:
            actions = normalize_actions(row.get("preflop_actions", ""))
            if actions in uniq:
                continue
            uniq.add(actions)

            src = SRC_DIR / f"{sanitize_filename(actions)}.json"
            dst = DST_DIR / src.name

            if not src.exists():
                missing += 1
                continue

            shutil.copy2(src, dst)
            copied += 1

    print("done.")
    print(f"unique_actions={len(uniq)}")
    print(f"copied={copied}")
    print(f"missing={missing}")
    print(f"dst_dir={DST_DIR.resolve()}")


if __name__ == "__main__":
    main()
