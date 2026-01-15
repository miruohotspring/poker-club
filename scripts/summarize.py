from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Tuple, Optional

INPUT = "input.json"
OUT_DIR = "out"
TOPN = 60
FLOAT_DIGITS = 4

RANKS = list("AKQJT98765432")


def r4(x: Any) -> Any:
    if isinstance(x, (int, float)):
        return round(float(x), FLOAT_DIGITS)
    return x


def build_hand_grid(order: str = "row_major") -> List[str]:
    """
    13x13 の hand ラベルを 169個の list にする。
    order:
      - row_major: 行(A→2)を固定し列(A→2)を回す
      - col_major: 列(A→2)を固定し行(A→2)を回す
    """
    hands: List[str] = []

    def cell(i: int, j: int) -> str:
        r1 = RANKS[i]
        r2 = RANKS[j]
        if i == j:
            return r1 + r2
        if i < j:
            # 上三角: suited
            return r1 + r2 + "s"
        else:
            # 下三角: offsuit
            return r1 + r2 + "o"

    if order == "row_major":
        for i in range(13):
            for j in range(13):
                hands.append(cell(i, j))
    elif order == "col_major":
        for j in range(13):
            for i in range(13):
                hands.append(cell(i, j))
    else:
        raise ValueError("unknown order")
    return hands


HAND_LABELS_ROW = build_hand_grid("row_major")
HAND_LABELS_COL = build_hand_grid("col_major")


def top_from_vector(vec: List[float], labels: List[str], topn: int) -> List[Dict[str, Any]]:
    pairs = []
    for idx, v in enumerate(vec):
        if not isinstance(v, (int, float)):
            continue
        if v <= 0:
            continue
        lab = labels[idx] if idx < len(labels) else f"idx_{idx}"
        pairs.append((lab, float(v), idx))
    pairs.sort(key=lambda x: x[1], reverse=True)
    out = [{"hand": h, "value": r4(v), "idx": i} for (h, v, i) in pairs[:topn]]
    return out


def summarize_action_solution(item: Dict[str, Any]) -> Dict[str, Any]:
    act = item.get("action") or {}
    freq = item.get("total_frequency")
    total_ev = item.get("total_ev")
    total_combos = item.get("total_combos")

    strategy = item.get("strategy") or []
    evs = item.get("evs") or []

    # 並び順が不確実なので両方作って出す（次でどっちが正しいか確定する）
    strat_row = top_from_vector(strategy, HAND_LABELS_ROW, TOPN) if isinstance(strategy, list) else []
    strat_col = top_from_vector(strategy, HAND_LABELS_COL, TOPN) if isinstance(strategy, list) else []

    ev_row = top_from_vector(evs, HAND_LABELS_ROW, min(30, TOPN)) if isinstance(evs, list) else []
    ev_col = top_from_vector(evs, HAND_LABELS_COL, min(30, TOPN)) if isinstance(evs, list) else []

    return {
        "action": {
            "display_name": act.get("display_name"),
            "type": act.get("type"),
            "betsize": act.get("betsize"),
            "betsize_by_pot": act.get("betsize_by_pot"),
            "allin": act.get("allin"),
            "position": act.get("position"),
            "next_street": act.get("next_street"),
            "next_position": act.get("next_position"),
            "simple_group": act.get("simple_group"),
            "advanced_group": act.get("advanced_group"),
        },
        "totals": {
            "frequency": r4(freq),
            "total_ev": r4(total_ev),
            "total_combos": r4(total_combos),
        },
        "strategy_top": {
            "row_major": strat_row,
            "col_major": strat_col,
        },
        "evs_top": {
            "row_major": ev_row,
            "col_major": ev_col,
        }
    }


def main() -> None:
    out_dir = Path(OUT_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)

    data = json.loads(Path(INPUT).read_text(encoding="utf-8"))

    game = data.get("game", {}) if isinstance(data, dict) else {}
    players_info = data.get("players_info", []) if isinstance(data, dict) else []
    action_solutions = data.get("action_solutions", []) if isinstance(data, dict) else []

    summary = {
        "game": {
            "players": game.get("players"),
            "current_street": game.get("current_street"),
            "pot": game.get("pot"),
            "pot_odds": game.get("pot_odds"),
            "active_position": game.get("active_position"),
            "board": game.get("board"),
            "bet_display_name": game.get("bet_display_name"),
        },
        "players_info": players_info,  # ここは必要なら別途スリム化も可能
        "actions": [summarize_action_solution(x) for x in action_solutions if isinstance(x, dict)],
        "_note": {
            "strategy_vector_order": "UNKNOWN: both row_major and col_major are included. Pick the correct one.",
            "topn_strategy": TOPN,
        }
    }

    (out_dir / "summary_for_ai.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    # Markdownも作る（AIに貼りやすい）
    md = []
    md.append("# Solution (AI-friendly)")
    md.append("")
    md.append("## Game")
    for k, v in summary["game"].items():
        md.append(f"- **{k}**: {v}")
    md.append("")
    md.append("## Actions")
    for a in summary["actions"]:
        ad = a["action"]
        tt = a["totals"]
        md.append(f"### {ad.get('display_name')}  (type={ad.get('type')}, betsize={ad.get('betsize')}, pot={ad.get('betsize_by_pot')})")
        md.append(f"- total_frequency: {tt.get('frequency')}, total_ev: {tt.get('total_ev')}, total_combos: {tt.get('total_combos')}")
        md.append("")
        md.append("Top strategy hands (row_major):")
        for it in a["strategy_top"]["row_major"][:30]:
            md.append(f"- {it['hand']}: {it['value']}")
        md.append("")
        md.append("Top strategy hands (col_major):")
        for it in a["strategy_top"]["col_major"][:30]:
            md.append(f"- {it['hand']}: {it['value']}")
        md.append("")

    (out_dir / "summary_for_ai.md").write_text("\n".join(md), encoding="utf-8")

    print("Wrote:")
    print(out_dir / "summary_for_ai.json")
    print(out_dir / "summary_for_ai.md")


if __name__ == "__main__":
    main()
