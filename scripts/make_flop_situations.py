#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

FREQ_EPS = 1e-9

OUT_DIR = Path("out2")
EXPLORED_LIST_PATH = OUT_DIR / "preflop_actions.txt"
ROOT_MARKER = "ROOT"

FLOP_SITUATIONS_PATH = OUT_DIR / "flop_situations.txt"


def sanitize_filename(name: str) -> str:
    if not name:
        return "root"
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("_")
    return safe or "node"


def get_node_path(preflop_actions: str) -> Path:
    return OUT_DIR / (sanitize_filename(preflop_actions) + ".json")


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError(f"invalid json root (expected object): {path}")
    return data


def parse_actions_line(line: str) -> Optional[str]:
    s = line.strip()
    if not s:
        return None
    if s == ROOT_MARKER:
        return ""
    return s


def load_explored_list(path: Path) -> List[str]:
    if not path.exists():
        raise FileNotFoundError(f"not found: {path}")
    out: List[str] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            v = parse_actions_line(line)
            if v is None:
                continue
            out.append(v)
    return out


def append_action(parent: str, code: str) -> str:
    return code if parent == "" else f"{parent}-{code}"


def iter_next_street_actions(spot: Dict[str, Any]) -> List[str]:
    """
    このスポットで「次にこのアクションをしたらフロップに進む」action.code を返す
    - total_frequency > eps
    - next_street == true
    - is_hand_end == false（勝敗確定は除外）
    """
    sols = spot.get("action_solutions")
    if not isinstance(sols, list):
        return []

    codes: List[str] = []
    for sol in sols:
        if not isinstance(sol, dict):
            continue

        try:
            tf = float(sol.get("total_frequency", 0.0))
        except Exception:
            tf = 0.0
        if tf <= FREQ_EPS:
            continue

        act = sol.get("action", {})
        if not isinstance(act, dict):
            continue

        if not bool(act.get("next_street", False)):
            continue
        if bool(act.get("is_hand_end", False)):
            continue

        code = act.get("code")
        if isinstance(code, str) and code:
            codes.append(code)

    return codes


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    nodes = load_explored_list(EXPLORED_LIST_PATH)
    # ROOTを含む前提だが、無くても一応動く
    node_set = set(nodes)

    flop_situations: Set[str] = set()
    missing_json = 0
    processed = 0

    for node in node_set:
        path = get_node_path(node)
        if not path.exists():
            missing_json += 1
            continue

        spot = load_json(path)
        codes = iter_next_street_actions(spot)
        if not codes:
            continue

        for code in codes:
            flop_situations.add(append_action(node, code))

        processed += 1

    # 並び：短い順 → 文字列
    ordered = sorted(flop_situations, key=lambda s: (s.count("-"), s))

    tmp = FLOP_SITUATIONS_PATH.with_suffix(".txt.tmp")
    with tmp.open("w", encoding="utf-8") as f:
        for s in ordered:
            f.write(s + "\n")
    tmp.replace(FLOP_SITUATIONS_PATH)

    print("done.")
    print(f"flop_situations={len(ordered)} -> {FLOP_SITUATIONS_PATH.resolve()}")
    if missing_json:
        print(f"[warn] missing json files for {missing_json} nodes (skipped)")
    print(f"processed_nodes_with_next_street={processed}")


if __name__ == "__main__":
    main()
