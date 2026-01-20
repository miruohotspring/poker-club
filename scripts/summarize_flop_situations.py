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
EXPLORED_LIST_PATH = OUT_DIR / "preflop_actions.txt"     # ROOT含む
FLOP_SITUATIONS_PATH = OUT_DIR / "flop_situations.txt"

ROOT_MARKER = "ROOT"

# 表記用（日本語化で使う）
POSITION_ORDER = ["UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BTN", "SB", "BB"]


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


def load_explored_list(path: Path) -> Set[str]:
    if not path.exists():
        raise FileNotFoundError(f"not found: {path}")
    out: Set[str] = set()
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            v = parse_actions_line(line)
            if v is None:
                continue
            out.add(v)
    return out


def load_flop_situations(path: Path) -> List[str]:
    if not path.exists():
        raise FileNotFoundError(f"not found: {path}")
    out: List[str] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            s = line.strip()
            if not s:
                continue
            out.append(s)
    return out


def append_action(parent: str, code: str) -> str:
    return code if parent == "" else f"{parent}-{code}"


def split_parent_and_last(action_line: str) -> Tuple[str, str]:
    """
    "R2.5-F-...-C" -> ("R2.5-F-...","C")
    "C" -> ("", "C")
    """
    parts = action_line.split("-")
    if len(parts) == 1:
        return "", parts[0]
    return "-".join(parts[:-1]), parts[-1]


def iter_child_actions_for_reach(spot: Dict[str, Any]) -> List[Tuple[str, float]]:
    """
    到達確率伝播用の枝:
    - total_frequency > eps
    - next_street == false
    - is_hand_end == false
    """
    sols = spot.get("action_solutions")
    if not isinstance(sols, list):
        return []

    out: List[Tuple[str, float]] = []
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

        if bool(act.get("next_street", False)):
            continue
        if bool(act.get("is_hand_end", False)):
            continue

        code = act.get("code")
        if not isinstance(code, str) or not code:
            continue

        out.append((code, tf))

    return out


def get_action_frequency(spot: Dict[str, Any], code: str) -> float:
    """
    親ノードの action_solutions から、指定 code の total_frequency を取る。
    （next_street/hand_endに関係なく、同じ code があれば拾う）
    """
    sols = spot.get("action_solutions")
    if not isinstance(sols, list):
        return 0.0

    for sol in sols:
        if not isinstance(sol, dict):
            continue
        act = sol.get("action", {})
        if not isinstance(act, dict):
            continue
        if act.get("code") != code:
            continue
        try:
            tf = float(sol.get("total_frequency", 0.0))
        except Exception:
            tf = 0.0
        return tf

    return 0.0


# ---- 日本語アクション列（前回と同じ “ツリー再生” ロジック） ----

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
        return f"{raise_index+1}BET"  # 2->3BET, 3->4BET...
    return code.upper()


def get_position_for_code(parent_spot: Dict[str, Any], child_code: str) -> str:
    sols = parent_spot.get("action_solutions")
    if not isinstance(sols, list):
        return "UNKNOWN"
    for sol in sols:
        if not isinstance(sol, dict):
            continue
        act = sol.get("action")
        if not isinstance(act, dict):
            continue
        if act.get("code") == child_code:
            pos = act.get("position")
            return pos if isinstance(pos, str) else "UNKNOWN"
    return "UNKNOWN"


def reconstruct_history(preflop_actions: str) -> List[Tuple[str, str]]:
    """
    preflop_actions（フロップ到達用に末尾に next_street code が付いていてもOK）
    out/*.json を辿って (position, code) 履歴を復元する。
    """
    if preflop_actions == "":
        return []

    parts = preflop_actions.split("-")
    history: List[Tuple[str, str]] = []
    cur = ""

    for code in parts:
        parent_path = get_node_path(cur)
        if not parent_path.exists():
            break
        parent_spot = load_json(parent_path)
        pos = get_position_for_code(parent_spot, code)
        history.append((pos, code))
        cur = append_action(cur, code)

    return history


def jp_actions_label(preflop_actions: str) -> str:
    """
    - rootは対象外（flop_situationsには来ない想定だが保険）
    - F は除外
    - レイズ額は無視し「履歴内で何回目のレイズか」でオープン/3BET/...
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


def compute_reach_probs(explored_nodes: Set[str]) -> Dict[str, float]:
    """
    preflopツリー（next_street/hand_endを除外）で reach 確率を伝播して返す
    """
    if "" not in explored_nodes:
        raise RuntimeError("ROOT node ('') not found in preflop_actions.txt")

    reach: Dict[str, float] = {"": 1.0}
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

        for code, tf in iter_child_actions_for_reach(spot):
            child = append_action(node, code)
            if child not in explored_nodes:
                continue
            reach[child] = reach.get(child, 0.0) + (p_node * tf)
            q.append(child)

    return reach


def main() -> None:
    explored_nodes = load_explored_list(EXPLORED_LIST_PATH)
    flop_situations = load_flop_situations(FLOP_SITUATIONS_PATH)

    # 1) preflop reach（無条件）
    reach = compute_reach_probs(explored_nodes)

    # 2) 各 flop_situation の無条件確率 = reach(parent) * freq(parent,last_code)
    rows: List[Tuple[str, float, str]] = []
    total_flop_prob = 0.0

    for s in flop_situations:
        parent, last = split_parent_and_last(s)

        p_parent = reach.get(parent)
        if p_parent is None:
            # 到達しない/欠損はスキップ
            continue

        parent_path = get_node_path(parent)
        if not parent_path.exists():
            continue
        parent_spot = load_json(parent_path)

        tf = get_action_frequency(parent_spot, last)
        if tf <= FREQ_EPS:
            continue

        p_uncond = p_parent * tf
        total_flop_prob += p_uncond
        rows.append((s, p_uncond, jp_actions_label(s)))

    if total_flop_prob <= 0.0:
        raise RuntimeError("total_flop_prob is 0. Nothing to normalize.")

    # 3) 条件付き確率に正規化（合計=1）
    out_rows: List[Tuple[str, float, float, str]] = []
    for s, p_uncond, jp in rows:
        p_cond = p_uncond / total_flop_prob
        out_rows.append((s, p_uncond, p_cond, jp))

    out_rows.sort(key=lambda r: r[2], reverse=True)

    # 4) CSV出力
    csv_path = OUT_DIR / "flop_situations_frequencies.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["flop_situation", "prob_unconditional", "prob_given_flop", "jp_actions"])
        for s, p_uncond, p_cond, jp in out_rows:
            w.writerow([s, p_uncond, p_cond, jp])

    # 正規化チェック（軽く）
    ssum = sum(r[2] for r in out_rows)

    print("done.")
    print(f"flop_situations_in={len(flop_situations)}")
    print(f"rows_written={len(out_rows)}")
    print(f"total_flop_prob_unconditional={total_flop_prob}")
    print(f"sum(prob_given_flop)={ssum}")
    print(f"csv={csv_path.resolve()}")


if __name__ == "__main__":
    main()
