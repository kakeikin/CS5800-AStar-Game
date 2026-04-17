// Mirrors src/maze/hex_grid.py — wraps a hex passages map (odd-r offset coords).

import { GRID_COLS, GRID_ROWS, HEX_NBR_EVEN, HEX_NBR_ODD } from '../config.js';
import { posKey } from '../utils.js';

export class HexGrid {
    /**
     * @param {Map<string, Set<string>>} passages
     * @param {number} cols
     * @param {number} rows
     * @param {Map<string, number>} weights
     */
    constructor(passages, cols = GRID_COLS, rows = GRID_ROWS, weights = null) {
        this.passages = passages;
        this.cols     = cols;
        this.rows     = rows;
        this.weights  = weights || new Map();
    }

    // ── Pathfinding interface ─────────────────────────────────────────────────

    getNeighborsWithCost(posK) {
        const result = [];
        for (const nbr of (this.passages.get(posK) || [])) {
            const cost = 1 + (this.weights.get(nbr) || 0);
            result.push([nbr, cost]);
        }
        return result;
    }

    isPassage(a, b) {
        return (this.passages.get(a) || new Set()).has(b);
    }

    // ── All 6 directional neighbours (passage or not) ─────────────────────────

    /**
     * Returns posKey strings of all geometrically adjacent cells (in-bounds).
     * Used by the renderer to determine which edges have walls.
     */
    allNeighbours(posK) {
        const i = posK.indexOf(',');
        const c = parseInt(posK, 10);
        const r = parseInt(posK.slice(i + 1), 10);
        const offsets = (r % 2 === 1) ? HEX_NBR_ODD : HEX_NBR_EVEN;
        const result = [];
        for (const [dc, dr] of offsets) {
            const nc = c + dc, nr = r + dr;
            if (nc >= 0 && nc < this.cols && nr >= 0 && nr < this.rows)
                result.push(posKey(nc, nr));
        }
        return result;
    }

    // ── BFS helpers ───────────────────────────────────────────────────────────

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

    cells() { return [...this.passages.keys()]; }
}
