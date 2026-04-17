/**
 * layer2State.js — Layer 2: Weighted Reward
 * Turn-based race with a gold gem granting -10 step bonus.
 * Player's guide path routes via the reward; Dijkstra monster ignores it.
 * Mirrors src/states/layer2_state.py
 */

import { posKey, keyToPos }                       from '../utils.js';
import { GRID_COLS, GRID_ROWS, FOG_REVEAL_RADIUS } from '../config.js';
import { generateSquareMaze }                      from '../maze/generator.js';
import { SquareGrid }                              from '../maze/squareGrid.js';
import { AStarManhattan }                          from '../algorithms/astar.js';
import { Dijkstra }                                from '../algorithms/dijkstra.js';
import {
    SCREEN_HEIGHT, MAZE_AREA_WIDTH, SIDEBAR_X, SIDEBAR_WIDTH, CELL_SIZE, C,
    sqCellRect, updateFog,
    drawSquareMaze, drawSidebarBase,
    drawText, drawRoundRect, drawStatBlock,
} from '../renderer.js';

// ── Fixed positions ───────────────────────────────────────────────────────────
const START_K     = posKey(0, GRID_ROWS - 1);
const END_K       = posKey(GRID_COLS - 1, 0);
const REWARD_BONUS = -10;

const MOVE_KEYS = {
    ArrowUp:[0,-1], ArrowDown:[0,1], ArrowLeft:[-1,0], ArrowRight:[1,0],
    w:[0,-1], s:[0,1], a:[-1,0], d:[1,0],
};

// ── Entity factories ──────────────────────────────────────────────────────────

function makePlayer(startK) {
    return {
        posK:      startK,
        steps:     0,
        startTime: performance.now(),
        move(k)       { this.posK = k; this.steps++; },
        addBonus(n)   { this.steps = Math.max(0, this.steps + n); },
        get elapsed() { return (performance.now() - this.startTime) / 1000; },
    };
}

