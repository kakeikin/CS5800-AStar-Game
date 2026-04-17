/**
 * layer4State.js — Layer 4: The Hunt
 * Real-time: two A* monsters chase the player across a fully-visible maze.
 * Player starts top-left (0,0), monsters at top-right (9,0), exit at centre (5,5).
 * Mirrors src/states/layer4_state.py
 */

import { posKey, keyToPos }                            from '../utils.js';
import { GRID_COLS, GRID_ROWS, HEX_NBR_EVEN, HEX_NBR_ODD } from '../config.js';
import { generateSquareMaze }                           from '../maze/generator.js';
import { generateHexMaze }                              from '../maze/generator.js';
import { SquareGrid }                                   from '../maze/squareGrid.js';
import { HexGrid }                                      from '../maze/hexGrid.js';
import { AStarManhattan }                               from '../algorithms/astar.js';
import {
    SCREEN_HEIGHT, MAZE_AREA_WIDTH,
    SIDEBAR_X, SIDEBAR_WIDTH, C,
    drawSquareMaze, drawHexMaze, drawSidebarBase,
    drawText, drawRoundRect, drawStatBlock,
} from '../renderer.js';

// ── Fixed positions ───────────────────────────────────────────────────────────
const PLAYER_START_K = posKey(0, 0);
const MON_START_K    = posKey(GRID_COLS - 1, 0);
const EXIT_K         = posKey(Math.floor(GRID_COLS / 2), Math.floor(GRID_ROWS / 2));

const MONSTER_INTERVAL = 0.40;   // seconds between each monster step

const MON_COLORS = ['#b43cdc', '#dc643c'];   // purple, orange
const MON_NAMES  = ['A* Hunter 1', 'A* Hunter 2'];

// ── Key mappings ──────────────────────────────────────────────────────────────
const SQ_MOVE_KEYS = {
    ArrowUp:[0,-1], ArrowDown:[0,1], ArrowLeft:[-1,0], ArrowRight:[1,0],
    w:[0,-1], s:[0,1], a:[-1,0], d:[1,0],
};

// Hex direction indices: 0=NE 1=E 2=SE 3=SW 4=W 5=NW
const HEX_KEY_DIR = { i:0, k:1, m:2, n:3, h:4, u:5 };

// ── Entity factories ──────────────────────────────────────────────────────────

function makePlayer(startK) {
    return {
        posK:      startK,
        steps:     0,
        startTime: performance.now(),
        move(k)  { this.posK = k; this.steps++; },
        get elapsed() { return (performance.now() - this.startTime) / 1000; },
    };
}

