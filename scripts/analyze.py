#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import re
from collections import deque
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

FREQ_EPS = 1e-9

OUT_DIR = Path("out2")
EXPLORED_LIST_PATH = OUT_DIR / "preflop_actions.txt"  # ROOT含む前提
ROOT_MARKER = "ROOT"

# POSITIONS = ["UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BTN", "SB", "BB"]
POSITIONS = ["UTG", "HJ", "CO", "BTN", "SB", "BB"]


def sanitize_filename(name: str) -> str:
    if not name:
        return "root"
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("_")
    return safe or "node"


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


def get_node_path(preflop_actions: str) -> Path:
    return OUT_DIR / (sanitize_filename(preflop_actions) + ".json")


def get_active_position(spot: Dict[str, Any]) -> str:
    sols = spot.get("action_solutions")
    if not isinstance(sols, list) or not sols:
        return "UNKNOWN"
    first = sols[0]
    if not isinstance(first, dict):
        return "UNKNOWN"
    act = first.get("action")
    if not isinstance(act, dict):
        return "UNKNOWN"
    pos = act.get("position")
    return pos if isinstance(pos, str) else "UNKNOWN"


def iter_actions(spot: Dict[str, Any]) -> List[Tuple[str, float, bool, bool]]:
    """
    (code, total_frequency, next_street, is_hand_end) を返す
    total_frequency > eps のみ
    """
    sols = spot.get("action_solutions")
    if not isinstance(sols, list):
        return []
    out: List[Tuple[str, float, bool, bool]] = []
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
        code = act.get("code")
        if not isinstance(code, str) or not code:
            continue
        out.append(
            (code, tf, bool(act.get("next_street", False)), bool(act.get("is_hand_end", False)))
        )
    return out


def is_node_terminal(actions: List[Tuple[str, float, bool, bool]]) -> bool:
    if not actions:
        return True
    return all(next_street or is_hand_end for _, _, next_street, is_hand_end in actions)


def append_action(parent: str, code: str) -> str:
    return code if parent == "" else f"{parent}-{code}"


# ---- 日本語アクション列（ツリー再生で正確に作る） ----

def pos_to_jp(pos: str) -> str:
    if pos == "UTG+1":
        return "+1"
    if pos == "UTG+2":
        return "+2"
    return pos


def code_kind(code: str) -> str:
    u = code.upper()
    if u == "F" or u.startswith("F"):
        return "F"
    if u == "C" or u.startswith("C"):
        return "C"
    # ALL IN 系を広めに吸収
    if u in {"AI", "ALLIN", "ALL_IN"} or u.startswith("AI") or "ALLIN" in u or "ALL_IN" in u:
        return "AI"
    if u.startswith("R"):
        return "R"
    return "OTHER"


def label_for_action(code: str, raise_index: int) -> str:
    k = code_kind(code)
    if k == "C":
        return "コール"
    if k == "AI":
        return "ALL IN"
    if k == "R":
        if raise_index == 1:
            return "オープン"
        # 2回目が3BET、3回目が4BET...
        return f"{raise_index+1}BET"
    # OTHER は保険でそのまま
    return code.upper()


def get_position_for_code(parent_spot: Dict[str, Any], child_code: str) -> str:
    """
    親ノードの action_solutions から、選ばれた code の position を取る。
    """
    sols = parent_spot.get("action_solutions")
    if not isinstance(sols, list):
        return "UNKNOWN"
    for sol in sols:
        if not isinstance(sol, dict):
            continue
        act = sol.get("action")
        if not isinstance(act, dict):
            continue
        code = act.get("code")
        if code == child_code:
            pos = act.get("position")
            return pos if isinstance(pos, str) else "UNKNOWN"
    return "UNKNOWN"


def reconstruct_history(preflop_actions: str) -> List[Tuple[str, str]]:
    """
    preflop_actions の各トークンを、ツリー（out/*.json）を辿って
    (position, code) の履歴に復元する。
    """
    if preflop_actions == "":
        return []

    parts = preflop_actions.split("-")
    history: List[Tuple[str, str]] = []

    cur = ""
    for code in parts:
        parent_path = get_node_path(cur)
        if not parent_path.exists():
            # キャッシュが無いのは異常だが、安全に打ち切る
            break
        parent_spot = load_json(parent_path)
        pos = get_position_for_code(parent_spot, code)
        history.append((pos, code))
        cur = append_action(cur, code)

    return history


def jp_actions_label(preflop_actions: str) -> str:
    """
    - root("") は空欄
    - F は除外
    - レイズ額は無視し「その履歴内で何回目のレイズか」でオープン/3BET/4BET...を決める
    - {ポジション}の{アクション} を「、」で連結
    """
    if preflop_actions == "":
        return ""

    history = reconstruct_history(preflop_actions)

    raise_count = 0
    tokens: List[str] = []

    for pos, code in history:
        k = code_kind(code)
        if k == "F":
            continue
        if k == "R":
            raise_count += 1
            act = label_for_action(code, raise_count)
        else:
            act = label_for_action(code, raise_count)

        tokens.append(f"{pos_to_jp(pos)}の{act}")

    return "、".join(tokens) if tokens else ""


def main() -> None:
    explored_nodes = set(load_explored_list(EXPLORED_LIST_PATH))
    if "" not in explored_nodes:
        raise RuntimeError("ROOT node ('') not found in preflop_actions.txt")

    reach: Dict[str, float] = {"": 1.0}
    by_pos: Dict[str, Dict[str, float]] = {p: {} for p in POSITIONS}
    by_pos.setdefault("UNKNOWN", {})

    q: deque[str] = deque([""])
    visited: Set[str] = set()

    while q:
        node = q.popleft()
        if node in visited:
            continue
        visited.add(node)

        p_node = reach.get(node)
        if p_node is None:
            continue

        path = get_node_path(node)
        if not path.exists():
            continue

        spot = load_json(path)
        pos = get_active_position(spot)
        by_pos.setdefault(pos, {})
        by_pos[pos][node] = p_node

        actions = iter_actions(spot)
        if is_node_terminal(actions):
            continue

        for code, tf, next_street, is_hand_end in actions:
            if next_street or is_hand_end:
                continue
            child = append_action(node, code)
            if child not in explored_nodes:
                continue
            reach[child] = reach.get(child, 0.0) + (p_node * tf)
            q.append(child)

    # JSON出力（任意）
    (OUT_DIR / "spot_reach_probs.json").write_text(
        json.dumps(reach, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    (OUT_DIR / "spot_frequencies_by_position.json").write_text(
        json.dumps(by_pos, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # CSV：jp_actions 列を追加
    csv_path = OUT_DIR / "spot_frequencies_by_position.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["position", "preflop_actions", "reach_prob", "jp_actions"])

        ordered_positions = POSITIONS + [p for p in by_pos.keys() if p not in POSITIONS]
        for pos in ordered_positions:
            items = list(by_pos.get(pos, {}).items())
            items.sort(key=lambda kv: kv[1], reverse=True)
            for actions, prob in items:
                actions_cell = ROOT_MARKER if actions == "" else actions
                jp = jp_actions_label(actions)

                # root / 全員フォールド などは jp が空欄のまま
                w.writerow([pos, actions_cell, prob, jp])

    print("done.")
    print(f"nodes_reached={len(reach)}")
    print(f"csv={csv_path}")


if __name__ == "__main__":
    main()
