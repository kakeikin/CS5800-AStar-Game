/**
 * layer1State.js — Layer 1: The Race
 * Turn-based: player moves manually (fog), then Dijkstra monster takes one step.
 * First to reach the exit wins.
 * Mirrors src/states/layer1_state.py
 */

import { posKey, keyToPos }                       from '../utils.js';
import { GRID_COLS, GRID_ROWS, FOG_REVEAL_RADIUS } from '../config.js';
import { generateSquareMaze }                      from '../maze/generator.js';
import { SquareGrid }                              from '../maze/squareGrid.js';
import { Dijkstra }                                from '../algorithms/dijkstra.js';
import {
    SCREEN_HEIGHT, MAZE_AREA_WIDTH,
    SIDEBAR_X, SIDEBAR_WIDTH, CELL_SIZE, C,
    sqCellRect, updateFog,
    drawSquareMaze, drawSidebarBase,
    drawText, drawRoundRect, drawStatBlock,
} from '../renderer.js';

// ── Fixed positions ───────────────────────────────────────────────────────────
const START_K = posKey(0, GRID_ROWS - 1);
const END_K   = posKey(GRID_COLS - 1, 0);

const MOVE_KEYS = {
    ArrowUp: [0,-1], ArrowDown: [0,1], ArrowLeft: [-1,0], ArrowRight: [1,0],
    w:[0,-1], s:[0,1], a:[-1,0], d:[1,0],
};

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

