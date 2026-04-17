/**
 * tutorialState.js — Two-phase tutorial: blind run → A*-guided run → comparison.
 * Extracted and modularised from the original inline code in game.html.
 * Mirrors src/states/tutorial_state.py
 */

import { posKey, keyToPos }                    from '../utils.js';
import { GRID_COLS, GRID_ROWS, FOG_REVEAL_RADIUS } from '../config.js';
import { generateSquareMaze }                  from '../maze/generator.js';
import { SquareGrid }                          from '../maze/squareGrid.js';
import { AStarManhattan }                      from '../algorithms/astar.js';
import {
    SCREEN_HEIGHT, MAZE_AREA_WIDTH, SIDEBAR_X, SIDEBAR_WIDTH,
    CELL_SIZE, C,
    sqCellRect, updateFog,
    drawSquareMaze, drawSidebarBase,
    drawText, drawRoundRect, drawStatBlock,
} from '../renderer.js';

// ── Fixed positions ───────────────────────────────────────────────────────────
const START_K     = posKey(0, GRID_ROWS - 1);
const END_K       = posKey(GRID_COLS - 1, 0);
const GLOW        = [255, 220, 30];
const GLOW_BRIGHT = [255, 245, 120];

// ── Arrow / WASD key → [dc, dr] ──────────────────────────────────────────────
const MOVE_KEYS = {
    ArrowUp: [0,-1], ArrowDown: [0,1], ArrowLeft: [-1,0], ArrowRight: [1,0],
    w: [0,-1], s: [0,1], a: [-1,0], d: [1,0],
};

