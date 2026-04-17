/**
 * renderer.js — Canvas 2D drawing layer.
 * Mirrors src/ui/renderer.py: square maze, hex maze, fog-of-war, entities.
 *
 * All public functions take (ctx, ...) where ctx is a CanvasRenderingContext2D.
 * Position keys are "c,r" strings (posKey encoding from utils.js).
 */

import { keyToPos }                           from './utils.js';
import { HEX_NBR_EVEN, HEX_NBR_ODD, DIR_TO_EDGE } from './config.js';

// ── Global animation time (set each frame via setAnimTime) ────────────────────
let _t = 0;
export function setAnimTime(t) { _t = t; }

// ── Layout ────────────────────────────────────────────────────────────────────
export const SCREEN_WIDTH    = 1100;
export const SCREEN_HEIGHT   = 720;
export const MAZE_AREA_WIDTH = 680;
export const SIDEBAR_X       = 680;
export const SIDEBAR_WIDTH   = 420;   // SCREEN_WIDTH - SIDEBAR_X

// ── Square grid ───────────────────────────────────────────────────────────────
export const CELL_SIZE   = 58;
export const WALL_WIDTH  = 3;
export const SQ_OX       = 50;   // pixel offset inside maze area
export const SQ_OY       = 60;

// ── Hex grid (pointy-top, odd-r offset) ──────────────────────────────────────
export const HEX_SIZE        = 30;
export const HEX_W           = Math.sqrt(3) * HEX_SIZE;
export const HEX_H           = 2 * HEX_SIZE;
export const HEX_ROW_SPACING = 1.5 * HEX_SIZE;
export const HEX_OX          = 88;
export const HEX_OY          = 145;
export const HEX_WALL_W      = 2;

// ── Colours — academic light theme ────────────────────────────────────────────
export const C = {
    // Maze cells
    fog:       '#c8ccd8',   // unseen: light gray
    floor:     '#f0ece4',   // seen: warm cream
    wall:      '#2d303e',   // walls: dark charcoal
    start:     '#1a9a40',   // start: fresh green
    end:       '#c82828',   // exit: red
    reward:    '#d97706',   // gem: amber
    visited:   '#d4e8cf',   // algorithm-visited tint
    // Entities
    player:    '#2563eb',   // player: primary blue
    dijMon:    '#dc2626',   // Dijkstra monster: red
    astarMon:  '#7c3aed',   // A* monster: violet
    // Algorithm identity (consistent across all screens)
    dijkstra:  '#0284c7',   // sky blue
    astarMan:  '#059669',   // emerald
    astarEuc:  '#dc6803',   // orange
    astarHex:  '#7c3aed',   // violet
    // UI chrome — light academic
    uiBg:      '#f4f6fc',   // page background
    uiPanel:   '#ffffff',   // card/panel surface
    uiBorder:  '#d0d4e8',   // borders
    uiText:    '#1a1e3c',   // primary text (dark navy)
    uiHeading: '#3a5272',   // headings (steel blue, not too saturated)
    uiSubtext: '#6070a0',   // secondary text
    uiHilight: '#3d6fa8',   // interactive accent
    uiSuccess: '#16a34a',
    uiWarn:    '#d97706',
    uiDanger:  '#dc2626',
};

// ── Coordinate helpers ────────────────────────────────────────────────────────

/** Pixel rect {x,y,w,h} for a square cell. */
export function sqCellRect(c, r) {
    return { x: SQ_OX + c * CELL_SIZE, y: SQ_OY + r * CELL_SIZE,
             w: CELL_SIZE, h: CELL_SIZE };
}

/** Pixel centre of a hex cell. */
export function hexCenter(c, r) {
    return {
        x: HEX_OX + c * HEX_W + (r % 2) * HEX_W / 2,
        y: HEX_OY + r * HEX_ROW_SPACING,
    };
}

/** Six corner points of a pointy-top hex. */
export function hexCorners(c, r) {
    const { x: cx, y: cy } = hexCenter(c, r);
    return Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 180) * (60 * i + 30);
        return { x: cx + HEX_SIZE * Math.cos(a),
                 y: cy + HEX_SIZE * Math.sin(a) };
    });
}

// ── Square maze renderer ──────────────────────────────────────────────────────

