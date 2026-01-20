from __future__ import annotations

import json
import re
import time
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

import requests


# REFRESH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTkyNjUwMDc4MiwiaWF0IjoxNzY4ODIwNzgyLCJqdGkiOiI0ZjNlMTBhZGFmMmI0M2Y4OTBlNjRhNTRkYmI1MTUwMCIsInB1YmxpY19pZCI6ImFjY191Y3VhczR6Z255IiwiZW1haWwiOiJtaXJ1b2hvdHNwcmluZ0BnbWFpbC5jb20iLCJwa2giOiJHbmhJcWxjMXN3anR1UmxDbFREMGNzLWg2U2VONEZDcmJPVG5rZkVUeEFjIn0.lYAbsGtnhRF1R_bCreJXq5cmuXuHf3DFRZwZrTL6jZ8"
# REFRESH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTkyNjU0NzYwMiwiaWF0IjoxNzY4ODY3NjAyLCJqdGkiOiI2NjFkNDViNjE2ODA0NGQzYmQ5MTNkYzRlOGI4ZGNkMyIsInB1YmxpY19pZCI6ImFjY196bTN1d2N6eHpkIiwiZW1haWwiOiJzcmt0Lml0ZkBnbWFpbC5jb20iLCJwa2giOiJHbmhJcWxjMXN3anR1UmxDbFREMGNzLWg2U2VONEZDcmJPVG5rZkVUeEFjIn0.7JZTDhhz2SyLRM5QxK2xOPhVmqRGYPnEtZf4bdGAu3s"
# REFRESH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTkyNjU1MTM5MCwiaWF0IjoxNzY4ODcxMzkwLCJqdGkiOiJhNjQ4ZjUwYmM0MjY0MzNjYTdlNzNkM2YzOWY3ZjBmNyIsInB1YmxpY19pZCI6ImFjY19zd3MwMTJ6Y3Y2IiwiZW1haWwiOiJtaXJ1b2JsdWVzdGFja3NAZ21haWwuY29tIiwicGtoIjoiR25oSXFsYzFzd2p0dVJsQ2xURDBjcy1oNlNlTjRGQ3JiT1Rua2ZFVHhBYyJ9.MgbU2AfEKN4rhmwto6h0KOWiqfgonfCdBWuScFC8S2U"
REFRESH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTkyNjU1NzI4NywiaWF0IjoxNzY4ODc3Mjg3LCJqdGkiOiJlYzcxMjIyYjMyMzI0YjU2OGUxZWU5MzQwYWFlZWE0ZSIsInB1YmxpY19pZCI6ImFjY194MmJvZ2J2ZDJ0IiwiZW1haWwiOiJob2dlb2hvZ2V0YTc5MUBnbWFpbC5jb20iLCJwa2giOiJHbmhJcWxjMXN3anR1UmxDbFREMGNzLWg2U2VONEZDcmJPVG5rZkVUeEFjIn0.j7IlwePudx4A0jT3SL6fJLfdA_9Iaoq6C2PbkRMYkME"

GAMETYPE = "Cash6m50zGeneral25Open"
DEPTH = 100

TOKEN_REFRESH_URL = "https://api.gtowizard.com/v1/token/refresh/"
SPOT_SOLUTION_URL = "https://api.gtowizard.com/v4/solutions/spot-solution"

FREQ_EPS = 1e-9

OUT_DIR = Path("out2")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ここは「探索完了済み（子展開まで済んだ）」のログにする
EXPLORED_LIST_PATH = OUT_DIR / "preflop_actions.txt"
ROOT_MARKER = "ROOT"


def sanitize_filename(name: str) -> str:
    if not name:
        return "root"
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("_")
    return safe or "node"


