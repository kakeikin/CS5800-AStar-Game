// Mirrors src/maze/square_grid.py — wraps a square passages map for pathfinding.

import { GRID_COLS, GRID_ROWS } from '../config.js';
import { posKey } from '../utils.js';

export class SquareGrid {
    /**
     * @param {Map<string, Set<string>>} passages
     * @param {number} cols
     * @param {number} rows
     * @param {Map<string, number>} weights  extra cost to ENTER a cell (for Layer 2)
     */
    constructor(passages, cols = GRID_COLS, rows = GRID_ROWS, weights = null) {
        this.passages = passages;
        this.cols     = cols;
        this.rows     = rows;
        this.weights  = weights || new Map();
    }

    // ── Pathfinding interface ─────────────────────────────────────────────────

    /**
     * Returns [[neighbourKey, cost], ...] for all passage-connected neighbours.
     * @param {string} posK  posKey string
     */
    getNeighborsWithCost(posK) {
        const result = [];
        for (const nbr of (this.passages.get(posK) || [])) {
            const cost = 1 + (this.weights.get(nbr) || 0);
            result.push([nbr, cost]);
        }
        return result;
    }

    /** True if there is an open passage from posKey a to posKey b. */
    isPassage(a, b) {
        return (this.passages.get(a) || new Set()).has(b);
    }

    // ── BFS helpers ───────────────────────────────────────────────────────────

    /**
     * BFS from start (posKey) → Map<string, number> of step distances.
     * Ignores edge weights; used for fog-of-war and monster proximity tests.
     */
    bfsDistance(startK) {
        const dist = new Map([[startK, 0]]);
        const queue = [startK];
        let head = 0;
        while (head < queue.length) {
            const node = queue[head++];
            for (const nbr of (this.passages.get(node) || [])) {
                if (!dist.has(nbr)) {
                    dist.set(nbr, dist.get(node) + 1);
                    queue.push(nbr);
                }
            }
        }
        return dist;
    }

    /** All cell posKey strings in the grid. */
    cells() { return [...this.passages.keys()]; }
}
