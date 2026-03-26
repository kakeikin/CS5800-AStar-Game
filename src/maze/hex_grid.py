from src.config import GRID_COLS, GRID_ROWS, HEX_NBR_EVEN, HEX_NBR_ODD


class HexGrid:
    """Wraps a hex-maze passage dict for pathfinding (odd-r offset coords)."""

    def __init__(
        self,
        passages: dict,
        cols: int = GRID_COLS,
        rows: int = GRID_ROWS,
        weights: dict | None = None,
    ):
        self.passages = passages
        self.cols     = cols
        self.rows     = rows
        self.weights  = weights or {}

    # ── Pathfinding interface ─────────────────────────────────────────────────

    def get_neighbors_with_cost(self, pos: tuple) -> list:
        result = []
        for nbr in self.passages.get(pos, set()):
            cost = 1 + self.weights.get(nbr, 0)
            result.append((nbr, cost))
        return result

    def is_passage(self, a: tuple, b: tuple) -> bool:
        return b in self.passages.get(a, set())

    # ── All 6 directional neighbours (whether passage or not) ────────────────

    def all_neighbours(self, pos: tuple) -> list:
        c, r = pos
        offsets = HEX_NBR_ODD if r % 2 == 1 else HEX_NBR_EVEN
        result = []
        for dc, dr in offsets:
            nc, nr = c + dc, r + dr
            if 0 <= nc < self.cols and 0 <= nr < self.rows:
                result.append((nc, nr))
        return result

    # ── BFS helpers ───────────────────────────────────────────────────────────

    def bfs_distance(self, start: tuple) -> dict:
        from collections import deque
        dist = {start: 0}
        q    = deque([start])
        while q:
            node = q.popleft()
            for nbr in self.passages.get(node, set()):
                if nbr not in dist:
                    dist[nbr] = dist[node] + 1
                    q.append(nbr)
        return dist

    def cells(self):
        return list(self.passages.keys())
