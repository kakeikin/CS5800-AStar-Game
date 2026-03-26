import heapq
import math
from .base import PathfindingAlgorithm


# ── Shared A* search engine ───────────────────────────────────────────────────

def _astar(grid, start: tuple, end: tuple, heuristic) -> tuple:
    g       = {start: 0}
    prev    = {start: None}
    closed  = set()
    visited = []
    counter = 0
    open_set = []
    heapq.heappush(open_set, (heuristic(start, end), counter, start))

    while open_set:
        _, _, node = heapq.heappop(open_set)
        if node in closed:
            continue
        closed.add(node)
        visited.append(node)

        if node == end:
            break

        for nbr, edge_cost in grid.get_neighbors_with_cost(node):
            if nbr in closed:
                continue
            new_g = g[node] + edge_cost
            if nbr not in g or new_g < g[nbr]:
                g[nbr]    = new_g
                prev[nbr] = node
                counter  += 1
                heapq.heappush(open_set, (new_g + heuristic(nbr, end), counter, nbr))

    # Reconstruct
    path, n = [], end
    while n is not None:
        path.append(n)
        n = prev.get(n)
    path.reverse()
    if not path or path[0] != start:
        path = []
    return path, visited, g


# ── Heuristics ────────────────────────────────────────────────────────────────

def _manhattan(a, b):
    return abs(a[0] - b[0]) + abs(a[1] - b[1])

def _euclidean(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])

def _hex_cube_dist(a, b):
    """Cube-coordinate hex distance (converted from odd-r offset)."""
    def to_cube(pos):
        c, r = pos
        x = c - (r - (r & 1)) // 2
        z = r
        return x, -x - z, z
    ax, ay, az = to_cube(a)
    bx, by, bz = to_cube(b)
    return max(abs(ax - bx), abs(ay - by), abs(az - bz))


# ── Public algorithm classes ──────────────────────────────────────────────────

class AStarManhattan(PathfindingAlgorithm):
    """A* with Manhattan distance — best for square 4-way grids."""

    @property
    def name(self):  return "A* Manhattan"
    @property
    def color(self): return (255, 220, 30)

    def find_path(self, grid, start, end):
        return _astar(grid, start, end, _manhattan)


class AStarEuclidean(PathfindingAlgorithm):
    """A* with Euclidean distance — works on any geometry."""

    @property
    def name(self):  return "A* Euclidean"
    @property
    def color(self): return (255, 80, 80)

    def find_path(self, grid, start, end):
        return _astar(grid, start, end, _euclidean)


class AStarHex(PathfindingAlgorithm):
    """A* with cube-coordinate hex distance — optimal heuristic for hex grids."""

    @property
    def name(self):  return "A* Hex (cube dist)"
    @property
    def color(self): return (80, 255, 150)

    def find_path(self, grid, start, end):
        return _astar(grid, start, end, _hex_cube_dist)


# Re-export base class so consumers can do `from algorithms.astar import PathfindingAlgorithm`
from .base import PathfindingAlgorithm  # noqa: F401,E402