function makeMonster(startK, color, name) {
    return {
        posK:  startK,
        color, name,
        path:    [],
        pathIdx: 0,
        steps:   0,

        computePath(grid, targetK) {
            const { path } = new AStarManhattan().findPath(grid, this.posK, targetK);
            this.path    = path;
            this.pathIdx = 0;
        },

        advance() {
            if (this.pathIdx + 1 >= this.path.length) return;
            this.pathIdx++;
            this.posK = this.path[this.pathIdx];
            this.steps++;
        },
    };
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createLayer4State(ctx, goTo, gameData) {
    let phase;          // 'choose' | 'game'
    let gridType;       // 'square' | 'hex'
    let grid, player, monsters, revealed, timers, result;
    let anim = 0;
    let mouseX = 0, mouseY = 0;
    let chooseBtnRects = [];   // [{x,y,w,h,key}, ...]
    let resultBtnRect  = null;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    function enter() {
        phase  = 'choose';
        anim   = 0;
        result = null;
        chooseBtnRects = [];
        resultBtnRect  = null;
    }

    function _startGame(type) {
        gridType = type;
        const seed = Math.floor(Math.random() * 10000);

        if (type === 'square') {
            const passages = generateSquareMaze(GRID_COLS, GRID_ROWS, seed);
            grid = new SquareGrid(passages);
        } else {
            const passages = generateHexMaze(GRID_COLS, GRID_ROWS, seed);
            grid = new HexGrid(passages);
        }

        player   = makePlayer(PLAYER_START_K);
        monsters = MON_COLORS.map((col, i) => makeMonster(MON_START_K, col, MON_NAMES[i]));
        timers   = [0, 0];
        result   = null;
        chooseBtnRects = [];
        resultBtnRect  = null;

        // No fog — reveal every cell immediately
        revealed = new Set(grid.passages.keys());

        phase = 'game';

        // Pre-compute initial paths toward player
        for (const m of monsters) m.computePath(grid, player.posK);
    }

    // ── Input ─────────────────────────────────────────────────────────────────

    function handleKey(key) {
        if (key === 'Escape') {
            if (phase === 'game') { phase = 'choose'; return; }
            goTo('MENU'); return;
        }

        if (phase === 'choose') {
            if (key === 's' || key === 'S') { _startGame('square'); return; }
            if (key === 'h' || key === 'H') { _startGame('hex');    return; }
            return;
        }

        if (phase === 'game' && result) {
            if (key === 'Enter' || key === ' ') { goTo('MENU'); }
            return;
        }

        if (phase === 'game' && !result) {
            if (gridType === 'square') {
                const delta = SQ_MOVE_KEYS[key];
                if (!delta) return;
                const [c, r] = keyToPos(player.posK);
                const newK   = posKey(c + delta[0], r + delta[1]);
                _playerMove(newK);
            } else {
                const dir = HEX_KEY_DIR[key];
                if (dir === undefined) return;
                const [c, r]   = keyToPos(player.posK);
                const nbrs     = (r % 2 === 0) ? HEX_NBR_EVEN : HEX_NBR_ODD;
                const [dc, dr] = nbrs[dir];
                const newK     = posKey(c + dc, r + dr);
                _playerMove(newK);
            }
        }
    }

    function _playerMove(newK) {
        if (!grid.isPassage(player.posK, newK)) return;
        player.move(newK);

        if (newK === EXIT_K) {
            result = 'escaped';
            if (!gameData.completedLevels.includes('MAZE_L4'))
                gameData.completedLevels.push('MAZE_L4');
            return;
        }

        for (const m of monsters) {
            if (m.posK === newK) { result = 'caught'; return; }
        }
    }

    function handleMouseMove(x, y) { mouseX = x; mouseY = y; }

    function handleClick(x, y) {
        if (phase === 'choose') {
            for (const btn of chooseBtnRects) {
                if (_hit(btn, x, y)) { _startGame(btn.key); return; }
            }
        }
        if (phase === 'game' && result && resultBtnRect && _hit(resultBtnRect, x, y)) {
            goTo('MENU');
        }
    }

    // ── Update (real-time monsters) ───────────────────────────────────────────

    function update(dt) {
        anim += dt;
        if (phase !== 'game' || result) return;

        for (let i = 0; i < monsters.length; i++) {
            timers[i] += dt;
            if (timers[i] >= MONSTER_INTERVAL) {
                timers[i] = 0;
                const m = monsters[i];
                m.computePath(grid, player.posK);   // live re-target
                m.advance();
                if (m.posK === player.posK) { result = 'caught'; return; }
            }
        }
    }

    // ── Draw ──────────────────────────────────────────────────────────────────

    function draw() {
        if (phase === 'choose') {
            _drawChoose(); return;
        }

        // Draw maze — all cells revealed, no fog
        const monOpts = { monsters: monsters.map(m => ({ posK: m.posK, color: m.color })) };
        if (gridType === 'square') {
            drawSquareMaze(ctx, grid.passages, revealed, player.posK,
                           PLAYER_START_K, EXIT_K, monOpts);
        } else {
            drawHexMaze(ctx, grid.passages, revealed, player.posK,
                        PLAYER_START_K, EXIT_K, monOpts);
        }

        _drawSidebar();
        if (result) _drawResultOverlay();
    }

    // ── Choose screen ─────────────────────────────────────────────────────────

    function _drawChoose() {
        // Background
        ctx.fillStyle = C.uiBg;
        ctx.fillRect(0, 0, MAZE_AREA_WIDTH, SCREEN_HEIGHT);

        const cx = MAZE_AREA_WIDTH / 2;

        // Title
        drawText(ctx, 'Layer 4 – The Hunt', cx, 50,
                 { size: 28, bold: true, color: '#ff963c', align: 'center' });
        drawText(ctx, 'Two A* monsters hunt you in real-time.', cx, 92,
                 { size: 15, color: C.uiText, align: 'center' });
        drawText(ctx, 'Full maze visible — no fog!', cx, 114,
                 { size: 14, color: '#50c8ff', align: 'center' });
        drawText(ctx, `Player: (0,0) top-left  ·  Exit: (${Math.floor(GRID_COLS/2)},${Math.floor(GRID_ROWS/2)}) center  ·  Monsters: (${GRID_COLS-1},0) top-right`,
                 cx, 136, { size: 12, color: C.uiSubtext, align: 'center' });

        // Grid type buttons
        const btnData = [
            { key: 'square', label: 'Square Grid', sublabel: '[S] to select', color: C.astarMan },
            { key: 'hex',    label: 'Hex Grid',    sublabel: '[H] to select', color: '#50ff96' },
        ];

        const bw = 220, bh = 110, gap = 50;
        const totalW = bw * 2 + gap;
        const bx0 = (MAZE_AREA_WIDTH - totalW) / 2;
        const by  = 168;

        chooseBtnRects = [];
        for (let i = 0; i < btnData.length; i++) {
            const { key, label, sublabel, color } = btnData[i];
            const bx  = bx0 + i * (bw + gap);
            const btn = { x: bx, y: by, w: bw, h: bh, key };
            chooseBtnRects.push(btn);

            const hov = _hit(btn, mouseX, mouseY);
            drawRoundRect(ctx, bx, by, bw, bh, 10,
                          { fill: hov ? '#1e1e36' : C.uiPanel, stroke: color, lineWidth: 2 });
            drawText(ctx, label,    bx + bw/2, by + 28, { size: 18, bold: true, color, align: 'center' });
            drawText(ctx, sublabel, bx + bw/2, by + 60, { size: 13, color: C.uiSubtext, align: 'center' });
        }

        // Info block
        const infoY = by + bh + 28;
        const infoLines = [
            { text: `Player spawns at (0,0) — top-left corner`,            color: C.uiSuccess },
            { text: `Exit at (${Math.floor(GRID_COLS/2)},${Math.floor(GRID_ROWS/2)}) — maze center`,  color: '#e05050' },
            { text: `Two monsters spawn at (${GRID_COLS-1},0) — top-right`, color: MON_COLORS[0] },
            { text: 'Monsters recompute A* path to YOU every 0.4s',         color: C.uiSubtext },
            { text: 'Reach the exit before being caught!',                   color: C.uiText },
        ];
        let iy = infoY;
        for (const { text, color } of infoLines) {
            drawText(ctx, text, cx, iy, { size: 13, color, align: 'center' });
            iy += 24;
        }

        // Square controls hint
        drawText(ctx, 'Square: Arrow keys / WASD   ·   Hex: I U K H M N', cx, iy + 14,
                 { size: 12, color: C.uiSubtext, align: 'center' });

        // Sidebar
        _drawChooseSidebar();
    }

    function _drawChooseSidebar() {
        drawSidebarBase(ctx);
        const sx = SIDEBAR_X + 10, sw = SIDEBAR_WIDTH - 20;
        let y = 14;

        ctx.font = 'bold 20px Arial'; ctx.fillStyle = C.uiHeading;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText('Layer 4 – The Hunt', SIDEBAR_X + SIDEBAR_WIDTH / 2, y); y += 32;

        _ln(sx, y, sx + sw, y); y += 12;

        drawText(ctx, 'Choose a grid type to begin.', sx + sw/2, y,
                 { size: 13, color: C.uiSubtext, align: 'center' }); y += 32;

        _ln(sx, y, sx + sw, y); y += 12;

        const rules = [
            'Two A* hunters chase you live.',
            'Full maze visible — no fog.',
            'Reach center exit to escape.',
            "Don't step on a monster!",
            '[S] Square   [H] Hex',
            'ESC → Main Menu',
        ];
        for (const line of rules) {
            drawText(ctx, line, sx, y, { size: 12, color: C.uiSubtext }); y += 20;
        }
    }

    // ── Race sidebar ──────────────────────────────────────────────────────────

    function _drawSidebar() {
        drawSidebarBase(ctx);
        const sx = SIDEBAR_X + 10, sw = SIDEBAR_WIDTH - 20;
        let y = 14;

        const gridLabel = gridType === 'square' ? 'Square' : 'Hex';
        ctx.font = 'bold 19px Arial'; ctx.fillStyle = C.uiHeading;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(`Layer 4 – ${gridLabel} Hunt`, SIDEBAR_X + SIDEBAR_WIDTH / 2, y); y += 28;
        _ln(sx, y, sx + sw, y); y += 10;

        // Status line
        let statusText, statusColor;
        if (result === 'escaped') {
            statusText = 'YOU ESCAPED!'; statusColor = C.uiSuccess;
        } else if (result === 'caught') {
            statusText = 'CAUGHT!'; statusColor = C.uiDanger;
        } else {
            statusText = 'RUN!'; statusColor = C.uiWarn;
        }
        drawText(ctx, statusText, sx + sw/2, y,
                 { size: 16, bold: true, color: statusColor, align: 'center' }); y += 28;
        _ln(sx, y, sx + sw, y); y += 10;

        // Player stat block
        y = drawStatBlock(ctx, sx, y, sw,
            'You  (player)', player.steps, player.elapsed, C.player) + 10;

        // Monster stat blocks
        for (const m of monsters) {
            drawRoundRect(ctx, sx, y, sw, 54, 5, { fill: C.uiPanel });
            ctx.fillStyle = m.color;
            ctx.beginPath(); ctx.roundRect(sx, y, 4, 54, 2); ctx.fill();
            drawText(ctx, m.name,         sx + 10, y + 4,  { size: 12, bold: true, color: m.color });
            drawText(ctx, `pos  (${keyToPos(m.posK).join(', ')})`, sx + 10, y + 22, { size: 12, color: C.uiText });
            drawText(ctx, `steps  ${m.steps}`,                     sx + 10, y + 38, { size: 12, color: C.uiSubtext });
            y += 58;
        }
        y += 6;

        _ln(sx, y, sx + sw, y); y += 8;

        const notes = [
            'A* hunters recompute path',
            'to your position every 0.4s.',
            'Full maze visible – no fog.',
            gridType === 'square'
                ? 'Move: Arrows / WASD'
                : 'Move: I U K H M N',
            `Exit at centre: (${Math.floor(GRID_COLS/2)},${Math.floor(GRID_ROWS/2)})`,
            'ESC → back to grid choice',
        ];
        for (const line of notes) {
            drawText(ctx, line, sx, y, { size: 12, color: C.uiSubtext }); y += 18;
        }
    }

    // ── Result overlay ────────────────────────────────────────────────────────

    function _drawResultOverlay() {
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.fillRect(0, 0, MAZE_AREA_WIDTH, SCREEN_HEIGHT);

        const pw = 540, ph = 360;
        const px = (MAZE_AREA_WIDTH - pw) / 2;
        const py = (SCREEN_HEIGHT   - ph) / 2;

        const escaped      = result === 'escaped';
        const accentColor  = escaped ? C.uiSuccess : C.uiDanger;

        drawRoundRect(ctx, px, py, pw, ph, 14,
                      { fill: '#14142a', stroke: accentColor, lineWidth: 2 });

        // Headline
        const headline = escaped ? 'YOU ESCAPED!' : 'CAUGHT!';
        drawText(ctx, headline, px + pw/2, py + 20,
                 { size: 26, bold: true, color: accentColor, align: 'center' });

        ctx.strokeStyle = C.uiBorder; ctx.lineWidth = 1;
        _ln(px + 20, py + 60, px + pw - 20, py + 60);

        let iy = py + 74;
        if (escaped) {
            const lines = [
                { text: 'You outsmarted two real-time A* hunters!', color: C.uiText },
                { text: 'Understanding A* helps you predict',        color: C.uiSubtext },
                { text: 'and evade algorithmic pursuit.',            color: C.uiSubtext },
            ];
            for (const { text, color } of lines) {
                drawText(ctx, text, px + pw/2, iy, { size: 14, color, align: 'center' }); iy += 26;
            }
            iy += 6;
            drawText(ctx, `Steps taken: ${player.steps}`, px + pw/2, iy,
                     { size: 20, bold: true, color: C.astarMan, align: 'center' }); iy += 34;
            drawText(ctx, `Time: ${player.elapsed.toFixed(1)}s`, px + pw/2, iy,
                     { size: 16, color: C.uiSubtext, align: 'center' }); iy += 30;
        } else {
            const lines = [
                { text: 'A* always finds the shortest path to you.', color: C.uiText },
                { text: 'The hunters had perfect maze knowledge.',    color: C.uiText },
            ];
            for (const { text, color } of lines) {
                drawText(ctx, text, px + pw/2, iy, { size: 14, color, align: 'center' }); iy += 26;
            }
            iy += 10;
            drawText(ctx, `You lasted ${player.steps} steps.`, px + pw/2, iy,
                     { size: 16, color: C.uiSubtext, align: 'center' }); iy += 34;
        }

        // Pedagogical insight
        _ln(px + 20, iy, px + pw - 20, iy); iy += 14;
        const insight = [
            { text: 'Why is A* so effective at chasing?', color: C.uiHeading },
            { text: 'h=|Δx|+|Δy| guides monsters directly toward you,', color: C.uiSubtext },
            { text: 'expanding far fewer nodes than Dijkstra would.', color: C.uiSubtext },
        ];
        for (const { text, color } of insight) {
            drawText(ctx, text, px + pw/2, iy, { size: 13, color, align: 'center' }); iy += 22;
        }

        iy += 6;

        // Button
        const btnW = 200, btnH = 42;
        const bx = px + (pw - btnW) / 2;
        const by = py + ph - 56;
        resultBtnRect = { x: bx, y: by, w: btnW, h: btnH };
        const hov = _hit(resultBtnRect, mouseX, mouseY);
        drawRoundRect(ctx, bx, by, btnW, btnH, 8, {
            fill: hov ? '#1e2e1e' : C.uiPanel,
            stroke: C.uiSuccess, lineWidth: 2,
        });
        drawText(ctx, '← Back to Menu', bx + btnW/2, by + btnH/2 - 9,
                 { size: 15, bold: true, color: C.uiSuccess, align: 'center' });
        drawText(ctx, 'Enter or click', bx + btnW/2, by + btnH - 16,
                 { size: 11, color: C.uiSubtext, align: 'center' });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function _ln(x1, y1, x2, y2) {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }

    return { enter, update, draw, handleKey, handleClick, handleMouseMove };
}

function _hit(r, x, y) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
