from abc import ABC, abstractmethod
from typing import Any


class PathfindingAlgorithm(ABC):
    """Strategy interface for all pathfinding algorithms."""

    @abstractmethod
    def find_path(self, grid, start: tuple, end: tuple) -> tuple:
        """Return (path, visited_order, cost_map).

        path         – list[tuple] from start to end (empty if unreachable)
        visited_order – list[tuple] of nodes in expansion order
        cost_map      – dict[tuple, float] g-cost to reach each node
        """

    @property
    @abstractmethod
    def name(self) -> str: ...

    @property
    @abstractmethod
    def color(self) -> tuple: ...
