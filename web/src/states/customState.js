/**
 * customState.js — Custom Mode: A* Pathfinding Visualizer
 * Side-by-side comparison of Dijkstra, A* Manhattan, A* Euclidean
 * on an interactive 20×20 weighted grid.
 *
 * Ported from https://github.com/pstereoluna/5800-Astar-Visualizer
 */

import { MinHeap } from '../utils.js';

// ── Layout (1100 × 720 canvas) — 3 panels fill full width ────────────────────
const CELL          = 17;
const GRID_N        = 20;
const GRID_PX       = GRID_N * CELL;          // 340

const TOOLBAR_H     = 116;
const PANEL_LABEL_H = 22;
const GRID_Y        = TOOLBAR_H + PANEL_LABEL_H; // 138
const PM            = 5;
const PANEL_W       = GRID_PX + 20;              // 360  (10px padding each side)
const PANEL_XS      = [PM, PM + PANEL_W + PM, PM + 2 * (PANEL_W + PM)]; // [5,370,735]

const METRICS_Y     = GRID_Y + GRID_PX;       // 470
const METRICS_H     = 60;
const LEGEND_Y      = METRICS_Y + METRICS_H;  // 530
// LEGEND runs to 720

// ── Terrain ───────────────────────────────────────────────────────────────────
const TERRAIN_COST = { empty: 1, grass: 2, swamp: 5, wall: Infinity };
const TERRAIN_COLOR = {
    empty: '#f0f0f2',
    grass: '#78c34b',
    swamp: '#825a28',
    wall:  '#262630',
};

// ── Vis colours (academic light theme) ────────────────────────────────────────
const C_OPEN      = '#93c5fd';   // open set: light blue
const C_CLOSED    = '#fed7aa';   // expanded: light orange
const C_CURRENT   = '#fbbf24';   // current: amber
const C_PATH      = '#7c3aed';   // path: violet
const C_PATH_GLOW = '#a78bfa';   // path glow: lighter violet
const C_START     = '#16a34a';   // start: green
const C_GOAL      = '#dc2626';   // goal: red
const PULSE_SPEED = 4.0;

// ── UI palette — Claymorphism / Academic (ui-ux-pro-max design system) ────────
const C_BG        = '#F8FAFC';   // near-white background
const C_PANEL_BG  = '#ffffff';
const C_TOOLBAR_A = '#59708c';   // gradient start (original steel-blue, slightly darker)
const C_TOOLBAR_B = '#8aa4bc';   // gradient end  (lighter steel-blue)
const C_METRICS   = '#EEF2FF';   // indigo-50
const C_LEGEND_BG = '#F0F4FF';
const C_GRID_LINE = '#CBD5E1';
const C_TEXT      = '#1E3A8A';   // deep blue foreground
const C_DIM       = '#64748B';   // slate-500
const C_ACCENT    = '#D97706';   // amber — CTA / highlights
const C_BORDER    = '#BFDBFE';   // blue-200
const C_BTN_IDLE  = '#EFF6FF';   // blue-50
const C_BTN_HOVER = '#DBEAFE';   // blue-100
const C_BTN_ACT   = '#1E40AF';   // deep blue — active/selected
const C_BTN_TEXT  = '#1E3A8A';
const C_BTN_TEXT_ACT = '#FFFFFF';
const C_PRED      = '#DB2777';
// Clay shadow tokens
const CLAY_SHADOW      = 'rgba(30, 64, 175, 0.18)';
const CLAY_SHADOW_SM   = 'rgba(30, 64, 175, 0.12)';

// ── Algo labels / colours (matching game's C object) ───────────────────────────
const ALGO_NAMES  = ['Dijkstra', 'A* Manhattan', 'A* Euclidean'];
const ALGO_COLORS = ['#0284c7', '#059669', '#dc6803'];

// ── Speed presets [label, ms-per-tick (0=max)] ─────────────────────────────────
const SPEEDS = [['Slow', 300], ['Med', 80], ['Fast', 20], ['Max', 0]];

// ── Local posKey helpers (row,col order) ───────────────────────────────────────
function pk(r, c)  { return `${r},${c}`; }
function upk(key)  { const [r, c] = key.split(',').map(Number); return [r, c]; }

// ══════════════════════════════════════════════════════════════════════════════
// Grid model
// ══════════════════════════════════════════════════════════════════════════════

class VisuGrid {
    constructor() {
        this.rows  = GRID_N;
        this.cols  = GRID_N;
        this.cells = Array.from({ length: GRID_N }, () => Array(GRID_N).fill('empty'));
        this.start = pk(Math.floor(GRID_N / 2), 2);
        this.goal  = pk(Math.floor(GRID_N / 2), GRID_N - 3);
    }

    inBounds(r, c)  { return r >= 0 && r < this.rows && c >= 0 && c < this.cols; }
    getTerrain(r, c){ return this.cells[r][c]; }
    getCost(r, c)   { return TERRAIN_COST[this.cells[r][c]]; }
    walkable(r, c)  { return this.cells[r][c] !== 'wall'; }
    baseColor(r, c) { return TERRAIN_COLOR[this.cells[r][c]]; }

