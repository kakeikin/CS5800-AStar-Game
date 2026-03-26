import time


class Player:
    def __init__(self, start: tuple):
        self.pos         = start
        self.start_pos   = start
        self.steps       = 0
        self.total_cost  = 0.0
        self.start_time  = time.time()
        self.reached_end = False

    @property
    def elapsed(self) -> float:
        return time.time() - self.start_time

    def move(self, new_pos: tuple, cost: float = 1.0) -> None:
        self.pos         = new_pos
        self.steps      += 1
        self.total_cost += cost

    def add_bonus(self, delta: float) -> None:
        """Apply a step-count/cost bonus (negative = cheaper)."""
        self.total_cost = max(0, self.total_cost + delta)
        self.steps      = max(0, self.steps + int(delta))

    def reset(self, start: tuple | None = None) -> None:
        self.pos        = start if start is not None else self.start_pos
        self.steps      = 0
        self.total_cost = 0.0
        self.start_time = time.time()
        self.reached_end = False

    def stats(self) -> dict:
        return {
            "steps": self.steps,
            "cost" : round(self.total_cost, 1),
            "time" : round(self.elapsed, 1),
        }
