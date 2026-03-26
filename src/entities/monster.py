import time


class Monster:
    """An AI-controlled entity that follows a precomputed or live-computed path."""

    def __init__(self, start: tuple, algorithm, color: tuple, name: str = ""):
        self.pos          = start
        self.start_pos    = start
        self.algorithm    = algorithm
        self.color        = color
        self.name         = name or algorithm.name
        self.path: list   = []      # full path (including current pos)
        self.path_idx: int = 0
        self.steps        = 0
        self.total_cost   = 0.0
        self.start_time   = time.time()
        self.reached_end  = False
        self.move_timer   = 0.0    # for real-time movement

    def compute_path(self, grid, end: tuple) -> None:
        """Run the algorithm and cache the path."""
        path, _, _ = self.algorithm.find_path(grid, self.pos, end)
        self.path     = path
        self.path_idx = 0

    def next_step(self) -> tuple | None:
        """Return the next position to move to, or None if done / no path."""
        if not self.path or self.path_idx + 1 >= len(self.path):
            return None
        return self.path[self.path_idx + 1]

    def advance(self) -> None:
        """Move one step along the cached path."""
        nxt = self.next_step()
        if nxt is None:
            return
        self.path_idx  += 1
        self.pos         = nxt
        self.steps      += 1
        self.total_cost += 1.0

    def reset(self) -> None:
        self.pos        = self.start_pos
        self.path       = []
        self.path_idx   = 0
        self.steps      = 0
        self.total_cost = 0.0
        self.start_time = time.time()
        self.reached_end = False
        self.move_timer  = 0.0

    @property
    def elapsed(self) -> float:
        return time.time() - self.start_time

    def stats(self) -> dict:
        return {
            "steps": self.steps,
            "cost" : round(self.total_cost, 1),
            "time" : round(self.elapsed, 1),
        }
