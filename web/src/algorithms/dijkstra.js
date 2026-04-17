// Mirrors src/algorithms/dijkstra.py — uniform-cost search (h = 0).

import { PathfindingAlgorithm } from './base.js';
import { MinHeap } from '../utils.js';

export class Dijkstra extends PathfindingAlgorithm {
    get name()  { return 'Dijkstra'; }
    get color() { return [80, 120, 255]; }

    findPath(grid, start, end) {
        const dist   = new Map([[start, 0]]);
        const prev   = new Map([[start, null]]);
        const closed = new Set();
        const visitedOrder = [];
        const pq = new MinHeap();
        pq.push([0, start]);

        while (pq.size > 0) {
            const [cost, node] = pq.pop();
            if (closed.has(node)) continue;
            closed.add(node);
            visitedOrder.push(node);

            if (node === end) break;

            for (const [nbr, edgeCost] of grid.getNeighborsWithCost(node)) {
                const newCost = cost + edgeCost;
                if (!dist.has(nbr) || newCost < dist.get(nbr)) {
                    dist.set(nbr, newCost);
                    prev.set(nbr, node);
                    pq.push([newCost, nbr]);
                }
            }
        }

        return {
            path:         _reconstruct(prev, start, end),
            visitedOrder,
            costMap: dist,
        };
    }
}

// ── Shared path-reconstruction helper (also used by astar.js) ────────────────

export function reconstruct(prev, start, end) {
    return _reconstruct(prev, start, end);
}

function _reconstruct(prev, start, end) {
    const path = [];
    let node = end;
    while (node !== null && node !== undefined) {
        path.push(node);
        node = prev.get(node);
    }
    path.reverse();
    return (path.length > 0 && path[0] === start) ? path : [];
}
