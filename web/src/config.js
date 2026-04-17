// Mirrors src/config.py — layout & algorithm constants only.
// Rendering constants (CELL_SIZE, colours, fonts) will live in renderer.js.

export const GRID_COLS = 10;
export const GRID_ROWS = 10;
export const FOG_REVEAL_RADIUS = 2;   // Chebyshev radius revealed around player

// ── Hex neighbour offsets (odd-r offset coordinate system) ───────────────────
// Direction indices: 0=NE  1=E  2=SE  3=SW  4=W  5=NW
export const HEX_NBR_EVEN = [[ 0,-1],[1, 0],[0, 1],[-1, 1],[-1, 0],[-1,-1]];
export const HEX_NBR_ODD  = [[ 1,-1],[1, 0],[1, 1],[ 0, 1],[-1, 0],[ 0,-1]];

// Corner-pair that borders each directional edge (for wall rendering later)
export const DIR_TO_EDGE  = [[0,1],[5,0],[4,5],[3,4],[2,3],[1,2]];