    setTerrain(r, c, terrain) {
        if (!this.inBounds(r, c)) return;
        if (pk(r, c) === this.start || pk(r, c) === this.goal) return;
        this.cells[r][c] = terrain;
    }
    moveStart(r, c) {
        if (!this.inBounds(r, c) || pk(r, c) === this.goal) return;
        if (this.cells[r][c] === 'wall') this.cells[r][c] = 'empty';
        this.start = pk(r, c);
    }
    moveGoal(r, c) {
        if (!this.inBounds(r, c) || pk(r, c) === this.start) return;
        if (this.cells[r][c] === 'wall') this.cells[r][c] = 'empty';
        this.goal = pk(r, c);
    }
    clear() {
        this.cells = Array.from({ length: GRID_N }, () => Array(GRID_N).fill('empty'));
        this.start = pk(Math.floor(GRID_N / 2), 2);
        this.goal  = pk(Math.floor(GRID_N / 2), GRID_N - 3);
    }
    neighbors(r, c) {
        const result = [];
        for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
            const nr = r + dr, nc = c + dc;
            if (this.inBounds(nr, nc) && this.walkable(nr, nc))
                result.push(pk(nr, nc));
        }
        return result;
    }

    // ── Preset maps ───────────────────────────────────────────────────────────
    loadBarrier() {
        this.clear();
        const mid = Math.floor(this.cols / 2);
        for (let r = 0; r < this.rows; r++) {
            if (r !== Math.floor(this.rows / 4) && r !== Math.floor(3 * this.rows / 4))
                this.cells[r][mid] = 'wall';
        }
    }
    loadMaze() {
        this.clear();
        for (const [r, c] of [
            [2,3],[3,3],[4,3],[5,3],[6,3],[2,7],[3,7],[4,7],
            [6,7],[7,7],[8,7],[9,7],[4,11],[5,11],[6,11],[7,11],[8,11],
            [2,15],[3,15],[4,15],[10,3],[11,3],[12,3],[12,7],[13,7],[14,7],
            [10,11],[10,12],[10,13],[14,11],[15,11],[16,11],[12,15],[13,15],[14,15],[15,15],
        ]) { if (pk(r,c) !== this.start && pk(r,c) !== this.goal) this.cells[r][c] = 'wall'; }
        for (const [r, c] of [[7,4],[7,5],[8,4],[8,5],[9,4],[3,12],[3,13],[4,12],[4,13]])
            { if (pk(r,c) !== this.start && pk(r,c) !== this.goal) this.cells[r][c] = 'swamp'; }
        for (const [r, c] of [[14,4],[15,4],[16,4],[14,5],[5,16],[6,16],[5,17],[6,17]])
            { if (pk(r,c) !== this.start && pk(r,c) !== this.goal) this.cells[r][c] = 'grass'; }
    }
    loadRandom() {
        this.clear();
        const wallP = 0.25;
        for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
            if (pk(r,c) === this.start || pk(r,c) === this.goal) continue;
            const roll = Math.random();
            if      (roll < wallP)        this.cells[r][c] = 'wall';
            else if (roll < wallP + 0.10) this.cells[r][c] = 'swamp';
            else if (roll < wallP + 0.18) this.cells[r][c] = 'grass';
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// Algorithm generators
// ══════════════════════════════════════════════════════════════════════════════

function hZero(a, b)       { return 0; }
function hManhattan(a, b)  {
    const [ar, ac] = upk(a), [br, bc] = upk(b);
    return Math.abs(ar - br) + Math.abs(ac - bc);
}
function hEuclidean(a, b)  {
    const [ar, ac] = upk(a), [br, bc] = upk(b);
    return Math.hypot(ar - br, ac - bc);
}

function _reconstruct(cameFrom, goal) {
    const path = [];
    let cur = goal;
    while (cur !== undefined) { path.push(cur); cur = cameFrom.get(cur); }
    return path.reverse();
}

function* _searchGen(grid, heuristic) {
    const start = grid.start, goal = grid.goal;
    const t0 = performance.now();

    const g        = new Map([[start, 0]]);
    const f        = new Map();
    const cameFrom = new Map([[start, undefined]]);
    const openSet  = new Set([start]);
    const closed   = new Set();

    let counter = 0;
    f.set(start, heuristic(start, goal));
    const heap = new MinHeap();
    heap.push([f.get(start), counter, start]);

    const state = {
        expanded: closed, openSet, current: null,
        fVals: f, gVals: g, path: [],
        nodesExpanded: 0, pathCost: 0, runtimeMs: 0,
        done: false, found: false,
    };

    while (heap.size > 0) {
        const [, , pos] = heap.pop();
        if (closed.has(pos)) { openSet.delete(pos); continue; }
        openSet.delete(pos);
        closed.add(pos);
        state.current       = pos;
        state.nodesExpanded = closed.size;

        yield state;

        if (pos === goal) {
            state.path      = _reconstruct(cameFrom, goal);
            state.pathCost  = g.get(goal);
            state.runtimeMs = performance.now() - t0;
            state.done = state.found = true;
            yield state; return;
        }

        const [pr, pc] = upk(pos);
        for (const nb of grid.neighbors(pr, pc)) {
            if (closed.has(nb)) continue;
            const [nr, nc] = upk(nb);
            const tg = g.get(pos) + grid.getCost(nr, nc);
            if (tg < (g.get(nb) ?? Infinity)) {
                g.set(nb, tg); cameFrom.set(nb, pos);
                const hn = heuristic(nb, goal);
                f.set(nb, tg + hn);
                counter++;
                heap.push([tg + hn, counter, nb]);
                openSet.add(nb);
            }
        }
    }
    state.current = null; state.done = true; state.found = false;
    state.runtimeMs = performance.now() - t0;
    state.nodesExpanded = closed.size;
    yield state;
}

// ══════════════════════════════════════════════════════════════════════════════
// State factory
// ══════════════════════════════════════════════════════════════════════════════

export function createCustomState(ctx, goTo) {
    const grid = new VisuGrid();

    // ── App state ──────────────────────────────────────────────────────────────
    let brush       = 'wall';
    let painting    = false;
    let lastCell    = null;
    let showVals    = true;
    let speedIdx    = 1;
    let animating   = false;
    let accumMs     = 0;
    let globalTime  = 0;
    let predictedPath = [];   // array of posKey strings

    let gens   = [null, null, null];
    let states = [null, null, null];
    let done   = [false, false, false];

    // ── Mouse ──────────────────────────────────────────────────────────────────
    let mouseX = 0, mouseY = 0;

    // ── Button definitions ─────────────────────────────────────────────────────
    // Each button: { x, y, w, h, label, active, key?, terrain?, icon? }
    let brushBtns  = [];
    let presetBtns = [];
    let actionBtns = {};
    let speedBtns  = [];

    function _buildToolbar() {
        const R1Y = 6, R1H = 64;
        const R2Y = 84, R2H = 26;

        // Row 1: Brush buttons (icon + label)
        brushBtns = [];
        const brushDefs = [
            { terrain:'wall',    label:'Walls',   w:68 },
            { terrain:'empty',   label:'Erase',   w:68 },
            { terrain:'grass',   label:'Grass',   w:68 },
            { terrain:'swamp',   label:'Swamp',   w:68 },
            { terrain:'start',   label:'Start',   w:68 },
            { terrain:'goal',    label:'Goal',    w:68 },
            { terrain:'predict', label:'Predict', w:84 },
        ];
        let bx = 10;
        for (const d of brushDefs) {
            brushBtns.push({ x:bx, y:R1Y, w:d.w, h:R1H, label:d.label,
                             terrain:d.terrain, active:(d.terrain === brush) });
            bx += d.w + 5;
        }

        // Row 1: Preset buttons
        presetBtns = [];
        const presetDefs = [
            { key:'maze',    label:'Maze',    w:72 },
            { key:'barrier', label:'Barrier', w:76 },
            { key:'random',  label:'Random',  w:76 },
        ];
        bx += 10;
        for (const d of presetDefs) {
            presetBtns.push({ x:bx, y:R1Y, w:d.w, h:R1H, label:d.label,
                              key:d.key, active:false });
            bx += d.w + 5;
        }

        // Row 2: Action buttons
        actionBtns = {};
        const actionDefs = [
            { key:'run',   label:'Run ▶  [R]', w:96 },
            { key:'play',  label:'⏸ Pause',    w:86 },
            { key:'step',  label:'Step →',     w:76 },
            { key:'reset', label:'Reset',      w:64 },
            { key:'clear', label:'Clear [C]',  w:74 },
        ];
        let ax = 10;
        for (const d of actionDefs) {
            actionBtns[d.key] = { x:ax, y:R2Y, w:d.w, h:R2H, label:d.label, active:false };
            ax += d.w + 6;
        }

        // Row 2: Speed buttons
        speedBtns = [];
        let sx = ax + 16;
        for (let i = 0; i < SPEEDS.length; i++) {
            speedBtns.push({ x:sx, y:R2Y, w:54, h:R2H, label:SPEEDS[i][0],
                             active:(i === speedIdx) });
            sx += 58;
        }

        // Row 2: f(n) toggle
        actionBtns['vals'] = { x:sx + 6, y:R2Y, w:82, h:R2H,
                               label:'f(n) vals', active:showVals };
    }

    // ── Lifecycle ──────────────────────────────────────────────────────────────

    function enter() {
        grid.clear();
        predictedPath = [];
        gens   = [null, null, null];
        states = [null, null, null];
        done   = [false, false, false];
        animating = false;
        accumMs   = 0;
        globalTime = 0;
        brush  = 'wall';
        speedIdx = 1;
        showVals = true;
        _buildToolbar();
    }

    // ── Update ─────────────────────────────────────────────────────────────────

    function update(dt) {
        globalTime += dt;
        if (!animating) return;

        const intervalMs = SPEEDS[speedIdx][1];

        if (intervalMs === 0) {
            // Max speed: drain all generators this frame
            let anyAlive = true;
            while (anyAlive) { anyAlive = _tick(); }
        } else {
            accumMs += dt * 1000;
            while (accumMs >= intervalMs) {
                accumMs -= intervalMs;
                _tick();
            }
        }
    }

    /** Advance all alive generators one step. Returns true if any was still alive. */
    function _tick() {
        let anyAlive = false;
        for (let i = 0; i < 3; i++) {
            if (!gens[i] || done[i]) continue;
            anyAlive = true;
            const result = gens[i].next();
            if (result.done || (result.value && result.value.done)) {
                if (result.value) states[i] = result.value;
                done[i] = true;
            } else {
                states[i] = result.value;
            }
        }
        if (done.every(Boolean) && animating) {
            animating = false;
            actionBtns['play'].label = '▶ Play';
        }
        return anyAlive && !done.every(Boolean);
    }

    // ── Input ──────────────────────────────────────────────────────────────────

    function handleKey(key) {
        if (key === 'r' || key === 'R') { _doRun(); return; }
        if (key === ' ')                { _doPlayPause(); return; }
        if (key === 'ArrowRight')       { _doStep(); return; }
        if (key === 'c' || key === 'C') { _doClear(); return; }
        if (key === 'h' || key === 'H') { _toggleVals(); return; }
    }

    function handleMouseMove(x, y) {
        mouseX = x; mouseY = y;
        if (painting) _paintAt(x, y, false);
    }

    function handleMouseDown(x, y) {
        // ── Toolbar buttons ──────────────────────────────────────────────────
        for (const btn of brushBtns) {
            if (_hit(btn, x, y)) {
                brush = btn.terrain;
                brushBtns.forEach(b => b.active = (b.terrain === brush));
                return;
            }
        }
        for (const btn of presetBtns) {
            if (_hit(btn, x, y)) { _loadPreset(btn.key); return; }
        }
        for (const [key, btn] of Object.entries(actionBtns)) {
            if (_hit(btn, x, y)) {
                ({ run:_doRun, play:_doPlayPause, step:_doStep,
                   reset:_doReset, clear:_doClear, vals:_toggleVals })[key]?.();
                return;
            }
        }
        for (let i = 0; i < speedBtns.length; i++) {
            if (_hit(speedBtns[i], x, y)) { _setSpeed(i); return; }
        }
        // ── Grid painting ────────────────────────────────────────────────────
        painting = true; lastCell = null;
        _paintAt(x, y, false);
    }

    function handleMouseUp() {
        painting = false; lastCell = null;
    }

    function handleRightClick(x, y) {
        painting = true; lastCell = null;
        _paintAt(x, y, true);
    }

    // handleClick is an alias so states that only expose handleClick still work
    function handleClick(x, y) { handleMouseDown(x, y); }

    // ── Painting ──────────────────────────────────────────────────────────────

    function _paintAt(mx, my, erase) {
        for (const px of PANEL_XS) {
            const gx = mx - (px + 11);
            const gy = my - GRID_Y;
            if (gx < 0 || gx >= GRID_PX || gy < 0 || gy >= GRID_PX) continue;
            const col = Math.floor(gx / CELL);
            const row = Math.floor(gy / CELL);
            const key = pk(row, col);
            if (key === lastCell) return;
            lastCell = key;

            if (erase) {
                if (brush === 'predict') {
                    predictedPath = predictedPath.filter(k => k !== key);
                } else {
                    grid.setTerrain(row, col, 'empty');
                }
            } else if (brush === 'start') {
                grid.moveStart(row, col);
            } else if (brush === 'goal') {
                grid.moveGoal(row, col);
            } else if (brush === 'predict') {
                if (!predictedPath.includes(key)) predictedPath.push(key);
            } else {
                grid.setTerrain(row, col, brush);
            }

            // Invalidate search on grid change
            if (brush !== 'predict' && states.some(s => s !== null)) _doReset();
            return;
        }
    }

    // ── Actions ────────────────────────────────────────────────────────────────

    function _doRun() {
        gens   = [_searchGen(grid, hZero),
                  _searchGen(grid, hManhattan),
                  _searchGen(grid, hEuclidean)];
        states = [null, null, null];
        done   = [false, false, false];
        animating = true;
        accumMs   = 0;
        actionBtns['play'].label = '⏸ Pause';
    }

    function _doPlayPause() {
        if (gens.every(g => g === null)) { _doRun(); return; }
        animating = !animating;
        actionBtns['play'].label = animating ? '⏸ Pause' : '▶ Play';
        if (animating) accumMs = 0;
    }

    function _doStep() {
        if (gens.every(g => g === null)) return;
        animating = false;
        actionBtns['play'].label = '▶ Play';
        _tick();
    }

    function _doReset() {
        gens   = [null, null, null];
        states = [null, null, null];
        done   = [false, false, false];
        animating = false;
        accumMs   = 0;
        actionBtns['play'].label = '▶ Play';
        predictedPath = [];
    }

    function _doClear() {
        _doReset();
        grid.clear();
    }

    function _toggleVals() {
        showVals = !showVals;
        actionBtns['vals'].active = showVals;
    }

    function _loadPreset(key) {
        _doReset();
        if (key === 'maze')    grid.loadMaze();
        if (key === 'barrier') grid.loadBarrier();
        if (key === 'random')  grid.loadRandom();
    }

    function _setSpeed(idx) {
        speedIdx = idx;
        speedBtns.forEach((b, i) => b.active = (i === idx));
        accumMs = 0;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Draw
    // ══════════════════════════════════════════════════════════════════════════

    function draw() {
        // Background
        ctx.fillStyle = C_BG;
        ctx.fillRect(0, 0, 1100, 720);

        _drawToolbar();

        for (let i = 0; i < 3; i++) _drawPanel(i);

        _drawMetrics();
        _drawLegend();
    }

    // ── Toolbar ────────────────────────────────────────────────────────────────

    function _drawToolbar() {
        // ── Row 1: gradient header (deep blue → sky blue) ──────────────────────
        const grad = ctx.createLinearGradient(0, 0, 1100, 0);
        grad.addColorStop(0, C_TOOLBAR_A);
        grad.addColorStop(1, C_TOOLBAR_B);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1100, 78);

        // Title — Crimson Pro, white, right-aligned
        ctx.font = '600 14px "Crimson Pro", Georgia, serif';
        ctx.fillStyle    = 'rgba(255,255,255,0.92)';
        ctx.textAlign    = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText('A* Pathfinding Visualizer  ·  CS5800', 1088, 39);

        // Subtle divider dots between button groups in Row 1
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(presetBtns[0].x - 8, 14, 1, 44);   // between brushes and presets

        // ── Row 2: light background ─────────────────────────────────────────────
        ctx.fillStyle = '#F0F4FF';
        ctx.fillRect(0, 78, 1100, TOOLBAR_H - 78);
        _hline(0, TOOLBAR_H - 1, 1100, C_BORDER);

        // Row 2 section labels
        ctx.font = '500 11px "Atkinson Hyperlegible", "Inter", Arial';
        ctx.fillStyle    = C_DIM;
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('Controls:', 10, 97);
        ctx.fillText('Speed:', speedBtns[0].x, 97);

        const allBtns = [...brushBtns, ...presetBtns,
                         ...Object.values(actionBtns), ...speedBtns];
        for (const btn of allBtns) _drawBtn(btn);
    }

    function _drawBtn(btn) {
        const hov      = _hit(btn, mouseX, mouseY);
        const isActive = btn.active;
        const isLarge  = btn.h > 40;   // Row 1 (64px) vs Row 2 (26px)
        const radius   = isLarge ? 14 : 9;
        const bg       = isActive ? C_BTN_ACT : (hov ? C_BTN_HOVER : C_BTN_IDLE);
        const textCol  = isActive ? C_BTN_TEXT_ACT : C_BTN_TEXT;

        ctx.save();
        // Clay outer shadow — omit on active (pressed-in feel)
        if (!isActive) {
            ctx.shadowColor   = isLarge ? CLAY_SHADOW : CLAY_SHADOW_SM;
            ctx.shadowOffsetX = isLarge ? 3 : 2;
            ctx.shadowOffsetY = isLarge ? 3 : 2;
            ctx.shadowBlur    = isLarge ? 10 : 6;
        }
        ctx.beginPath();
        ctx.roundRect(btn.x, btn.y, btn.w, btn.h, radius);
        ctx.fillStyle = bg;
        ctx.fill();
        // Crisp border — no shadow
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
        ctx.strokeStyle = isActive ? '#1D4ED8' : C_BORDER;
        ctx.lineWidth   = isLarge ? 2 : 1.5;
        ctx.stroke();
        ctx.restore();

        // Label
        ctx.font = `600 11px 'Atkinson Hyperlegible', 'Inter', Arial`;
        ctx.fillStyle    = textCol;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h - (isLarge ? 5 : 4));

        // Icon for brush buttons (Row 1)
        if (btn.terrain && isLarge) {
            const cx = btn.x + btn.w / 2, cy = btn.y + 22;
            _drawBrushIcon(btn.terrain, cx, cy);
        }
        // Icon for preset buttons (Row 1)
        if (btn.key && isLarge) {
            const cx = btn.x + btn.w / 2, cy = btn.y + 22;
            _drawPresetIcon(btn.key, cx, cy, isActive);
        }
    }

    function _drawBrushIcon(type, cx, cy) {
        ctx.save();
        if (type === 'wall') {
            ctx.fillStyle = '#b2aeb4';
            for (let row = 0; row < 2; row++) {
                const ox = cx - 12 + (row === 1 ? 6 : 0);
                const oy = cy - 5 + row * 8;
                for (let b = 0; b < 2; b++) {
                    _rect(ox + b * 14, oy, 11, 5, '#b2aeb4');
                }
            }
        } else if (type === 'empty') {
            // Eraser / broom icon
            ctx.strokeStyle = '#c89b50'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(cx + 8, cy - 10); ctx.lineTo(cx - 2, cy + 5); ctx.stroke();
            ctx.strokeStyle = '#e8c378'; ctx.lineWidth = 1;
            for (let i = 0; i < 5; i++) {
                const angle = Math.PI * (0.75 + i * 0.125);
                ctx.beginPath(); ctx.moveTo(cx - 6, cy + 8);
                ctx.lineTo(cx - 6 + 10 * Math.cos(angle), cy + 8 + 10 * Math.sin(angle));
                ctx.stroke();
            }
        } else if (type === 'grass') {
            ctx.fillStyle = '#48961e';
            ctx.beginPath(); ctx.moveTo(cx - 8, cy - 6); ctx.lineTo(cx - 12, cy + 7); ctx.lineTo(cx - 3, cy + 7); ctx.fill();
            ctx.beginPath(); ctx.moveTo(cx + 8, cy - 6); ctx.lineTo(cx + 3, cy + 7); ctx.lineTo(cx + 12, cy + 7); ctx.fill();
            ctx.fillStyle = '#78c34b';
            ctx.beginPath(); ctx.moveTo(cx, cy - 12); ctx.lineTo(cx - 5, cy + 7); ctx.lineTo(cx + 5, cy + 7); ctx.fill();
        } else if (type === 'swamp') {
            ctx.fillStyle = '#5a82c3';
            ctx.beginPath(); ctx.moveTo(cx, cy - 12); ctx.lineTo(cx - 8, cy); ctx.lineTo(cx + 8, cy); ctx.fill();
            ctx.beginPath(); ctx.arc(cx, cy + 4, 8, 0, Math.PI * 2); ctx.fill();
        } else if (type === 'start') {
            _glowCircle(cx, cy, 12, '#32cd32');
        } else if (type === 'goal') {
            _glowCircle(cx, cy, 12, '#dc143c');
        } else if (type === 'predict') {
            ctx.strokeStyle = C_PRED; ctx.lineWidth = 2;
            const pts = [[cx-10,cy+6],[cx-3,cy-4],[cx+3,cy+6],[cx+10,cy-4]];
            ctx.beginPath(); ctx.moveTo(...pts[0]);
            for (let i=1;i<pts.length;i++) ctx.lineTo(...pts[i]); ctx.stroke();
            ctx.fillStyle = C_PRED;
            ctx.beginPath(); ctx.moveTo(cx+10,cy-4); ctx.lineTo(cx+7,cy-10); ctx.lineTo(cx+14,cy-10); ctx.fill();
        }
        ctx.restore();
    }

    function _drawPresetIcon(type, cx, cy, isActive) {
        ctx.save();
        const wallC  = isActive ? '#c0c0d0' : '#5a5270';
        const floorC = isActive ? 'rgba(255,255,255,0.3)' : '#e8e4f0';
        const pathC  = isActive ? '#a5b4fc' : '#7c3aed';
        const arrowC = isActive ? '#93c5fd' : '#0284c7';

        if (type === 'maze') {
            // 5×5 mini maze grid (4px cells)
            const s = 4, ox = cx - 10, oy = cy - 10;
            const walls = [[0,1],[1,1],[1,3],[2,3],[3,0],[3,1],[4,3]];
            const pathCells = [[0,0],[1,0],[2,0],[2,1],[2,2],[3,2],[4,2],[4,4]];
            const wallSet = new Set(walls.map(([r,c]) => `${r},${c}`));
            const pathSet = new Set(pathCells.map(([r,c]) => `${r},${c}`));
            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 5; c++) {
                    const k = `${r},${c}`;
                    ctx.fillStyle = wallSet.has(k) ? wallC
                                  : pathSet.has(k) ? pathC
                                  : floorC;
                    ctx.fillRect(ox + c * s + 1, oy + r * s + 1, s - 1, s - 1);
                }
            }
            // Start / end dots
            ctx.fillStyle = '#16a34a';
            ctx.beginPath(); ctx.arc(ox + 2, oy + 2, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#dc2626';
            ctx.beginPath(); ctx.arc(ox + 5 * s - 2, oy + 5 * s - 2, 2.5, 0, Math.PI * 2); ctx.fill();

        } else if (type === 'barrier') {
            // Vertical wall in centre with a gap; arrow goes around
            const midX = cx;
            ctx.strokeStyle = wallC; ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(midX, cy - 11); ctx.lineTo(midX, cy - 2);  // top segment
            ctx.moveTo(midX, cy + 4);  ctx.lineTo(midX, cy + 11); // bottom segment
            ctx.stroke();
            // Arrow path going left-around the wall
            ctx.strokeStyle = arrowC; ctx.lineWidth = 2; ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(midX - 2, cy - 9);
            ctx.lineTo(cx - 9, cy - 9);
            ctx.lineTo(cx - 9, cy + 9);
            ctx.lineTo(midX - 2, cy + 9);
            ctx.stroke();
            // Arrowhead
            ctx.fillStyle = arrowC;
            ctx.beginPath();
            ctx.moveTo(midX - 2, cy + 5);
            ctx.lineTo(midX - 2, cy + 13);
            ctx.lineTo(midX + 5, cy + 9);
            ctx.fill();

        } else if (type === 'random') {
            // Scattered terrain patches
            const patches = [
                { dx: -10, dy: -9,  w: 6, h: 5, c: wallC             },  // wall
                { dx:  -1, dy: -11, w: 5, h: 4, c: '#78c34b'         },  // grass
                { dx:   5, dy: -7,  w: 5, h: 5, c: wallC             },  // wall
                { dx:  -9, dy:   1, w: 4, h: 4, c: '#a07840'         },  // swamp
                { dx:   2, dy:   3, w: 6, h: 4, c: '#78c34b'         },  // grass
                { dx:  -5, dy:   6, w: 5, h: 3, c: wallC             },  // wall
            ];
            ctx.globalAlpha = isActive ? 0.70 : 1;
            for (const { dx, dy, w, h, c } of patches) {
                ctx.fillStyle = c;
                ctx.fillRect(cx + dx, cy + dy, w, h);
            }
            ctx.globalAlpha = 1;
            // Tiny stars / dots to suggest "random"
            ctx.fillStyle = isActive ? '#ffffff' : '#8888aa';
            for (const [dx, dy] of [[-3, -2], [4, -10], [-8, 8]]) {
                ctx.beginPath(); ctx.arc(cx + dx, cy + dy, 1.5, 0, Math.PI * 2); ctx.fill();
            }
        }
        ctx.restore();
    }

    function _glowCircle(cx, cy, r, color) {
        const hex2rgb = h => [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
        const [R,G,B] = hex2rgb(color);
        ctx.fillStyle = `rgba(${R},${G},${B},0.25)`;
        ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    }

    // ── Panel ──────────────────────────────────────────────────────────────────

    function _drawPanel(idx) {
        const px = PANEL_XS[idx];
        const py = TOOLBAR_H;

        // Panel bg — clay card shadow, full height (grid is clipped inside)
        _roundRect(px, py, PANEL_W, METRICS_Y - py, 12, C_PANEL_BG, C_BORDER,
                   CLAY_SHADOW, 4);

        // Algo label — Crimson Pro heading
        ctx.font = '700 14px "Crimson Pro", Georgia, serif';
        ctx.fillStyle    = ALGO_COLORS[idx];
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(ALGO_NAMES[idx], px + 10, py + 5);

        // Grid cells
        _drawGrid(idx, px + 10, GRID_Y);

        // Panel footer metrics
        _drawPanelFooter(idx, px);
    }

    function _drawGrid(idx, x0, y0) {
        const state = states[idx];
        const pathSet = new Set(state?.found ? state.path : []);

        // Clip so grid stops 6px above panel bottom — reveals white background as bottom border
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, y0, GRID_PX, METRICS_Y - y0 - 6);
        ctx.clip();

        for (let r = 0; r < GRID_N; r++) {
            for (let c = 0; c < GRID_N; c++) {
                const key = pk(r, c);
                const x   = x0 + c * CELL;
                const y   = y0 + r * CELL;

                // Cell color
                let color;
                if (key === grid.start)    color = C_START;
                else if (key === grid.goal) color = C_GOAL;
                else if (state === null)    color = grid.baseColor(r, c);
                else                        color = _cellColor(state, key, grid.baseColor(r, c), pathSet);

                ctx.fillStyle = color;
                ctx.fillRect(x, y, CELL, CELL);
                ctx.strokeStyle = C_GRID_LINE; ctx.lineWidth = 0.5;
                ctx.strokeRect(x, y, CELL, CELL);

                // Predicted path overlay (pink inner square)
                if (predictedPath.includes(key) && key !== grid.start && key !== grid.goal) {
                    ctx.fillStyle = 'rgba(255,105,180,0.75)';
                    ctx.fillRect(x + 3, y + 3, CELL - 6, CELL - 6);
                }

                // f(n) value overlay
                if (showVals && state && state.expanded.has(key)
                        && key !== grid.start && key !== grid.goal) {
                    const fv = state.fVals.get(key);
                    if (fv !== undefined && fv !== Infinity) {
                        ctx.font = '7px monospace'; ctx.fillStyle = 'rgba(220,235,255,0.9)';
                        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
                        ctx.fillText(fv < 1000 ? fv.toFixed(0) : Math.round(fv),
                                     x + 1, y + CELL - 1);
                    }
                }

                // S / G labels
                if (key === grid.start || key === grid.goal) {
                    ctx.font = 'bold 9px Arial'; ctx.fillStyle = '#fff';
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(key === grid.start ? 'S' : 'G',
                                 x + CELL / 2, y + CELL / 2);
                }
            }
        }
        ctx.restore(); // end clip
    }

    function _cellColor(state, key, base, pathSet) {
        if (pathSet.has(key)) {
            const pulse = (Math.sin(globalTime * PULSE_SPEED) + 1) / 2;
            const lerp = (a, b) => Math.round(a + (b - a) * pulse);
            const [pr, pg, pb] = [0x94, 0x00, 0xd3];
            const [gr, gg, gb] = [0xdc, 0x50, 0xff];
            return `rgb(${lerp(pr,gr)},${lerp(pg,gg)},${lerp(pb,gb)})`;
        }
        if (key === state.current)       return C_CURRENT;
        if (state.expanded.has(key))     return C_CLOSED;
        if (state.openSet.has(key))      return C_OPEN;
        return base;
    }

    // ── Panel footer ───────────────────────────────────────────────────────────

    function _drawPanelFooter(idx, px) {
        const state = states[idx];
        const fy    = METRICS_Y + 2;

        ctx.font = '11px "Atkinson Hyperlegible", monospace';
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';

        if (!state) {
            ctx.fillStyle = C_DIM;
            ctx.fillText('Press R to run', px + 10, fy + 6);
            return;
        }

        const lines = [`Expanded: ${state.nodesExpanded}`];
        if (state.done) {
            if (state.found) {
                lines.push(`Cost: ${state.pathCost.toFixed(2)}  len: ${state.path.length}`);
                lines.push(`Time: ${state.runtimeMs.toFixed(2)} ms`);
                lines.push('✓ Found');
            } else {
                lines.push('✗ No path');
                lines.push(`Time: ${state.runtimeMs.toFixed(2)} ms`);
            }
        } else {
            lines.push('Searching…');
        }

        lines.forEach((ln, i) => {
            ctx.fillStyle = i === 0 ? C_TEXT : C_DIM;
            ctx.fillText(ln, px + 10, fy + i * 14);
        });
    }

    // ── Bottom metrics comparison table ────────────────────────────────────────

    function _drawMetrics() {
        ctx.fillStyle = C_METRICS;
        ctx.fillRect(0, METRICS_Y, 1100, METRICS_H);
        _hline(0, METRICS_Y, 1100, C_BORDER);

        // Only show table when at least one algo is done
        if (!states.some(s => s?.done)) {
            ctx.font = '12px "Atkinson Hyperlegible", Arial';
            ctx.fillStyle = C_DIM;
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText('Run the algorithms to see a comparison here.',
                         20, METRICS_Y + METRICS_H / 2);
            return;
        }

        const headers = ['Algorithm', 'Expanded', 'Path Cost', 'Path Len', 'Runtime (ms)'];
        const colW    = [190, 110, 100, 90, 120];
        let tx = 20, ty = METRICS_Y + 5;

        ctx.font = '700 12px "Crimson Pro", Georgia, serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        for (let i = 0; i < headers.length; i++) {
            ctx.fillStyle = C_ACCENT;
            ctx.fillText(headers[i], tx, ty);
            tx += colW[i];
        }

        for (let ri = 0; ri < 3; ri++) {
            const s = states[ri];
            if (!s) continue;
            ty += 16; tx = 20;
            const row = [
                ALGO_NAMES[ri],
                s.nodesExpanded > 0 ? String(s.nodesExpanded) : '—',
                s.found ? s.pathCost.toFixed(2) : 'N/A',
                s.found ? String(s.path.length)  : '—',
                s.done  ? s.runtimeMs.toFixed(3) : '…',
            ];
            row.forEach((val, i) => {
                ctx.fillStyle = i === 0 ? ALGO_COLORS[ri] : C_TEXT;
                ctx.font = i === 0
                    ? '700 12px "Crimson Pro", Georgia, serif'
                    : '12px "Atkinson Hyperlegible", monospace';
                ctx.fillText(val, tx, ty);
                tx += colW[i];
            });
        }
    }

    // ── Legend ─────────────────────────────────────────────────────────────────

    function _drawLegend() {
        ctx.fillStyle = C_LEGEND_BG;
        ctx.fillRect(0, LEGEND_Y, 1100, 720 - LEGEND_Y);
        _hline(0, LEGEND_Y, 1100, C_BORDER);
        ctx.strokeStyle = C_BORDER;

        const items = [
            [C_START,                      'Start'],
            [C_GOAL,                       'Goal'],
            [C_OPEN,                       'Open set'],
            [C_CLOSED,                     'Expanded'],
            [C_CURRENT,                    'Current'],
            [C_PATH,                       'Optimal path'],
            [TERRAIN_COLOR.grass,          'Grass (cost 2)'],
            [TERRAIN_COLOR.swamp,          'Swamp (cost 5)'],
            [TERRAIN_COLOR.wall,           'Wall (blocked)'],
        ];

        let lx = 14, ly = LEGEND_Y + 8;
        ctx.textBaseline = 'top';
        ctx.font = '11px "Atkinson Hyperlegible", Arial';
        for (const [color, label] of items) {
            ctx.fillStyle = color;
            ctx.fillRect(lx, ly, 12, 12);
            ctx.strokeStyle = C_BORDER; ctx.lineWidth = 0.5;
            ctx.strokeRect(lx, ly, 12, 12);
            ctx.fillStyle = C_DIM; ctx.textAlign = 'left';
            ctx.fillText(label, lx + 15, ly);
            lx += 15 + ctx.measureText(label).width + 14;
        }

        // Key hints
        ctx.fillStyle = C_DIM;
        ctx.font = '11px "Atkinson Hyperlegible", Arial';
        ctx.textAlign = 'left';
        ctx.fillText(
            'R: Run    Space: Play/Pause    →: Step    C: Clear    H: Toggle f(n)    ESC: Main Menu    Right-click: Erase',
            14, LEGEND_Y + 28
        );

        // Current speed status
        const spd = SPEEDS[speedIdx][0];
        const statusParts = ALGO_NAMES.map((n, i) =>
            `${n}: ${states[i] ? states[i].nodesExpanded : 0} exp.`
        ).join('  |  ');
        ctx.fillText(`Speed: ${spd}    ${statusParts}`, 14, LEGEND_Y + 46);
    }

    // ── Draw helpers ───────────────────────────────────────────────────────────

    function _roundRect(x, y, w, h, r, fill, stroke, shadowColor, shadowSize) {
        ctx.save();
        if (shadowColor) {
            ctx.shadowColor   = shadowColor;
            ctx.shadowOffsetX = shadowSize ?? 3;
            ctx.shadowOffsetY = shadowSize ?? 3;
            ctx.shadowBlur    = (shadowSize ?? 3) * 3;
        }
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        // Reset shadow before stroke so border is crisp
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
        ctx.restore();
    }

    function _rect(x, y, w, h, fill) {
        ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
    }

    function _hline(x1, y, x2, color) {
        ctx.strokeStyle = color; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
    }

    function _hit(btn, x, y) {
        return x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h;
    }

    return {
        enter, update, draw,
        handleKey, handleMouseMove,
        handleClick, handleMouseDown, handleMouseUp, handleRightClick,
    };
}
