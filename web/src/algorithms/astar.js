// Mirrors src/algorithms/astar.py — shared A* engine + three heuristic classes.

import { PathfindingAlgorithm } from './base.js';
import { MinHeap } from '../utils.js';

// ── Shared A* engine ──────────────────────────────────────────────────────────

function astar(grid, start, end, heuristic) {
    const g       = new Map([[start, 0]]);
    const prev    = new Map([[start, null]]);
    const closed  = new Set();
    const visited = [];
    let   counter = 0;
    const open    = new MinHeap();
    open.push([heuristic(start, end), counter, start]);

    while (open.size > 0) {
        const [, , node] = open.pop();
        if (closed.has(node)) continue;
        closed.add(node);
        visited.push(node);

        if (node === end) break;

        for (const [nbr, edgeCost] of grid.getNeighborsWithCost(node)) {
            if (closed.has(nbr)) continue;
            const newG = g.get(node) + edgeCost;
            if (!g.has(nbr) || newG < g.get(nbr)) {
                g.set(nbr, newG);
                prev.set(nbr, node);
                counter++;
                open.push([newG + heuristic(nbr, end), counter, nbr]);
            }
        }
    }

    // Reconstruct path
    const path = [];
    let n = end;
    while (n !== null && n !== undefined) {
        path.push(n);
        n = prev.get(n);
    }
    path.reverse();

    return {
        path:         (path.length > 0 && path[0] === start) ? path : [],
        visitedOrder: visited,
        costMap:      g,
    };
}

// ── Heuristics ────────────────────────────────────────────────────────────────
// All heuristics accept posKey strings ("c,r") and parse them internally.

function parseKey(key) {
    const i = key.indexOf(',');
    return [parseInt(key, 10), parseInt(key.slice(i + 1), 10)];
}

function manhattan(a, b) {
    const [ac, ar] = parseKey(a), [bc, br] = parseKey(b);
    return Math.abs(ac - bc) + Math.abs(ar - br);
}

function euclidean(a, b) {
    const [ac, ar] = parseKey(a), [bc, br] = parseKey(b);
    return Math.hypot(ac - bc, ar - br);
}

function hexCubeDist(a, b) {
    // Convert odd-r offset → cube coordinates, then Chebyshev distance
    function toCube(key) {
        const [c, r] = parseKey(key);
        const x = c - ((r - (r & 1)) >> 1);
        const z = r;
        return [x, -x - z, z];
    }
    const [ax, ay, az] = toCube(a);
    const [bx, by, bz] = toCube(b);
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(az - bz));
}

// ── Public algorithm classes ──────────────────────────────────────────────────

/** A* with Manhattan distance — optimal for square 4-way grids. */
export class AStarManhattan extends PathfindingAlgorithm {
    get name()  { return 'A* Manhattan'; }
    get color() { return [255, 220, 30]; }
    findPath(grid, start, end) { return astar(grid, start, end, manhattan); }
}

/** A* with Euclidean distance — works on any grid geometry. */
export class AStarEuclidean extends PathfindingAlgorithm {
    get name()  { return 'A* Euclidean'; }
    get color() { return [255, 80, 80]; }
    findPath(grid, start, end) { return astar(grid, start, end, euclidean); }
}

/** A* with cube-coordinate hex distance — optimal heuristic for hex grids. */
export class AStarHex extends PathfindingAlgorithm {
    get name()  { return 'A* Hex (cube dist)'; }
    get color() { return [80, 255, 150]; }
    findPath(grid, start, end) { return astar(grid, start, end, hexCubeDist); }
}