/**
 * Draw the full square maze onto ctx.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Map<string,Set<string>>}  passages
 * @param {Set<string>}              revealed   - set of posKey strings
 * @param {string}                   playerPosK - posKey of player
 * @param {string}                   startK
 * @param {string}                   endK
 * @param {object}                   opts
 *   monsters    {Array<{posK, color}>}
 *   visitedVis  {Set<string>}  algorithm expansion tint
 *   rewardPosK  {string|null}
 */
export function drawSquareMaze(ctx, passages, revealed, playerPosK,
                               startK, endK, opts = {}) {
    const { monsters = [], visitedVis = new Set(), rewardPosK = null } = opts;

    // Maze background
    ctx.fillStyle = '#e8ecf2';
    ctx.fillRect(0, 0, MAZE_AREA_WIDTH, SCREEN_HEIGHT);

    for (const [key, nbrs] of passages) {
        const [c, r] = keyToPos(key);
        const { x, y, w } = sqCellRect(c, r);

        if (!revealed.has(key)) {
            ctx.fillStyle = C.fog;
            ctx.fillRect(x, y, w, w);
            continue;
        }

        // Floor
        ctx.fillStyle = key === startK  ? C.start
                      : key === endK    ? C.end
                      : visitedVis.has(key) ? C.visited
                      : C.floor;
        ctx.fillRect(x, y, w, w);

        // Fog fringe — slightly darken cells at the edge of visibility
        const isEdge = !nbrs.has(_up(key))    || !revealed.has(_up(key))    ||
                       !nbrs.has(_down(key))   || !revealed.has(_down(key))  ||
                       !nbrs.has(_left(key))   || !revealed.has(_left(key))  ||
                       !nbrs.has(_right(key))  || !revealed.has(_right(key));
        if (isEdge && key !== startK && key !== endK) {
            ctx.fillStyle = 'rgba(100,110,150,0.18)';
            ctx.fillRect(x, y, w, w);
        }

        // Exit glow pulse
        if (key === endK) {
            const pulse = 0.55 + 0.45 * Math.sin(_t * 3.5);
            ctx.strokeStyle = `rgba(255,80,80,${(pulse * 0.9).toFixed(2)})`;
            ctx.lineWidth   = 3;
            ctx.strokeRect(x + 2, y + 2, w - 4, w - 4);
        }

        // Reward gem
        if (key === rewardPosK) {
            const glow = 0.5 + 0.5 * Math.sin(_t * 4);
            ctx.fillStyle = `rgba(255,215,0,${(0.28 + 0.12 * glow).toFixed(2)})`;
            ctx.beginPath(); ctx.arc(x + w/2, y + w/2, w/2 + 2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle   = C.reward;
            ctx.beginPath(); ctx.arc(x + w/2, y + w/2, w/4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffffc8';
            ctx.beginPath(); ctx.arc(x + w/2, y + w/2, w/4 - 3, 0, Math.PI * 2); ctx.fill();
        }

        // Walls (draw only the edges that have no passage)
        ctx.strokeStyle = C.wall;
        ctx.lineWidth   = WALL_WIDTH;
        const e = x + w, b = y + w;
        if (!nbrs.has(_up(key)))    _line(ctx, x, y, e, y);
        if (!nbrs.has(_down(key)))  _line(ctx, x, b, e, b);
        if (!nbrs.has(_left(key)))  _line(ctx, x, y, x, b);
        if (!nbrs.has(_right(key))) _line(ctx, e, y, e, b);
    }

    // Entities (draw on top)
    for (const m of monsters) {
        if (!revealed.has(m.posK)) continue;
        const { x, y, w } = sqCellRect(...keyToPos(m.posK));
        _drawDot(ctx, x + w/2, y + w/2, w/3, m.color, false);
    }
    if (passages.has(playerPosK)) {
        const [pc, pr] = keyToPos(playerPosK);
        const { x, y, w } = sqCellRect(pc, pr);
        _drawDot(ctx, x + w/2, y + w/2, w/3, C.player, true);
    }
}

// ── Hex maze renderer ─────────────────────────────────────────────────────────

/**
 * Draw the full hex maze onto ctx.
 * Same options as drawSquareMaze.
 */
export function drawHexMaze(ctx, passages, revealed, playerPosK,
                            startK, endK, opts = {}) {
    const { monsters = [], visitedVis = new Set(), rewardPosK = null } = opts;

    ctx.fillStyle = '#e8ecf2';
    ctx.fillRect(0, 0, MAZE_AREA_WIDTH, SCREEN_HEIGHT);

    for (const [key, nbrs] of passages) {
        const [c, r] = keyToPos(key);
        const corners = hexCorners(c, r);
        const { x: cx, y: cy } = hexCenter(c, r);

        if (!revealed.has(key)) {
            _polygon(ctx, corners, C.fog, null);
            continue;
        }

        const fill = key === startK  ? C.start
                   : key === endK    ? C.end
                   : visitedVis.has(key) ? C.visited
                   : C.floor;
        _polygon(ctx, corners, fill, null);

        // Fog fringe on hex
        const hexIsEdge = [...nbrs].some(nk => !revealed.has(nk)) || nbrs.size < 6;
        if (hexIsEdge && key !== startK && key !== endK) {
            ctx.globalAlpha = 0.22;
            _polygon(ctx, corners, 'rgb(100,110,150)', null);
            ctx.globalAlpha = 1;
        }

        // Exit glow pulse (hex)
        if (key === endK) {
            const pulse = 0.55 + 0.45 * Math.sin(_t * 3.5);
            ctx.strokeStyle = `rgba(255,80,80,${(pulse * 0.85).toFixed(2)})`;
            ctx.lineWidth   = 3;
            const inner = corners.map(p => ({
                x: cx + (p.x - cx) * 0.82, y: cy + (p.y - cy) * 0.82,
            }));
            ctx.beginPath();
            ctx.moveTo(inner[0].x, inner[0].y);
            for (let i = 1; i < inner.length; i++) ctx.lineTo(inner[i].x, inner[i].y);
            ctx.closePath();
            ctx.stroke();
        }

        // Reward
        if (key === rewardPosK) {
            const glow = 0.5 + 0.5 * Math.sin(_t * 4);
            ctx.fillStyle = `rgba(255,215,0,${(0.25 + 0.12 * glow).toFixed(2)})`;
            ctx.beginPath(); ctx.arc(cx, cy, HEX_SIZE * 0.75, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = C.reward;
            ctx.beginPath(); ctx.arc(cx, cy, HEX_SIZE / 2, 0, Math.PI * 2); ctx.fill();
        }

        // Walls — check each of 6 directions
        const offsets = (r % 2 === 1) ? HEX_NBR_ODD : HEX_NBR_EVEN;
        ctx.strokeStyle = C.wall;
        ctx.lineWidth   = HEX_WALL_W;
        for (let d = 0; d < 6; d++) {
            const [dc, dr] = offsets[d];
            const nk = `${c + dc},${r + dr}`;
            if (!nbrs.has(nk)) {
                const [ci, cj] = DIR_TO_EDGE[d];
                _line(ctx, corners[ci].x, corners[ci].y,
                           corners[cj].x, corners[cj].y);
            }
        }
    }

    // Entities
    for (const m of monsters) {
        if (!revealed.has(m.posK)) continue;
        const { x: cx, y: cy } = hexCenter(...keyToPos(m.posK));
        _drawDot(ctx, cx, cy, HEX_SIZE / 2, m.color, false);
    }
    if (passages.has(playerPosK)) {
        const { x: cx, y: cy } = hexCenter(...keyToPos(playerPosK));
        _drawDot(ctx, cx, cy, HEX_SIZE / 2, C.player, true);
    }
}

// ── Fog of war ────────────────────────────────────────────────────────────────

/**
 * Add all cells within Chebyshev distance `radius` of playerPosK to revealed.
 * Mutates the passed-in Set.
 */
export function updateFog(revealed, playerPosK, passages, radius = 2) {
    const [pc, pr] = keyToPos(playerPosK);
    for (const key of passages.keys()) {
        const [c, r] = keyToPos(key);
        if (Math.max(Math.abs(c - pc), Math.abs(r - pr)) <= radius)
            revealed.add(key);
    }
}

// ── Sidebar helpers ───────────────────────────────────────────────────────────

/**
 * Draw the right-side panel background + divider line.
 * Call once per frame before rendering sidebar content.
 */
export function drawSidebarBase(ctx) {
    // Clean white sidebar with subtle top-to-bottom tint
    const grad = ctx.createLinearGradient(SIDEBAR_X, 0, SIDEBAR_X, SCREEN_HEIGHT);
    grad.addColorStop(0,   '#ffffff');
    grad.addColorStop(1,   '#f0f2fa');
    ctx.fillStyle = grad;
    ctx.fillRect(SIDEBAR_X, 0, SIDEBAR_WIDTH, SCREEN_HEIGHT);

    // Divider line
    ctx.strokeStyle = C.uiBorder;
    ctx.lineWidth   = 1;
    _line(ctx, SIDEBAR_X, 0, SIDEBAR_X, SCREEN_HEIGHT);
}

/**
 * Draw a text string.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {object} opts  { size, bold, color, align }
 */
export function drawText(ctx, text, x, y, opts = {}) {
    const { size = 14, bold = false, color = C.uiText, align = 'left', mono = false } = opts;
    const weight = bold ? '700' : '400';
    const family = mono ? "'Fira Code', 'Courier New', monospace"
                        : "'Inter', Arial, sans-serif";
    ctx.font         = `${weight} ${size}px ${family}`;
    ctx.fillStyle    = color;
    ctx.textAlign    = align;
    ctx.textBaseline = 'top';
    ctx.fillText(text, x, y);
}

/**
 * Measure text width (pixels).
 */
export function measureText(ctx, text, size = 14, bold = false) {
    ctx.font = `${bold ? '700' : '400'} ${size}px 'Inter', Arial, sans-serif`;
    return ctx.measureText(text).width;
}

/**
 * Draw a rounded rectangle (fill and/or stroke).
 */
export function drawRoundRect(ctx, x, y, w, h, r = 6,
                              { fill = null, stroke = null, lineWidth = 2 } = {}) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fill)   { ctx.fillStyle   = fill;      ctx.fill();   }
    if (stroke) { ctx.strokeStyle = stroke;
                  ctx.lineWidth   = lineWidth;  ctx.stroke(); }
}

/**
 * Stat block: labelled box with Steps + Time.
 * Returns the y-coordinate after the block.
 */
export function drawStatBlock(ctx, x, y, w, label, steps, elapsed, accentColor) {
    const h = 84;
    // Card — white with subtle border
    drawRoundRect(ctx, x, y, w, h, 8, { fill: '#ffffff', stroke: C.uiBorder, lineWidth: 1 });
    // Accent left bar
    ctx.fillStyle = accentColor;
    ctx.beginPath(); ctx.roundRect(x, y, 4, h, [4, 0, 0, 4]); ctx.fill();

    // Label
    ctx.font         = `600 11px 'Inter', Arial, sans-serif`;
    ctx.fillStyle    = accentColor;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label.toUpperCase(), x + 14, y + 9);

    // Steps — large Fira Code number
    ctx.font      = `700 28px 'Fira Code', 'Courier New', monospace`;
    ctx.fillStyle = C.uiText;
    ctx.fillText(String(steps), x + 14, y + 24);

    // "steps" label
    const numW = ctx.measureText(String(steps)).width;
    ctx.font      = `400 11px 'Inter', Arial, sans-serif`;
    ctx.fillStyle = C.uiSubtext;
    ctx.fillText('steps', x + 14 + numW + 5, y + 36);

    // Time
    ctx.font      = `500 12px 'Fira Code', 'Courier New', monospace`;
    ctx.fillStyle = C.uiSubtext;
    ctx.fillText(`⏱ ${elapsed.toFixed(1)}s`, x + 14, y + 62);

    return y + h + 6;
}

// ── Primitive helpers (private) ───────────────────────────────────────────────

function _line(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

function _polygon(ctx, pts, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    if (fill)   { ctx.fillStyle = fill;   ctx.fill();   }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}

function _drawDot(ctx, cx, cy, r, color, outline) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    if (outline) {
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
    }
}

// Neighbour key helpers for square grid wall checks
function _up(k)    { const i=k.indexOf(','); return `${k.slice(0,i)},${+k.slice(i+1)-1}`; }
function _down(k)  { const i=k.indexOf(','); return `${k.slice(0,i)},${+k.slice(i+1)+1}`; }
function _left(k)  { const i=k.indexOf(','); return `${+k.slice(0,i)-1},${k.slice(i+1)}`; }
function _right(k) { const i=k.indexOf(','); return `${+k.slice(0,i)+1},${k.slice(i+1)}`; }