def save_json(out_path: Path, data: Any) -> None:
    tmp = out_path.with_suffix(out_path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    tmp.replace(out_path)


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
        return set()
    out: Set[str] = set()
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            v = parse_actions_line(line)
            if v is None:
                continue
            out.add(v)
    return out


def append_explored_line(path: Path, preflop_actions: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        if preflop_actions == "":
            f.write(ROOT_MARKER + "\n")
        else:
            f.write(preflop_actions + "\n")


@dataclass(frozen=True)
class ActionEdge:
    code: str
    next_street: bool
    is_hand_end: bool


class GtoWizardClient:
    def __init__(self, refresh_token: str) -> None:
        self.refresh_token = refresh_token
        self.access_token: Optional[str] = None
        self.session = requests.Session()

    def refresh_access_token(self) -> str:
        res = self.session.post(
            TOKEN_REFRESH_URL,
            json={"refresh": self.refresh_token},
            timeout=30,
        )
        res.raise_for_status()
        payload = res.json()
        access = payload.get("access")
        if not isinstance(access, str) or not access:
            raise RuntimeError(f"token refresh response has no 'access': {payload}")
        self.access_token = access
        return access

    def get_spot_solution(self, preflop_actions: str) -> Dict[str, Any]:
        if not self.access_token:
            self.refresh_access_token()

        params = {
            "gametype": GAMETYPE,
            "depth": str(DEPTH),
            "preflop_actions": preflop_actions,
        }

        def do_request() -> requests.Response:
            assert self.access_token
            return self.session.get(
                SPOT_SOLUTION_URL,
                params=params,
                headers={"Authorization": f"Bearer {self.access_token}"},
                timeout=60,
            )

        max_retries = 6
        backoff = 0.5

        for _ in range(max_retries):
            res = do_request()

            if res.status_code == 401:
                self.refresh_access_token()
                res = do_request()

            if res.status_code == 200:
                return res.json()

            if res.status_code in (400, 404):
                raise FileNotFoundError(
                    f"spot not found for preflop_actions='{preflop_actions}' ({res.status_code})"
                )

            if res.status_code == 429 or (500 <= res.status_code <= 599):
                time.sleep(backoff)
                backoff = min(backoff * 2, 10.0)
                continue

            res.raise_for_status()

        raise RuntimeError(f"failed after retries for preflop_actions='{preflop_actions}'")


def extract_edges(spot_json: Dict[str, Any]) -> List[ActionEdge]:
    action_solutions = spot_json.get("action_solutions")
    if not isinstance(action_solutions, list):
        return []

    edges: List[ActionEdge] = []
    for sol in action_solutions:
        if not isinstance(sol, dict):
            continue

        tf = sol.get("total_frequency", 0.0)
        try:
            tf_val = float(tf)
        except Exception:
            tf_val = 0.0

        if tf_val <= FREQ_EPS:
            continue

        action = sol.get("action", {})
        if not isinstance(action, dict):
            continue

        code = action.get("code")
        if not isinstance(code, str) or not code:
            continue

        edges.append(
            ActionEdge(
                code=code,
                next_street=bool(action.get("next_street", False)),
                is_hand_end=bool(action.get("is_hand_end", False)),
            )
        )

    return edges


def is_node_terminal(edges: List[ActionEdge]) -> bool:
    """
    「取りうるどのアクションでも next_street or is_hand_end」なら終端（これ以上子ノードなし）
    """
    if not edges:
        return True
    return all(e.next_street or e.is_hand_end for e in edges)


def append_action(preflop_actions: str, code: str) -> str:
    return code if not preflop_actions else f"{preflop_actions}-{code}"


def main() -> None:
    root = ""
    client = GtoWizardClient(refresh_token=REFRESH_TOKEN)

    # ★ここが重要：txtは「探索完了済み（子展開済み）」として扱う
    explored: Set[str] = load_explored_list(EXPLORED_LIST_PATH)

    queue: deque[str] = deque([root])

    # 重複追記防止
    explored_written: Set[str] = set(explored)

    processed_count = 0
    loaded_count = 0
    fetched_count = 0
    missing_count = 0
    appended_count = 0

    while queue:
        node = queue.popleft()

        # 既に探索完了（子展開済み）なら完全スキップ
        if node in explored:
            continue

        out_path = OUT_DIR / (sanitize_filename(node) + ".json")

        # ★API前に out/ を確認。あればそのjsonを参照して子展開を続ける
        spot: Optional[Dict[str, Any]] = None
        if out_path.exists():
            try:
                spot = load_json(out_path)
            except Exception as e:
                print(f"[warn] failed to load existing file, refetch: {out_path} ({e})")
                spot = None
            else:
                loaded_count += 1

        if spot is None:
            try:
                spot = client.get_spot_solution(node)
            except FileNotFoundError:
                missing_count += 1
                # 存在しないノードはこれ以上やることが無いので explored 扱いにしてよい
                explored.add(node)
                if node not in explored_written:
                    append_explored_line(EXPLORED_LIST_PATH, node)
                    explored_written.add(node)
                    appended_count += 1
                continue

            save_json(out_path, spot)
            fetched_count += 1

        edges = extract_edges(spot)

        # 子を enqueue（終端アクションは子ノードを作らない）
        if not is_node_terminal(edges):
            for e in edges:
                if e.next_street or e.is_hand_end:
                    continue
                child = append_action(node, e.code)
                if child not in explored:
                    queue.append(child)

        # ★ここで「このノードの処理（子展開）」が終わったので explored として記録
        explored.add(node)
        if node not in explored_written:
            append_explored_line(EXPLORED_LIST_PATH, node)
            explored_written.add(node)
            appended_count += 1

        processed_count += 1

        if processed_count % 50 == 0:
            print(
                f"[progress] processed={processed_count} loaded={loaded_count} fetched={fetched_count} "
                f"appended={appended_count} explored={len(explored)} queue={len(queue)} missing={missing_count}"
            )

    print("done.")
    print(
        f"processed={processed_count} loaded={loaded_count} fetched={fetched_count} "
        f"appended={appended_count} explored={len(explored)} missing={missing_count}"
    )
    print(f"explored_list={EXPLORED_LIST_PATH.resolve()}")
    print(f"out_dir={OUT_DIR.resolve()}")


if __name__ == "__main__":
    main()