function makeMonster(startK) {
    return {
        posK:          startK,
        color:         C.dijMon,
        name:          'Dijkstra',
        path:          [],
        pathIdx:       0,
        steps:         0,
        nodesExpanded: 0,
        startTime:     performance.now(),

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

export function createLayer2State(ctx, goTo, gameData) {
    let grid, player, monster, revealed;
    let rewardPosK, rewardCollected;
    let guidePath = [];
    let playerTurn, finished, winner, showResult;
    let anim = 0, mouseX = 0, mouseY = 0;
    let resultBtnRect = null;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    function enter() {
        const passages = generateSquareMaze(GRID_COLS, GRID_ROWS);
        grid     = new SquareGrid(passages);
        player   = makePlayer(START_K);
        monster  = makeMonster(START_K);
        revealed = new Set();

        monster.computePath(grid, END_K);

        rewardPosK      = _placeReward();
        rewardCollected = false;
        guidePath       = [];

        playerTurn    = true;
        finished      = false;
        winner        = null;
        showResult    = false;
        anim          = 0;
        resultBtnRect = null;

        updateFog(revealed, START_K, grid.passages, FOG_REVEAL_RADIUS);
        _computeGuidePath();
    }

    // ── Reward placement ──────────────────────────────────────────────────────

    function _placeReward() {
        // Optimal path set (A* start → end)
        const { path: optPath } = new AStarManhattan().findPath(grid, START_K, END_K);
        const optSet = new Set(optPath);

        // BFS distances from start
        const bfsDist = grid.bfsDistance(START_K);

        // Prefer cells exactly 4 steps away that are off the optimal path
        let candidates = [];
        for (const [k, d] of bfsDist) {
            if (d === 4 && !optSet.has(k) && k !== START_K && k !== END_K)
                candidates.push(k);
        }
        if (candidates.length) return candidates[Math.floor(Math.random() * candidates.length)];

        // Fallback: 2-6 steps off-path
        for (const [k, d] of bfsDist) {
            if (d >= 2 && d <= 6 && !optSet.has(k) && k !== START_K && k !== END_K)
                candidates.push(k);
        }
        if (candidates.length) return candidates[Math.floor(Math.random() * candidates.length)];

        // Last resort: any cell except start/end
        for (const k of grid.passages.keys()) {
            if (k !== START_K && k !== END_K) return k;
        }
        return START_K; // should never reach here
    }

    // ── Guide path computation ─────────────────────────────────────────────────

    function _computeGuidePath() {
        const astar = new AStarManhattan();
        let full = [];

        if (!rewardCollected) {
            // Route: player → reward → end
            const { path: p1 } = astar.findPath(grid, player.posK, rewardPosK);
            const { path: p2 } = astar.findPath(grid, rewardPosK, END_K);
            if (p1.length > 0 && p2.length > 0) {
                full = [...p1, ...p2.slice(1)];
            }
        } else {
            // Direct: player → end
            const { path } = astar.findPath(grid, player.posK, END_K);
            full = path;
        }

        // Store next 3 steps (skip player's current pos)
        guidePath = full.slice(1, 4);
    }

    // ── Input ─────────────────────────────────────────────────────────────────

    function handleKey(key) {
        if (showResult) {
            if (key === 'Enter' || key === ' ') _advance(); return;
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

        // Reward collection
        if (newK === rewardPosK && !rewardCollected) {
            rewardCollected = true;
            player.addBonus(REWARD_BONUS);   // -10 steps
            _computeGuidePath();
        }

        if (newK === END_K) { _endRace('Player'); return; }

        // Monster step
        playerTurn = false;
        monster.advance();
        if (monster.posK === END_K) { _endRace('Dijkstra'); return; }

        _computeGuidePath();
        playerTurn = true;
    }

    function handleMouseMove(x, y) { mouseX = x; mouseY = y; }

    function handleClick(x, y) {
        if (showResult && resultBtnRect && _hit(resultBtnRect, x, y)) _advance();
    }

    function _advance() {
        if (!gameData.tomes.includes('euclidean'))
            gameData.tomes.push('euclidean');
        goTo('MAZE_L3');
    }

    function _endRace(w) {
        finished   = true;
        winner     = w;
        showResult = true;
        if (!gameData.completedLevels.includes('MAZE_L2'))
            gameData.completedLevels.push('MAZE_L2');
    }

    // ── Update ────────────────────────────────────────────────────────────────

    function update(dt) { anim += dt; }

    // ── Draw ──────────────────────────────────────────────────────────────────

    function draw() {
        drawSquareMaze(ctx, grid.passages, revealed, player.posK, START_K, END_K, {
            monsters:    [{ posK: monster.posK, color: monster.color }],
            rewardPosK:  rewardCollected ? null : rewardPosK,
        });
        _drawGuidePath();
        _drawSidebar();
        if (showResult) _drawResultOverlay();
    }

    // ── Guide path highlight ──────────────────────────────────────────────────

    function _drawGuidePath() {
        const pulse = 0.5 + 0.5 * Math.sin(anim * 2.8);
        for (const k of guidePath) {
            if (k === END_K || k === START_K || k === rewardPosK) continue;
            if (!revealed.has(k)) continue;
            const [c, r]      = keyToPos(k);
            const { x, y, w } = sqCellRect(c, r);
            const cx = x + w/2, cy = y + w/2;

            // Soft gold fill
            ctx.fillStyle = `rgba(255,220,30,${(0.22 + 0.10 * pulse).toFixed(2)})`;
            ctx.fillRect(x, y, w, w);

            // Pulsing ring
            ctx.strokeStyle = `rgba(255,240,80,${(0.50 + 0.30 * pulse).toFixed(2)})`;
            ctx.lineWidth   = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, w * 0.30 + 3 * pulse, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // ── Sidebar ───────────────────────────────────────────────────────────────

    function _drawSidebar() {
        drawSidebarBase(ctx);
        const sx = SIDEBAR_X + 10, sw = SIDEBAR_WIDTH - 20;
        let y = 14;

        // Title
        ctx.font = 'bold 19px Arial'; ctx.fillStyle = C.uiHeading;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText('Layer 2 – Weighted Reward', SIDEBAR_X + SIDEBAR_WIDTH / 2, y); y += 28;
        _ln(sx, y, sx + sw, y); y += 10;

        // Turn indicator
        const turnLabel = finished
            ? (winner === 'Player' ? '🏆  You Win!' : '💀  Dijkstra Wins!')
            : playerTurn ? '▶  YOUR TURN' : '⏳  Monster moving…';
        const turnColor = finished
            ? (winner === 'Player' ? C.uiSuccess : C.dijMon)
            : playerTurn ? C.uiWarn : C.uiSubtext;
        drawText(ctx, turnLabel, sx + sw/2, y,
                 { size:14, bold:true, color:turnColor, align:'center' }); y += 26;
        _ln(sx, y, sx + sw, y); y += 10;

        // Reward status
        const rewardLine = rewardCollected
            ? '✓  Reward collected!  −10 steps'
            : '◎  Gold gem = −10 steps bonus';
        drawText(ctx, rewardLine, sx, y,
                 { size:13, color: rewardCollected ? C.uiSuccess : C.reward }); y += 22;

        // Stat blocks
        y = drawStatBlock(ctx, sx, y, sw, 'You  (A* guided)', player.steps, player.elapsed, C.player) + 8;
        y = drawStatBlock(ctx, sx, y, sw, 'Dijkstra Monster', monster.steps, monster.elapsed, C.dijMon) + 12;

        // Algorithm cards
        for (const [name, formula, desc, col] of [
            ['A* + Reward', 'g(n) includes −10 bonus', 'Your guide routes via gem', C.reward],
            ['Dijkstra',    'h = 0, ignores weights',  'Monster: direct to exit',  C.dijkstra],
        ]) {
            drawRoundRect(ctx, sx, y, sw, 58, 5, { fill: C.uiPanel });
            ctx.fillStyle = col;
            ctx.beginPath(); ctx.roundRect(sx, y, 4, 58, 2); ctx.fill();
            drawText(ctx, name,    sx+10, y+ 4, { size:14, bold:true, color:col });
            drawText(ctx, formula, sx+10, y+23, { size:12, color:C.uiHilight });
            drawText(ctx, desc,    sx+10, y+41, { size:11, color:C.uiSubtext });
            y += 62;
        }
        y += 4;

        // Instructions
        _ln(sx, y, sx + sw, y); y += 8;
        for (const line of [
            'Arrow keys / WASD to move',
            'Follow the gold highlights',
            'Collect gem before exit!',
            'ESC → Main Menu',
        ]) {
            drawText(ctx, line, sx, y, { size:12, color:C.uiSubtext }); y += 18;
        }
    }

    // ── Result overlay ────────────────────────────────────────────────────────

    function _drawResultOverlay() {
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.fillRect(0, 0, MAZE_AREA_WIDTH, SCREEN_HEIGHT);

        const pw = 580, ph = 430;
        const px = (MAZE_AREA_WIDTH - pw) / 2;
        const py = (SCREEN_HEIGHT   - ph) / 2;
        const winColor = winner === 'Player' ? C.uiSuccess : C.dijMon;

        drawRoundRect(ctx, px, py, pw, ph, 14,
                      { fill: '#14142a', stroke: winColor, lineWidth: 2 });

        // Headline
        const headline = winner === 'Player'
            ? '🏆  You reached the exit first!'
            : '💀  Dijkstra reached the exit first!';
        drawText(ctx, headline, px + pw/2, py + 18,
                 { size:19, bold:true, color:winColor, align:'center' });

        ctx.strokeStyle = C.uiBorder; ctx.lineWidth = 1;
        _ln(px+20, py+52, px+pw-20, py+52);

        // Two-column stats
        const lx = px+30, rx = px+pw/2+10, colW = pw/2-40, statY = py+62;
        drawText(ctx, 'You (guided)',  lx+colW/2, statY, { size:13, bold:true, color:C.player,   align:'center' });
        drawText(ctx, 'Dijkstra AI',  rx+colW/2, statY, { size:13, bold:true, color:C.dijkstra, align:'center' });
        _ln(px+pw/2, statY+18, px+pw/2, statY+110);

        drawText(ctx, 'Steps', px+pw/2, statY+22, { size:12, color:C.uiSubtext, align:'center' });
        drawText(ctx, String(player.steps),  lx+colW/2, statY+38, { size:30, bold:true, color:C.player,   align:'center' });
        drawText(ctx, String(monster.steps), rx+colW/2, statY+38, { size:30, bold:true, color:C.dijkstra, align:'center' });

        drawText(ctx, 'Time', px+pw/2, statY+76, { size:12, color:C.uiSubtext, align:'center' });
        drawText(ctx, `${player.elapsed.toFixed(1)}s`,  lx+colW/2, statY+90, { size:20, bold:true, color:C.player,   align:'center' });
        drawText(ctx, `${monster.elapsed.toFixed(1)}s`, rx+colW/2, statY+90, { size:20, bold:true, color:C.dijkstra, align:'center' });

        _ln(px+20, py+184, px+pw-20, py+184);

        // Reward outcome
        const rewardMsg = rewardCollected
            ? `You collected the −10 bonus!  Net steps: ${player.steps}`
            : 'You missed the reward gem — no bonus applied';
        drawText(ctx, rewardMsg, px+pw/2, py+196,
                 { size:13, bold:true, color: rewardCollected ? C.uiSuccess : C.uiWarn, align:'center' });

        // Pedagogical insight
        let iy = py + 222;
        for (const [text, color] of [
            ['Why does A* route via the gem?',                     C.uiHeading],
            ['Weighted edges change g(n) — A* picks the path',     C.uiSubtext],
            ['with lowest total cost, even if it\'s longer.',       C.uiSubtext],
            ['Dijkstra has no cost preference — it ignores bonus cells.', C.uiSubtext],
        ]) {
            drawText(ctx, text, px+pw/2, iy, { size:12, color, align:'center' }); iy += 20;
        }

        // Unlock badge
        iy += 4;
        drawRoundRect(ctx, px+pw/2-160, iy, 320, 28, 6,
                      { fill: '#2a2800', stroke: C.uiHeading, lineWidth: 1 });
        drawText(ctx, '🔓  Unlocked: A* Euclidean Technique!', px+pw/2, iy+6,
                 { size:13, bold:true, color:C.uiHeading, align:'center' });
        iy += 38;

        // Next Level button
        const btnW = 200, btnH = 42;
        const bx = px + (pw - btnW) / 2, by = iy + 4;
        resultBtnRect = { x:bx, y:by, w:btnW, h:btnH };
        const hov = _hit(resultBtnRect, mouseX, mouseY);
        drawRoundRect(ctx, bx, by, btnW, btnH, 8, {
            fill: hov ? '#1e2e1e' : C.uiPanel,
            stroke: C.uiSuccess, lineWidth: 2,
        });
        drawText(ctx, 'Next Level →', bx+btnW/2, by+btnH/2-9,
                 { size:15, bold:true, color:C.uiSuccess, align:'center' });
        drawText(ctx, 'Enter or click', bx+btnW/2, by+btnH-18,
                 { size:11, color:C.uiSubtext, align:'center' });
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
