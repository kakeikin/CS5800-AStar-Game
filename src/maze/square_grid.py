from src.config import GRID_COLS, GRID_ROWS


class SquareGrid:
    """Wraps a square-maze passage dict for pathfinding."""

    def __init__(
        self,
        passages: dict,
        cols: int = GRID_COLS,
        rows: int = GRID_ROWS,
        weights: dict | None = None,
    ):
        self.passages = passages   # {(c,r): set of (nc,nr)}
        self.cols     = cols
        self.rows     = rows
        self.weights  = weights or {}   # {(c,r): extra cost to ENTER that cell}

    # ── Pathfinding interface ─────────────────────────────────────────────────

    def get_neighbors_with_cost(self, pos: tuple) -> list:
        """Return [(neighbor, cost), ...] for all passage-connected neighbours."""
        result = []
        for nbr in self.passages.get(pos, set()):
            cost = 1 + self.weights.get(nbr, 0)
            result.append((nbr, cost))
        return result

    def is_passage(self, a: tuple, b: tuple) -> bool:
        return b in self.passages.get(a, set())

    # ── BFS helpers ───────────────────────────────────────────────────────────

    def bfs_distance(self, start: tuple) -> dict:
        """Return dict {pos: steps} via BFS (ignores weights)."""
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
