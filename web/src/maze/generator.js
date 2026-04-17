// Mirrors src/maze/generator.py — iterative DFS (recursive backtracker).
// Returns passages as Map<string, Set<string>> using posKey encoding.

import { GRID_COLS, GRID_ROWS, HEX_NBR_EVEN, HEX_NBR_ODD } from '../config.js';
import { posKey, seededRng, choice } from '../utils.js';

// ── Square maze ───────────────────────────────────────────────────────────────

/**
 * Generate a perfect square maze via iterative DFS.
 * @param {number} cols
 * @param {number} rows
 * @param {number|null} seed  - pass a number for reproducibility
 * @returns {Map<string, Set<string>>} passages
 */
export function generateSquareMaze(cols = GRID_COLS, rows = GRID_ROWS, seed = null) {
    const rng = (seed !== null) ? seededRng(seed) : Math.random.bind(Math);

    // Initialise every cell with an empty neighbour set
    const passages = new Map();
    for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
            passages.set(posKey(c, r), new Set());

    const visited = new Set();
    const startKey = posKey(0, rows - 1);   // bottom-left, matches Python
    visited.add(startKey);
    const stack = [startKey];

    while (stack.length > 0) {
        const key = stack[stack.length - 1];
        const [c, r] = key.split(',').map(Number);
        const nbrs = _sqUnvisited(c, r, cols, rows, visited);

        if (nbrs.length > 0) {
            const nbrKey = choice(nbrs, rng);
            // Carve passage in both directions
            passages.get(key).add(nbrKey);
            passages.get(nbrKey).add(key);
            visited.add(nbrKey);
            stack.push(nbrKey);
        } else {
            stack.pop();
        }
    }

    return passages;
}

function _sqUnvisited(c, r, cols, rows, visited) {
    const candidates = [];
    if (r > 0)        candidates.push(posKey(c,     r - 1));
    if (r < rows - 1) candidates.push(posKey(c,     r + 1));
    if (c > 0)        candidates.push(posKey(c - 1, r));
    if (c < cols - 1) candidates.push(posKey(c + 1, r));
    return candidates.filter(k => !visited.has(k));
}

// ── Hex maze ──────────────────────────────────────────────────────────────────

/**
 * Generate a perfect hex maze via iterative DFS (odd-r offset coords).
 * @param {number} cols
 * @param {number} rows
 * @param {number|null} seed
 * @returns {Map<string, Set<string>>} passages
 */
export function generateHexMaze(cols = GRID_COLS, rows = GRID_ROWS, seed = null) {
    const rng = (seed !== null) ? seededRng(seed) : Math.random.bind(Math);

    const passages = new Map();
    for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
            passages.set(posKey(c, r), new Set());

    const visited  = new Set();
    const startKey = posKey(0, rows - 1);
    visited.add(startKey);
    const stack = [startKey];

    while (stack.length > 0) {
        const key = stack[stack.length - 1];
        const [c, r] = key.split(',').map(Number);
        const nbrs = _hexUnvisited(c, r, cols, rows, visited);

        if (nbrs.length > 0) {
            const nbrKey = choice(nbrs, rng);
            passages.get(key).add(nbrKey);
            passages.get(nbrKey).add(key);
            visited.add(nbrKey);
            stack.push(nbrKey);
        } else {
            stack.pop();
        }
    }

    return passages;
}

function _hexUnvisited(c, r, cols, rows, visited) {
    const offsets = (r % 2 === 1) ? HEX_NBR_ODD : HEX_NBR_EVEN;
    const candidates = [];
    for (const [dc, dr] of offsets) {
        const nc = c + dc, nr = r + dr;
        if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) {
            const k = posKey(nc, nr);
            if (!visited.has(k)) candidates.push(k);
        }
    }
    return candidates;
}
