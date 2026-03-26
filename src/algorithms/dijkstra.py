import heapq
from .base import PathfindingAlgorithm


class Dijkstra(PathfindingAlgorithm):
    """Uniform-cost search: h(n) = 0."""

    @property
    def name(self) -> str:
        return "Dijkstra"

    @property
    def color(self) -> tuple:
        return (80, 120, 255)

    def find_path(self, grid, start: tuple, end: tuple) -> tuple:
        dist   = {start: 0}
        prev   = {start: None}
        closed = set()
        visited_order = []
        pq = [(0, start)]

        while pq:
            cost, node = heapq.heappop(pq)
            if node in closed:
                continue
            closed.add(node)
            visited_order.append(node)

            if node == end:
                break

            for neighbor, edge_cost in grid.get_neighbors_with_cost(node):
                new_cost = cost + edge_cost
                if neighbor not in dist or new_cost < dist[neighbor]:
                    dist[neighbor] = new_cost
                    prev[neighbor] = node
                    heapq.heappush(pq, (new_cost, neighbor))

        return _reconstruct(prev, start, end), visited_order, dist


def _reconstruct(prev: dict, start: tuple, end: tuple) -> list:
    path, node = [], end
    while node is not None:
        path.append(node)
        node = prev.get(node)
    path.reverse()
    return path if path and path[0] == start else []
