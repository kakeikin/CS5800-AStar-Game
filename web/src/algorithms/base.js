// Mirrors src/algorithms/base.py — Strategy interface for pathfinding.

export class PathfindingAlgorithm {
    /** Human-readable name shown in the UI. @returns {string} */
    get name()  { throw new Error(`${this.constructor.name}: name not implemented`); }

    /** RGB colour used for this algorithm's visualisation. @returns {[number,number,number]} */
    get color() { throw new Error(`${this.constructor.name}: color not implemented`); }

    /**
     * Run the algorithm and return results.
     *
     * @param {object} grid   - SquareGrid or HexGrid instance
     * @param {string} start  - posKey string e.g. "0,9"
     * @param {string} end    - posKey string e.g. "9,0"
     * @returns {{ path: string[], visitedOrder: string[], costMap: Map<string,number> }}
     *   path        — ordered list of posKey strings from start → end (empty if unreachable)
     *   visitedOrder— nodes in expansion order (for step-by-step visualisation)
     *   costMap     — g-cost to reach each expanded node
     */
    findPath(grid, start, end) {
        throw new Error(`${this.constructor.name}: findPath not implemented`);
    }
}
