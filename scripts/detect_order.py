from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Tuple

INPUT = "input.json"
OUT_DIR = "out"
P_PURE = 0.95
P_CUTOFF = 0.05
TOP_MIX = 120

RANKS = list("AKQJT98765432")

def build_labels_row_lower() -> List[str]:
    """
    13x13 を 169ラベルにする（row-major）。
    suited_pos=lower: i>j が suited、i<j が offsuit
    表記は常に強いランク→弱いランク (AKo / AKs) に正規化。
    """
    labels: List[str] = []

    def cell(i: int, j: int) -> str:
        r_i = RANKS[i]
        r_j = RANKS[j]
        if i == j:
            return r_i + r_j

        # 表示は必ず強い→弱い
        r_hi, r_lo = (r_i, r_j) if i < j else (r_j, r_i)

        # lower suited: i>j が suited
        is_suited = (i > j)
        return f"{r_hi}{r_lo}{'s' if is_suited else 'o'}"

    for i in range(13):
        for j in range(13):
            labels.append(cell(i, j))
    return labels


def combo_count(hand: str) -> int:
    if len(hand) == 2:  # pair
        return 6
    if hand.endswith("s"):
        return 4
    if hand.endswith("o"):
        return 12
    # 万一
    return 0


def summarize_action(sol: Dict[str, Any], labels: List[str]) -> Dict[str, Any]:
    act = sol.get("action", {}) or {}
    name = (act.get("display_name") or act.get("type") or "UNKNOWN").upper()

    freq = float(sol.get("total_frequency") or 0.0)
    strat = sol.get("strategy") or []
    if not isinstance(strat, list) or len(strat) != 169:
        return {"name": name, "error": "strategy is not 169 list"}

    pairs: List[Tuple[str, float]] = []
    combos_sum = 0.0

    for i, p in enumerate(strat):
        if not isinstance(p, (int, float)):
            continue
        p = float(p)
        h = labels[i]
        pairs.append((h, p))
        combos_sum += p * combo_count(h)

    pure = [(h, p) for h, p in pairs if p >= P_PURE]
    mix  = [(h, p) for h, p in pairs if P_CUTOFF < p < P_PURE]

    # mix は見やすいように大きい順
    mix.sort(key=lambda x: x[1], reverse=True)
    mix = mix[:TOP_MIX]

    # 短いレンジ文字列化（手をカンマ区切り）
    pure_txt = ", ".join([h for h, _ in pure])
    mix_txt  = ", ".join([f"{h}({p:.2f})" for h, p in mix])

    return {
        "action": {
            "display_name": act.get("display_name"),
            "type": act.get("type"),
            "betsize": act.get("betsize"),
            "betsize_by_pot": act.get("betsize_by_pot"),
            "allin": act.get("allin"),
        },
        "totals": {
            "total_frequency_api": freq,
            "total_combos_api": sol.get("total_combos"),
            "total_combos_from_strategy": round(combos_sum, 3),
        },
        "range": {
            "pure": pure_txt,
            "mix": mix_txt,
            "pure_count": len(pure),
            "mix_count": len(mix),
        },
    }


def main() -> None:
    out_dir = Path(OUT_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)

    data = json.loads(Path(INPUT).read_text(encoding="utf-8"))
    labels = build_labels_row_lower()

    game = data.get("game", {})
    sols = data.get("action_solutions", [])

    actions = [summarize_action(s, labels) for s in sols if isinstance(s, dict)]

    summary = {
        "game": {
            "current_street": game.get("current_street"),
            "pot": game.get("pot"),
            "pot_odds": game.get("pot_odds"),
            "active_position": game.get("active_position"),
            "board": game.get("board"),
            "bet_display_name": game.get("bet_display_name"),
        },
        "actions": actions,
        "_note": {
            "hand_indexing": "row-major + suited_pos=lower (based on internal consistency: sum over actions matches 1326 combos)",
            "pure_threshold": P_PURE,
            "mix_threshold": P_CUTOFF,
        }
    }

    (out_dir / "ai_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    # Markdown（AIに貼りやすい）
    md = []
    md.append("# AI-friendly Solution Summary")
    md.append("")
    md.append("## Game")
    for k, v in summary["game"].items():
        md.append(f"- **{k}**: {v}")
    md.append("")
    md.append("## Actions")
    for a in actions:
        if "error" in a:
            md.append(f"### {a.get('name')}")
            md.append(f"- error: {a['error']}")
            md.append("")
            continue
        ad = a["action"]
        tt = a["totals"]
        rg = a["range"]
        md.append(f"### {ad.get('display_name')} (type={ad.get('type')}, betsize={ad.get('betsize')})")
        md.append(f"- total_frequency(api): {tt['total_frequency_api']}")
        md.append(f"- total_combos(api): {tt['total_combos_api']}")
        md.append(f"- total_combos(from strategy): {tt['total_combos_from_strategy']}")
        md.append(f"- pure({rg['pure_count']}): {rg['pure']}")
        md.append(f"- mix({rg['mix_count']}): {rg['mix']}")
        md.append("")

    (out_dir / "ai_summary.md").write_text("\n".join(md), encoding="utf-8")
    print("Wrote:", out_dir / "ai_summary.json", "and", out_dir / "ai_summary.md")


if __name__ == "__main__":
    main()
