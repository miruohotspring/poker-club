from __future__ import annotations
import json
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional

INPUT = "input.json"

# ====== ここに「分かっていること」を入れる ======
# 期待確率（pureは 1.0 でOK、ミックスはその値）
# key: (ACTION, HAND) -> expected_prob
# ACTION は "RAISE" / "CALL" / "FOLD" のどれか
KNOWN: Dict[Tuple[str, str], float] = {
    # AA〜TT は pure raise
    ("RAISE", "AA"): 1.0,
    ("RAISE", "KK"): 1.0,
    ("RAISE", "QQ"): 1.0,
    ("RAISE", "JJ"): 1.0,
    ("RAISE", "TT"): 1.0,

    # 99/88/77/66/55 の raise mix
    ("RAISE", "99"): 0.40,
    ("RAISE", "88"): 0.14,
    ("RAISE", "77"): 0.07,
    ("RAISE", "66"): 0.04,
    ("RAISE", "55"): 0.08,

    # 44〜22 は pure call
    ("CALL", "44"): 1.0,
    ("CALL", "33"): 1.0,
    ("CALL", "22"): 1.0,

    # AKs〜AJs は pure raise
    ("RAISE", "AKs"): 1.0,
    ("RAISE", "AQs"): 1.0,
    ("RAISE", "AJs"): 1.0,

    # ATsは2.5% raise（=0.025）
    ("RAISE", "ATs"): 0.025,

    # A9s〜A6sはpure call
    ("CALL", "A9s"): 1.0,
    ("CALL", "A8s"): 1.0,
    ("CALL", "A7s"): 1.0,
    ("CALL", "A6s"): 1.0,

    # A5はpure raise（ここは A5s だと思うので A5s にしています。A5oの意味なら変えてください）
    ("RAISE", "A5s"): 1.0,
}

# 期待値の許容誤差（pure系の揺らぎや端数に対応）
PURE_EPS = 0.02  # pure 1.0/0.0 をこの程度許容
MIX_EPS = 0.05   # ミックス率の許容（必要なら調整）

# ===================================================

RANKS_DESC = list("AKQJT98765432")
RANKS_ASC  = list("23456789TJQKA")

def normalize_hand_label(r1: str, r2: str, suited: Optional[bool]) -> str:
    """常に強いランク→弱いランク表記に正規化"""
    order = {r:i for i,r in enumerate("23456789TJQKA")}
    # 強い=orderが大きい
    if order[r1] < order[r2]:
        r1, r2 = r2, r1
    if suited is None:
        return r1 + r2
    return r1 + r2 + ("s" if suited else "o")

def build_labels(
    ranks: List[str],
    order: str,              # "row" or "col"
    flip_i: bool,
    flip_j: bool,
    transpose: bool,
    suited_pos: str,         # "upper" or "lower"
) -> List[str]:
    """
    13x13 を 169 ラベルへ。
    - flip_i/j: 行/列の反転（上下左右反転）
    - transpose: 行列入れ替え
    - suited_pos: suited が上三角か下三角か
    """
    def idx_map(i: int, j: int) -> Tuple[int,int]:
        ii, jj = i, j
        if flip_i:
            ii = 12 - ii
        if flip_j:
            jj = 12 - jj
        if transpose:
            ii, jj = jj, ii
        return ii, jj

    def cell(i: int, j: int) -> str:
        ii, jj = idx_map(i, j)
        r_i = ranks[ii]
        r_j = ranks[jj]
        if ii == jj:
            return normalize_hand_label(r_i, r_j, None)
        # suited の定義（“元の ii/jj で判定”）
        is_suited = (ii < jj) if suited_pos == "upper" else (ii > jj)
        return normalize_hand_label(r_i, r_j, is_suited)

    labels: List[str] = []
    if order == "row":
        for i in range(13):
            for j in range(13):
                labels.append(cell(i,j))
    else:
        for j in range(13):
            for i in range(13):
                labels.append(cell(i,j))
    return labels

def get_action_solutions(data: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    by = {}
    for s in data.get("action_solutions", []):
        a = (s.get("action") or {})
        name = (a.get("display_name") or a.get("type") or "").upper()
        if name:
            by[name] = s
    return by

def prob_for_hand(strategy: List[float], labels: List[str], hand: str) -> Optional[float]:
    # labels中で手を探して値を返す
    try:
        idx = labels.index(hand)
    except ValueError:
        return None
    v = strategy[idx]
    return float(v) if isinstance(v, (int, float)) else None

def score_mapping(action_strats: Dict[str, List[float]], labels: List[str]) -> Tuple[float, List[str]]:
    """
    小さいほど良いスコア
    """
    errors = []
    for (act, hand), exp in KNOWN.items():
        strat = action_strats.get(act)
        if strat is None:
            errors.append(999.0)
            continue
        got = prob_for_hand(strat, labels, hand)
        if got is None:
            errors.append(999.0)
            continue

        # pureとmixで許容幅を変える（外れた分だけ罰）
        eps = MIX_EPS if 0.0 < exp < 1.0 else PURE_EPS
        diff = abs(got - exp)
        penal = max(0.0, diff - eps)
        errors.append(penal)

    # 合計
    total = sum(errors)

    # デバッグ用：大きい順に数件表示したいので、メッセージも作る
    msg = []
    for (act, hand), exp in KNOWN.items():
        got = prob_for_hand(action_strats.get(act, []), labels, hand)
        msg.append(f"{act} {hand}: got={got} exp={exp}")
    return total, msg

def main():
    data = json.loads(Path(INPUT).read_text(encoding="utf-8"))
    by = get_action_solutions(data)

    need = ["FOLD", "CALL", "RAISE"]
    for n in need:
        if n not in by:
            print("missing:", n, "found:", list(by.keys()))
            return

    action_strats = {k: by[k].get("strategy", []) for k in need}

    candidates = []
    for ranks_name, ranks in [("DESC", RANKS_DESC), ("ASC", RANKS_ASC)]:
        for order in ["row", "col"]:
            for suited_pos in ["upper", "lower"]:
                for flip_i in [False, True]:
                    for flip_j in [False, True]:
                        for transpose in [False, True]:
                            labels = build_labels(
                                ranks=ranks,
                                order=order,
                                flip_i=flip_i,
                                flip_j=flip_j,
                                transpose=transpose,
                                suited_pos=suited_pos,
                            )
                            sc, msg = score_mapping(action_strats, labels)
                            candidates.append((sc, ranks_name, order, suited_pos, flip_i, flip_j, transpose, labels))

    candidates.sort(key=lambda x: x[0])
    best = candidates[0]
    sc, ranks_name, order, suited_pos, flip_i, flip_j, transpose, labels = best

    print("=== BEST ===")
    print(f"score={sc:.6f} ranks={ranks_name} order={order} suited_pos={suited_pos} flip_i={flip_i} flip_j={flip_j} transpose={transpose}")
    print("")
    print("check:")
    for (act, hand), exp in KNOWN.items():
        got = prob_for_hand(action_strats[act], labels, hand)
        print(f"  {act:5} {hand:4} got={got:.4f} exp={exp}")

    print("\nTop 10 candidates:")
    for x in candidates[:10]:
        print(f"score={x[0]:.6f} ranks={x[1]} order={x[2]} suited={x[3]} flip_i={x[4]} flip_j={x[5]} transpose={x[6]}")

if __name__ == "__main__":
    main()