// ── Player factory ────────────────────────────────────────────────────────────
function makePlayer(startK) {
    return {
        posK:      startK,
        steps:     0,
        startTime: performance.now(),
        move(k)  { this.posK = k; this.steps++; },
        reset(k) { this.posK = k; this.steps = 0; this.startTime = performance.now(); },
        get elapsed() { return (performance.now() - this.startTime) / 1000; },
    };
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createTutorialState(ctx, goTo, gameData) {

    // State variables
    let grid, player, revealed;
    let phase;
    let anim = 0;
    let manSteps = 0, manTime = 0;
    let guidedSteps = 0, guidedStart = 0, guidedTime = 0;
    let guidePath  = [];
    let tomeRect   = null;
    let popupBtns  = [];
    let optimalSteps = 0;
    let mouseX = 0, mouseY = 0;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    function enter() {
        const passages = generateSquareMaze(GRID_COLS, GRID_ROWS);
        grid       = new SquareGrid(passages);
        player     = makePlayer(START_K);
        revealed   = new Set();
        anim       = 0;
        phase      = 'manual';
        manSteps   = manTime = 0;
        guidedSteps = guidedStart = guidedTime = 0;
        guidePath  = [];
        tomeRect   = null;
        popupBtns  = [];

        updateFog(revealed, START_K, grid.passages, FOG_REVEAL_RADIUS);

        const { path } = new AStarManhattan().findPath(grid, START_K, END_K);
        optimalSteps = Math.max(0, path.length - 1);
    }

    // ── Input ─────────────────────────────────────────────────────────────────

    function handleKey(key) {
        const delta = MOVE_KEYS[key];
        if (!delta) return;
        const [c, r] = keyToPos(player.posK);
        const newK   = posKey(c + delta[0], r + delta[1]);
        if (!grid.isPassage(player.posK, newK)) return;

        if (phase === 'manual') {
            player.move(newK);
            updateFog(revealed, newK, grid.passages, FOG_REVEAL_RADIUS);
            if (newK === END_K) {
                manSteps = player.steps;
                manTime  = player.elapsed;
                phase    = 'manual_done';
            }

        } else if (phase === 'guided') {
            player.move(newK);
            guidedSteps++;
            updateFog(revealed, newK, grid.passages, FOG_REVEAL_RADIUS);
            if (newK === END_K) {
                guidedTime = (performance.now() - guidedStart) / 1000;
                guidePath  = [];
                phase      = 'comparison';
                return;
            }
            _recomputeGuide();
        }
    }

    function handleMouseMove(x, y) { mouseX = x; mouseY = y; }

    function handleClick(x, y) {
        if (phase === 'manual_done' && tomeRect && _hit(tomeRect, x, y)) {
            _beginGuided(); return;
        }
        if (phase === 'comparison') {
            for (const { rect, target } of popupBtns) {
                if (_hit(rect, x, y)) { goTo(target); return; }
            }
        }
    }

    // ── Phase transition ──────────────────────────────────────────────────────

    function _beginGuided() {
        player.reset(START_K);
        revealed    = new Set();
        updateFog(revealed, START_K, grid.passages, FOG_REVEAL_RADIUS);
        guidedSteps = 0;
        guidedStart = performance.now();
        guidePath   = [];
        phase       = 'guided';
        _recomputeGuide();
    }

    function _recomputeGuide() {
        const { path } = new AStarManhattan().findPath(grid, player.posK, END_K);
        guidePath = path.length > 1 ? path.slice(1) : [];
    }

    // ── Update ────────────────────────────────────────────────────────────────

    function update(dt) { anim += dt; }

    // ── Draw ──────────────────────────────────────────────────────────────────

    function draw() {
        drawSquareMaze(ctx, grid.passages, revealed, player.posK, START_K, END_K);
        if (phase === 'guided' && guidePath.length > 0) _drawGuideGlow();
        _drawSidebar();
        if (phase === 'comparison') _drawComparisonPopup();
    }

    // ── Guide glow (single next tile) ─────────────────────────────────────────

    function _drawGuideGlow() {
        const nextK = guidePath[0];
        if (nextK === END_K) return;
        const [c, r]     = keyToPos(nextK);
        const { x, y, w } = sqCellRect(c, r);
        const pulse       = 0.5 + 0.5 * Math.sin(anim * 3.2);
        const cx = x + w / 2, cy = y + w / 2;

        // Layer 1 – amber cell fill
        ctx.fillStyle = `rgba(${GLOW},${(0.22 + 0.14 * pulse).toFixed(2)})`;
        ctx.fillRect(x, y, w, w);

        // Layer 2 – radial gradient orb
        const rOrb = Math.max(6, CELL_SIZE * 0.30 + 5 * pulse);
        const grd  = ctx.createRadialGradient(cx, cy, 0, cx, cy, rOrb * 1.4);
        grd.addColorStop(0,   `rgba(${GLOW_BRIGHT},${(0.90 + 0.10 * pulse).toFixed(2)})`);
        grd.addColorStop(0.5, `rgba(${GLOW},       ${(0.60 + 0.20 * pulse).toFixed(2)})`);
        grd.addColorStop(1,   `rgba(${GLOW},0)`);
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(cx, cy, rOrb * 1.4, 0, Math.PI * 2); ctx.fill();

        // Layer 3 – halo ring
        ctx.strokeStyle = `rgba(${GLOW_BRIGHT},${(0.43 + 0.39 * pulse).toFixed(2)})`;
        ctx.lineWidth   = 2;
        ctx.beginPath(); ctx.arc(cx, cy, rOrb + 5 + 4 * pulse, 0, Math.PI * 2); ctx.stroke();

        // Layer 4 – arrow label
        ctx.font         = 'bold 11px Arial';
        ctx.fillStyle    = 'rgba(30,20,0,0.85)';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('→', cx, cy);
    }

    // ── Sidebar ───────────────────────────────────────────────────────────────

    function _drawSidebar() {
        drawSidebarBase(ctx);
        const sx = SIDEBAR_X + 10, sw = SIDEBAR_WIDTH - 20;
        let y = 14;

        // Title
        ctx.font         = 'bold 22px Arial';
        ctx.fillStyle    = C.uiHeading;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('Tutorial', SIDEBAR_X + SIDEBAR_WIDTH / 2, y);
        y += 30;
        ctx.strokeStyle = C.uiHeading; ctx.lineWidth = 1;
        _ln(sx, y, sx + sw, y); y += 10;

        if (phase === 'manual') {
            drawText(ctx, '▶  Phase A – Blind Run', sx, y,
                     { size:13, color: C.uiWarn }); y += 22;
            y = drawStatBlock(ctx, sx, y, sw, 'Manual Run',
                              player.steps, player.elapsed, C.player) + 10;
            for (const line of ['Arrow keys / WASD to move',
                                 'Reach the GREEN exit',
                                 'Fog hides the maze — explore!',
                                 'ESC → Main Menu']) {
                drawText(ctx, line, sx, y, { size:13, color: C.uiSubtext }); y += 20;
            }

        } else if (phase === 'manual_done') {
            drawText(ctx, '✓  Phase A Complete!', sx, y,
                     { size:13, color: C.uiSuccess }); y += 22;
            y = drawStatBlock(ctx, sx, y, sw, 'Your Blind Run',
                              manSteps, manTime, C.uiSuccess) + 16;
            tomeRect = _drawTomeButton(sx, y, sw);
            y = tomeRect.y + tomeRect.h + 14;
            drawText(ctx, 'Can A* beat your record?', SIDEBAR_X + SIDEBAR_WIDTH / 2, y,
                     { size:13, color: C.uiSubtext, align: 'center' });

        } else if (phase === 'guided') {
            tomeRect = null;
            drawText(ctx, '▶  Phase B – A*-Guided Run', sx, y,
                     { size:13, color: C.astarMan }); y += 22;
            y = drawStatBlock(ctx, sx, y, sw, 'Phase A (done)',
                              manSteps, manTime, C.uiSubtext) + 8;
            const elapsed = (performance.now() - guidedStart) / 1000;
            y = drawStatBlock(ctx, sx, y, sw, 'Phase B – live',
                              guidedSteps, elapsed, C.astarMan) + 10;

            // Algorithm card
            drawRoundRect(ctx, sx, y, sw, 62, 5, { fill: C.uiPanel });
            ctx.fillStyle = C.astarMan;
            ctx.beginPath(); ctx.roundRect(sx, y, 4, 62, 2); ctx.fill();
            drawText(ctx, 'A* Manhattan',       sx+10, y+ 5, { size:16, bold:true, color:C.astarMan });
            drawText(ctx, 'f(n) = g(n) + h(n)', sx+10, y+26, { size:13, color:C.uiHilight });
            drawText(ctx, 'h(n) = |Δx| + |Δy|', sx+10, y+44, { size:13, color:C.uiSubtext });
            y += 68;

            ctx.strokeStyle = C.uiBorder; ctx.lineWidth = 1; _ln(sx, y, sx+sw, y); y += 8;
            for (const line of ['Follow the yellow glow —',
                                 'it marks your optimal next step.',
                                 '', 'Deviate? A* recalculates',
                                 'instantly from your position.']) {
                if (line) drawText(ctx, line, sx, y, { size:12, color: C.uiSubtext });
                y += 17;
            }

        } else if (phase === 'comparison') {
            y = drawStatBlock(ctx, sx, y, sw, 'Phase A – Blind Run',
                              manSteps, manTime, C.uiSubtext) + 8;
            drawStatBlock(ctx, sx, y, sw, 'Phase B – A*-Guided',
                          guidedSteps, guidedTime, C.uiSuccess);
        }
    }

    // ── A* Wisdom Tome button ─────────────────────────────────────────────────

    function _drawTomeButton(x, y, w) {
        const h    = 72;
        const rect = { x, y, w, h };
        const hov  = _hit(rect, mouseX, mouseY);
        const p    = 0.5 + 0.5 * Math.sin(anim * 2.5);

        drawRoundRect(ctx, x, y, w, h, 8, {
            fill:      hov ? '#3c3616' : '#2a2610',
            stroke:    hov ? C.astarMan : '#827028',
            lineWidth: 2,
        });
        if (hov) drawRoundRect(ctx, x-2, y-2, w+4, h+4, 10, {
            stroke: `rgba(255,220,30,${(0.16 + 0.16*p).toFixed(2)})`, lineWidth: 2,
        });

        // Book icon
        const bx = x + 12, by = y + 14;
        ctx.fillStyle = C.astarMan;
        ctx.fillRect(bx, by, 18, 26);
        ctx.fillStyle = '#1e1a0a';
        ctx.fillRect(bx+8, by, 2, 26);
        ctx.fillStyle = C.astarMan;
        ctx.fillRect(bx+10, by, 18, 26);
        ctx.strokeStyle = '#1e1a0a'; ctx.lineWidth = 1;
        for (const dy of [5, 11, 17]) {
            _ln(bx+2, by+dy, bx+6, by+dy);
            _ln(bx+12, by+dy, bx+26, by+dy);
        }

        drawText(ctx, 'A* Wisdom Tome', x+44, y+10,
                 { size:16, bold:true, color: hov ? C.astarMan : '#c8af50' });
        drawText(ctx, 'Click to begin guided run →', x+44, y+36,
                 { size:12, color: hov ? C.uiText : C.uiSubtext });
        return rect;
    }

    // ── Comparison popup ──────────────────────────────────────────────────────

    function _drawComparisonPopup() {
        popupBtns = [];
        const pw = 660, ph = 440;
        const px = (MAZE_AREA_WIDTH - pw) / 2;
        const py = (SCREEN_HEIGHT   - ph) / 2;

        // Backdrop
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.fillRect(0, 0, MAZE_AREA_WIDTH, SCREEN_HEIGHT);

        // Box
        drawRoundRect(ctx, px, py, pw, ph, 14,
                      { fill: '#18182a', stroke: C.uiHeading, lineWidth: 2 });

        // Title
        drawText(ctx, 'Performance Comparison Report',
                 px + pw/2, py+14, { size:20, bold:true, color:C.uiHeading, align:'center' });

        // Column dividers
        const colW = (pw - 60) / 2;
        const lx = px + 20, rx = px + 20 + colW + 20, midX = px + pw/2;
        drawText(ctx, 'Phase A – Blind Run',    lx + colW/2, py+52,
                 { size:13, color:C.player,   align:'center' });
        drawText(ctx, 'Phase B – A*-Guided Run',rx + colW/2, py+52,
                 { size:13, color:C.astarMan, align:'center' });
        ctx.strokeStyle = C.uiBorder; ctx.lineWidth = 1;
        _ln(midX, py+48, midX, py+310); _ln(px+16, py+78, px+pw-16, py+78);

        // Data rows
        let ry = py + 90;
        for (const [lbl, lv, rv, lc, rc] of [
            ['Steps', String(manSteps),         String(guidedSteps),       C.player,   C.astarMan],
            ['Time',  `${manTime.toFixed(1)}s`, `${guidedTime.toFixed(1)}s`, C.player, C.astarMan],
        ]) {
            drawText(ctx, lbl, midX, ry,
                     { size:13, color:C.uiSubtext, align:'center' });
            drawText(ctx, lv, lx + colW/2, ry+22,
                     { size:28, bold:true, color:lc, align:'center' });
            drawText(ctx, rv, rx + colW/2, ry+22,
                     { size:28, bold:true, color:rc, align:'center' });
            ry += 78;
        }

        // Insight
        ctx.strokeStyle = C.uiBorder; _ln(px+16, ry, px+pw-16, ry); ry += 12;
        const saved = manSteps - guidedSteps;
        const [insight, iCol] = saved > 0
            ? [`By following A* guidance, you saved ${saved} step${saved!==1?'s':''}!`, C.uiSuccess]
            : saved === 0
            ? ['You matched the A* guided path exactly — perfect!', C.uiSuccess]
            : [`You took ${-saved} extra step${saved!==-1?'s':''} beyond the A* path.`, C.uiWarn];
        drawText(ctx, insight, px+pw/2, ry,
                 { size:15, bold:true, color:iCol, align:'center' }); ry += 26;
        drawText(ctx,
                 `Theoretical optimum (pure A*): ${optimalSteps} steps   |   Your guided run: ${guidedSteps} steps`,
                 px+pw/2, ry, { size:12, color:C.uiSubtext, align:'center' }); ry += 20;
        drawText(ctx,
                 'f(n) = g(n) + h(n)  ·  h(n) = |Δx|+|Δy|  →  A* always finds the global optimum.',
                 px+pw/2, ry, { size:12, color:C.uiSubtext, align:'center' });

        // Buttons
        const btnY = py + ph - 56;
        for (const [bx, target, label, col] of [
            [px + 30,          'MENU',     '← Back to Menu', C.uiSubtext],
            [px + pw - 210,    'TUTORIAL', 'Play Again →',   C.uiSuccess],
        ]) {
            const rect = { x:bx, y:btnY, w:180, h:40 };
            const hov  = _hit(rect, mouseX, mouseY);
            drawRoundRect(ctx, bx, btnY, 180, 40, 8, {
                fill: hov ? '#323246' : C.uiPanel, stroke: col, lineWidth: 2,
            });
            drawText(ctx, label, bx+90, btnY+12,
                     { size:15, color:col, align:'center' });
            popupBtns.push({ rect, target });
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    function _ln(x1, y1, x2, y2) {
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    }

    return { enter, update, draw, handleKey, handleClick, handleMouseMove };
}

function _hit(r, x, y) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