function makeMonster(startK) {
    return {
        posK:      startK,
        color:     C.dijMon,
        name:      'Dijkstra',
        path:      [],           // posKey strings computed once
        pathIdx:   0,
        steps:     0,
        nodesExpanded: 0,        // how many nodes Dijkstra explored
        startTime: performance.now(),

        computePath(grid, endK) {
            const { path, visitedOrder } = new Dijkstra().findPath(grid, this.posK, endK);
            this.path          = path;
            this.pathIdx       = 0;
            this.nodesExpanded = visitedOrder.length;
        },

        advance() {
            if (this.pathIdx + 1 >= this.path.length) return;
            this.pathIdx++;
            this.posK = this.path[this.pathIdx];
            this.steps++;
        },

        get elapsed() { return (performance.now() - this.startTime) / 1000; },
    };
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createLayer1State(ctx, goTo, gameData) {
    let grid, player, monster, revealed;
    let playerTurn, finished, winner, showResult;
    let anim    = 0;
    let mouseX  = 0, mouseY = 0;
    let resultBtnRect = null;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    function enter() {
        const passages = generateSquareMaze(GRID_COLS, GRID_ROWS);
        grid      = new SquareGrid(passages);
        player    = makePlayer(START_K);
        monster   = makeMonster(START_K);
        revealed  = new Set();

        monster.computePath(grid, END_K);   // pre-compute full Dijkstra path

        playerTurn = true;
        finished   = false;
        winner     = null;
        showResult = false;
        anim       = 0;
        resultBtnRect = null;

        updateFog(revealed, START_K, grid.passages, FOG_REVEAL_RADIUS);
    }

    // ── Input ─────────────────────────────────────────────────────────────────

    function handleKey(key) {
        if (showResult) {
            if (key === 'Enter' || key === ' ') goTo('MAZE_L2');
            return;
        }
        if (finished || !playerTurn) return;

        const delta = MOVE_KEYS[key];
        if (!delta) return;

        const [c, r] = keyToPos(player.posK);
        const newK   = posKey(c + delta[0], r + delta[1]);
        if (!grid.isPassage(player.posK, newK)) return;

        // Player moves
        player.move(newK);
        updateFog(revealed, newK, grid.passages, FOG_REVEAL_RADIUS);

        if (newK === END_K) { _endRace('Player'); return; }

        // Monster takes one step
        playerTurn = false;
        monster.advance();

        if (monster.posK === END_K) { _endRace('Dijkstra'); return; }
        playerTurn = true;
    }

    function handleMouseMove(x, y) { mouseX = x; mouseY = y; }

    function handleClick(x, y) {
        if (showResult && resultBtnRect && _hit(resultBtnRect, x, y))
            goTo('MAZE_L2');
    }

    function _endRace(w) {
        finished   = true;
        winner     = w;
        showResult = true;
        if (!gameData.completedLevels.includes('MAZE_L1'))
            gameData.completedLevels.push('MAZE_L1');
    }

    // ── Update ────────────────────────────────────────────────────────────────

    function update(dt) { anim += dt; }

    // ── Draw ──────────────────────────────────────────────────────────────────

    function draw() {
        // 1. Maze + entities
        drawSquareMaze(ctx, grid.passages, revealed, player.posK, START_K, END_K, {
            monsters: [{ posK: monster.posK, color: monster.color }],
        });

        // 2. Monster path ghost (revealed cells only, semi-transparent)
        _drawMonsterPath();

        // 3. Sidebar
        _drawSidebar();

        // 4. Result overlay
        if (showResult) _drawResultOverlay();
    }

    // ── Monster path ghost ────────────────────────────────────────────────────

    function _drawMonsterPath() {
        // Show the monster's remaining path as faint blue dots on revealed cells
        for (let i = monster.pathIdx + 1; i < monster.path.length; i++) {
            const k = monster.path[i];
            if (!revealed.has(k) || k === END_K) continue;
            const [c, r]     = keyToPos(k);
            const { x, y, w } = sqCellRect(c, r);
            const frac        = (i - monster.pathIdx) / Math.max(monster.path.length - monster.pathIdx, 1);
            const alpha       = (0.18 - frac * 0.12).toFixed(2);
            ctx.fillStyle     = `rgba(80,120,255,${alpha})`;
            ctx.fillRect(x, y, w, w);
        }
    }

    // ── Sidebar ───────────────────────────────────────────────────────────────

    function _drawSidebar() {
        drawSidebarBase(ctx);
        const sx = SIDEBAR_X + 10, sw = SIDEBAR_WIDTH - 20;
        let y = 14;

        // Title
        ctx.font = 'bold 20px Arial'; ctx.fillStyle = C.uiHeading;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText('Layer 1 – The Race', SIDEBAR_X + SIDEBAR_WIDTH / 2, y); y += 28;
        _ln(sx, y, sx + sw, y); y += 10;

        // Turn indicator
        const turnLabel = finished
            ? (winner === 'Player' ? '🏆  You Win!' : '💀  Dijkstra Wins!')
            : playerTurn ? '▶  YOUR TURN' : '⏳  Monster moving…';
        const turnColor = finished
            ? (winner === 'Player' ? C.uiSuccess : C.dijMon)
            : playerTurn ? C.uiWarn : C.uiSubtext;
        drawText(ctx, turnLabel, sx + sw / 2, y,
                 { size: 15, bold: true, color: turnColor, align: 'center' }); y += 26;
        _ln(sx, y, sx + sw, y); y += 10;

        // Player stat block
        y = drawStatBlock(ctx, sx, y, sw,
            'You  (manual)',
            player.steps, player.elapsed, C.player) + 8;

        // Monster stat block
        y = drawStatBlock(ctx, sx, y, sw,
            'Dijkstra Monster',
            monster.steps, monster.elapsed, C.dijMon) + 12;

        // Algorithm cards
        for (const [name, formula, desc, col] of [
            ['A* Manhattan', 'h = |Δx| + |Δy|', 'Your hidden guide', C.astarMan],
            ['Dijkstra',     'h = 0 (uniform)',  'Monster AI', C.dijkstra],
        ]) {
            drawRoundRect(ctx, sx, y, sw, 58, 5, { fill: C.uiPanel });
            ctx.fillStyle = col;
            ctx.beginPath(); ctx.roundRect(sx, y, 4, 58, 2); ctx.fill();
            drawText(ctx, name,    sx + 10, y +  4, { size: 14, bold: true, color: col });
            drawText(ctx, formula, sx + 10, y + 23, { size: 12, color: C.uiHilight });
            drawText(ctx, desc,    sx + 10, y + 40, { size: 11, color: C.uiSubtext });
            y += 62;
        }
        y += 4;

        // Dijkstra nodes stat (pedagogical)
        drawRoundRect(ctx, sx, y, sw, 42, 5, { fill: C.uiPanel, stroke: C.uiBorder, lineWidth: 1 });
        drawText(ctx, 'Dijkstra expanded:',         sx+8, y+4,  { size:12, color:C.uiSubtext });
        drawText(ctx, `${monster.nodesExpanded} nodes`, sx+8, y+22, { size:14, bold:true, color:C.dijkstra });
        y += 50;

        // Instructions
        _ln(sx, y, sx + sw, y); y += 8;
        for (const line of [
            'Arrow keys / WASD to move',
            'Monster moves after you',
            'First to the RED exit wins!',
            'ESC → Main Menu',
        ]) {
            drawText(ctx, line, sx, y, { size: 12, color: C.uiSubtext }); y += 18;
        }
    }

    // ── Result overlay ────────────────────────────────────────────────────────

    function _drawResultOverlay() {
        // Dark backdrop
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.fillRect(0, 0, MAZE_AREA_WIDTH, SCREEN_HEIGHT);

        const pw = 580, ph = 400;
        const px = (MAZE_AREA_WIDTH - pw) / 2;
        const py = (SCREEN_HEIGHT   - ph) / 2;

        const winnerColor = winner === 'Player' ? C.uiSuccess : C.dijMon;

        drawRoundRect(ctx, px, py, pw, ph, 14,
                      { fill: '#14142a', stroke: winnerColor, lineWidth: 2 });

        // Headline
        const headline = winner === 'Player'
            ? '🏆  You reached the exit first!'
            : '💀  Dijkstra reached the exit first!';
        drawText(ctx, headline, px + pw/2, py + 18,
                 { size: 20, bold: true, color: winnerColor, align: 'center' });

        // Divider
        ctx.strokeStyle = C.uiBorder; ctx.lineWidth = 1;
        _ln(px + 20, py + 52, px + pw - 20, py + 52);

        // Two-column stat comparison
        const lx = px + 30, rx = px + pw/2 + 10, colW = pw/2 - 40;
        const statY = py + 62;

        // Column headers
        drawText(ctx, 'You (manual)', lx + colW/2, statY,
                 { size: 13, bold: true, color: C.player,   align: 'center' });
        drawText(ctx, 'Dijkstra AI',  rx + colW/2, statY,
                 { size: 13, bold: true, color: C.dijkstra, align: 'center' });
        _ln(px + pw/2, statY + 18, px + pw/2, statY + 110);

        // Steps row
        drawText(ctx, 'Steps', px + pw/2, statY + 22,
                 { size: 12, color: C.uiSubtext, align: 'center' });
        drawText(ctx, String(player.steps),  lx + colW/2, statY + 38,
                 { size: 30, bold: true, color: C.player,   align: 'center' });
        drawText(ctx, String(monster.steps), rx + colW/2, statY + 38,
                 { size: 30, bold: true, color: C.dijkstra, align: 'center' });

        // Time row
        drawText(ctx, 'Time', px + pw/2, statY + 76,
                 { size: 12, color: C.uiSubtext, align: 'center' });
        drawText(ctx, `${player.elapsed.toFixed(1)}s`,  lx + colW/2, statY + 90,
                 { size: 20, bold: true, color: C.player,   align: 'center' });
        drawText(ctx, `${monster.elapsed.toFixed(1)}s`, rx + colW/2, statY + 90,
                 { size: 20, bold: true, color: C.dijkstra, align: 'center' });

        // Horizontal divider
        ctx.strokeStyle = C.uiBorder;
        _ln(px+20, py+180, px+pw-20, py+180);

        // Pedagogical insight
        let iy = py + 192;
        const insightLines = [
            { text: 'Why does Dijkstra always find the optimal path?', color: C.uiHeading },
            { text: `It expanded ${monster.nodesExpanded} nodes exploring uniformly in all directions.`, color: C.uiSubtext },
            { text: 'A* Manhattan uses h=|Δx|+|Δy| to skip unpromising nodes,', color: C.uiSubtext },
            { text: 'reaching the goal with far fewer expansions.', color: C.uiSubtext },
        ];
        for (const { text, color } of insightLines) {
            drawText(ctx, text, px + pw/2, iy,
                     { size: 13, color, align: 'center' }); iy += 22;
        }

        // "Next Level" button
        const btnW = 200, btnH = 42;
        const bx = px + (pw - btnW) / 2;
        const by = py + ph - 60;
        resultBtnRect = { x: bx, y: by, w: btnW, h: btnH };
        const hov = _hit(resultBtnRect, mouseX, mouseY);
        drawRoundRect(ctx, bx, by, btnW, btnH, 8, {
            fill: hov ? '#1e2e1e' : C.uiPanel,
            stroke: C.uiSuccess, lineWidth: 2,
        });
        drawText(ctx, 'Next Level →', bx + btnW/2, by + btnH/2 - 9,
                 { size: 16, bold: true, color: C.uiSuccess, align: 'center' });
        drawText(ctx, 'Enter or click', bx + btnW/2, by + btnH - 18,
                 { size: 11, color: C.uiSubtext, align: 'center' });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function _ln(x1, y1, x2, y2) {
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    }

    return { enter, update, draw, handleKey, handleClick, handleMouseMove };
}

function _hit(r, x, y) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
