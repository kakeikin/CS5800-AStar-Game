"""Maze generators using iterative DFS (recursive backtracker)."""
import random
from src.config import GRID_COLS, GRID_ROWS, HEX_NBR_EVEN, HEX_NBR_ODD


# ── Square maze ───────────────────────────────────────────────────────────────

def generate_square_maze(
    cols: int = GRID_COLS,
    rows: int = GRID_ROWS,
    seed: int | None = None,
) -> dict:
    """Return passages dict: {(c,r): set of connected (nc,nr)}."""
    if seed is not None:
        random.seed(seed)

    passages: dict = {(c, r): set() for r in range(rows) for c in range(cols)}
    visited  = set()
    stack    = [(0, rows - 1)]      # start from bottom-left
    visited.add((0, rows - 1))

    while stack:
        c, r = stack[-1]
        nbrs = _sq_unvisited_nbrs(c, r, cols, rows, visited)
        if nbrs:
            nc, nr = random.choice(nbrs)
            passages[(c, r)].add((nc, nr))
            passages[(nc, nr)].add((c, r))
            visited.add((nc, nr))
            stack.append((nc, nr))
        else:
            stack.pop()

    return passages


def _sq_unvisited_nbrs(c, r, cols, rows, visited):
    candidates = []
    if r > 0:        candidates.append((c, r - 1))
    if r < rows - 1: candidates.append((c, r + 1))
    if c > 0:        candidates.append((c - 1, r))
    if c < cols - 1: candidates.append((c + 1, r))
    return [n for n in candidates if n not in visited]


# ── Hex maze ──────────────────────────────────────────────────────────────────

def generate_hex_maze(
    cols: int = GRID_COLS,
    rows: int = GRID_ROWS,
    seed: int | None = None,
) -> dict:
    """Return passages dict: {(c,r): set of connected (nc,nr)}, odd-r offset."""
    if seed is not None:
        random.seed(seed)

    passages: dict = {(c, r): set() for r in range(rows) for c in range(cols)}
    visited  = set()
    stack    = [(0, rows - 1)]
    visited.add((0, rows - 1))

    while stack:
        c, r = stack[-1]
        nbrs = _hex_unvisited_nbrs(c, r, cols, rows, visited)
        if nbrs:
            nc, nr = random.choice(nbrs)
            passages[(c, r)].add((nc, nr))
            passages[(nc, nr)].add((c, r))
            visited.add((nc, nr))
            stack.append((nc, nr))
        else:
            stack.pop()

    return passages


def _hex_unvisited_nbrs(c, r, cols, rows, visited):
    offsets = HEX_NBR_ODD if r % 2 == 1 else HEX_NBR_EVEN
    candidates = []
    for dc, dr in offsets:
        nc, nr = c + dc, r + dr
        if 0 <= nc < cols and 0 <= nr < rows and (nc, nr) not in visited:
            candidates.append((nc, nr))
    return candidates
