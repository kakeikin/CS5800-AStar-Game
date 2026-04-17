/**
 * layer3State.js — Layer 3: The Hexagon
 * 10×10 hex maze. Player picks Manhattan or Euclidean A*.
 * Guide path shows next 2 steps; Dijkstra monster races them.
 *
 * Hex controls (V-shape cluster):
 *   U  I   → NW / NE
 *   H  K   → W  / E
 *   N  M   → SW / SE
 *
 * Mirrors src/states/layer3_state.py
 */

import { posKey, keyToPos }                             from '../utils.js';
import { GRID_COLS, GRID_ROWS, FOG_REVEAL_RADIUS,
         HEX_NBR_EVEN, HEX_NBR_ODD }                   from '../config.js';
import { generateHexMaze }                              from '../maze/generator.js';
import { HexGrid }                                      from '../maze/hexGrid.js';
import { AStarManhattan, AStarEuclidean }               from '../algorithms/astar.js';
import { Dijkstra }                                     from '../algorithms/dijkstra.js';
import {
    SCREEN_HEIGHT, MAZE_AREA_WIDTH, SIDEBAR_X, SIDEBAR_WIDTH, C,
    hexCorners, hexCenter, updateFog,
    drawHexMaze, drawSidebarBase,
    drawText, drawRoundRect, drawStatBlock,
} from '../renderer.js';

// ── Positions ─────────────────────────────────────────────────────────────────
const START_K = posKey(0, GRID_ROWS - 1);
const END_K   = posKey(GRID_COLS - 1, 0);

// Hex direction index → neighbour offset lookup
const HEX_KEY_DIR = { i:0, k:1, m:2, n:3, h:4, u:5 };

// ── Entity factories ──────────────────────────────────────────────────────────

function makePlayer(startK) {
    return {
        posK:      startK,
        steps:     0,
        startTime: performance.now(),
        move(k)       { this.posK = k; this.steps++; },
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
            this.path = path; this.pathIdx = 0;
            this.nodesExpanded = visitedOrder.length;
        },
        advance() {
            if (this.pathIdx + 1 >= this.path.length) return;
            this.pathIdx++; this.posK = this.path[this.pathIdx]; this.steps++;
        },
        get elapsed() { return (performance.now() - this.startTime) / 1000; },
    };
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createLayer3State(ctx, goTo, gameData) {

    // Phase: "choose" | "race"
    let phase = 'choose';
    let algoKey = null;   // "manhattan" | "euclidean"
    let algoInst = null;  // AStarManhattan or AStarEuclidean instance
    let guideCol = C.astarMan;

    let grid, player, monster, revealed;
    let guidePath = [];
    let playerTurn, winner;
    let anim = 0, mouseX = 0, mouseY = 0;

    // Clickable rects built each frame
    let chooseRects  = [];   // [{rect, key}]
    let resultBtns   = [];   // [{rect, target}]

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    function enter() {
        phase       = 'choose';
        algoKey     = null;
        anim        = 0;
        chooseRects = [];
        resultBtns  = [];
    }

    function _startRace(key) {
        const passages = generateHexMaze(GRID_COLS, GRID_ROWS);
        grid     = new HexGrid(passages);
        player   = makePlayer(START_K);
        monster  = makeMonster(START_K);
        revealed = new Set();

        algoKey  = key;
        if (key === 'manhattan') {
            algoInst = new AStarManhattan();
            guideCol = C.astarMan;
        } else {
            algoInst = new AStarEuclidean();
            guideCol = C.astarEuc;
        }

        monster.computePath(grid, END_K);

        playerTurn  = true;
        winner      = null;
        guidePath   = [];
        resultBtns  = [];
        phase       = 'race';

        updateFog(revealed, START_K, grid.passages, FOG_REVEAL_RADIUS);
        _refreshGuide();
    }

    function _refreshGuide() {
        const { path } = algoInst.findPath(grid, player.posK, END_K);
        guidePath = path.slice(1, 3);   // next 2 steps
    }

    // ── Input ─────────────────────────────────────────────────────────────────

    function handleKey(key) {
        const k = key.toLowerCase();

        if (k === 'escape') {
            if (phase === 'race') { phase = 'choose'; winner = null; return; }
            goTo('MENU'); return;
        }

        if (phase === 'choose') {
            if (k === 'm') { _startRace('manhattan'); return; }
            if (k === 'e') { _startRace('euclidean'); return; }
            return;
        }

        // Race phase
        if (winner) {
            if (key === 'Enter' || key === ' ') _advance();
            return;
        }
        if (!playerTurn) return;

        const dir = HEX_KEY_DIR[k];
        if (dir === undefined) return;
        _moveHex(dir);
    }

    function _moveHex(dir) {
        const [c, r] = keyToPos(player.posK);
        const offsets = (r % 2 === 1) ? HEX_NBR_ODD : HEX_NBR_EVEN;
        const [dc, dr] = offsets[dir];
        const newK = posKey(c + dc, r + dr);
        if (!grid.isPassage(player.posK, newK)) return;

        player.move(newK);
        updateFog(revealed, newK, grid.passages, FOG_REVEAL_RADIUS);
        _refreshGuide();

        if (newK === END_K) { winner = 'Player'; return; }

        playerTurn = false;
        monster.advance();
        if (monster.posK === END_K) { winner = 'Dijkstra'; return; }
        playerTurn = true;
    }

    function handleMouseMove(x, y) { mouseX = x; mouseY = y; }

    function handleClick(x, y) {
        if (phase === 'choose') {
            for (const { rect, key } of chooseRects) {
                if (_hit(rect, x, y)) { _startRace(key); return; }
            }
            return;
        }
        if (phase === 'race' && winner) {
            for (const { rect, target } of resultBtns) {
                if (_hit(rect, x, y)) { goTo(target); return; }
            }
        }
    }

    function _advance() {
        if (!gameData.completedLevels.includes('MAZE_L3'))
            gameData.completedLevels.push('MAZE_L3');
        goTo('MAZE_L4');
    }

    // ── Update ────────────────────────────────────────────────────────────────

    function update(dt) { anim += dt; }

    // ── Draw ──────────────────────────────────────────────────────────────────

    function draw() {
        if (phase === 'choose') { _drawChoose(); return; }

        drawHexMaze(ctx, grid.passages, revealed, player.posK, START_K, END_K, {
            monsters: [{ posK: monster.posK, color: monster.color }],
        });

        _drawHexGuide();
        _drawRaceSidebar();
        if (winner) _drawResultOverlay();
    }

    // ── Hex guide path ────────────────────────────────────────────────────────

    function _drawHexGuide() {
        const pulse = 0.5 + 0.5 * Math.sin(anim * 2.8);
        const col   = _hexColor(guideCol);

        for (let i = 0; i < guidePath.length; i++) {
            const k = guidePath[i];
            if (!revealed.has(k) || k === END_K || k === START_K) continue;
            const [c, r] = keyToPos(k);
            const corners = hexCorners(c, r);

            // Filled semi-transparent hex
            ctx.fillStyle = `rgba(${col},${(0.28 + 0.12 * pulse).toFixed(2)})`;
            _hexPath(corners); ctx.fill();

            // Pulsing border ring
            ctx.strokeStyle = `rgba(${col},${(0.55 + 0.30 * pulse).toFixed(2)})`;
            ctx.lineWidth   = 2;
            _hexPath(corners); ctx.stroke();
        }
    }

    // ── Choose screen ─────────────────────────────────────────────────────────

    function _drawChoose() {
        chooseRects = [];

        // Background
        ctx.fillStyle = C.uiBg;
        ctx.fillRect(0, 0, MAZE_AREA_WIDTH, SCREEN_HEIGHT);

        const cx = MAZE_AREA_WIDTH / 2;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';

        // Title
        ctx.font      = 'bold 24px Arial';
        ctx.fillStyle = C.uiHeading;
        ctx.fillText('Layer 3 – The Hexagon', cx, 52);

        ctx.font      = '15px Arial';
        ctx.fillStyle = C.uiSubtext;
        ctx.fillText('Choose your heuristic, then race Dijkstra!', cx, 86);

        // Algorithm selection buttons
        const bw = 240, bh = 148, gap = 28;
        const bx0 = cx - bw - gap / 2;
        const by  = 124;

        const btnDefs = [
            { key:'manhattan', title:'[M]  A* Manhattan', formula:'h(n) = |Δx| + |Δy|',
              note:'Guides with gold path', col: C.astarMan },
            { key:'euclidean', title:'[E]  A* Euclidean', formula:'h(n) = √(Δx² + Δy²)',
              note:'Guides with red path',  col: C.astarEuc },
        ];

        for (let i = 0; i < btnDefs.length; i++) {
            const { key, title, formula, note, col } = btnDefs[i];
            const bx   = bx0 + i * (bw + gap);
            const rect = { x:bx, y:by, w:bw, h:bh };
            const hov  = _hit(rect, mouseX, mouseY);
            chooseRects.push({ rect, key });

            drawRoundRect(ctx, bx, by, bw, bh, 10, {
                fill:      hov ? '#2d2d44' : C.uiPanel,
                stroke:    col, lineWidth: 2,
            });
            if (hov) drawRoundRect(ctx, bx-2, by-2, bw+4, bh+4, 12, {
                stroke: col + '60', lineWidth: 2,
            });

            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.font      = 'bold 15px Arial';
            ctx.fillStyle = col;
            ctx.fillText(title, bx + bw/2, by + 16);

            ctx.font      = '13px Arial';
            ctx.fillStyle = C.uiHilight;
            ctx.fillText(formula, bx + bw/2, by + 42);

            ctx.font      = '12px Arial';
            ctx.fillStyle = C.uiSubtext;
            ctx.fillText(note, bx + bw/2, by + 64);

            // Colour swatch circle
            ctx.fillStyle = col;
            ctx.beginPath(); ctx.arc(bx + bw/2, by + 104, 16, 0, Math.PI*2); ctx.fill();
        }

        // Hex control reference
        let hy = by + bh + 32;
        ctx.textAlign = 'center'; ctx.font = 'bold 14px Arial';
        ctx.fillStyle = C.uiText;
        ctx.fillText('Hex Controls', cx, hy); hy += 24;

        const ctrlRows = [
            { keys:'U  /  I', dirs:'NW / NE' },
            { keys:'H  /  K', dirs: 'W  /  E' },
            { keys:'N  /  M', dirs:'SW / SE' },
        ];
        for (const { keys, dirs } of ctrlRows) {
            ctx.font = '13px Arial';
            ctx.fillStyle = C.uiHilight;
            ctx.textAlign = 'right';
            ctx.fillText(keys, cx - 10, hy);
            ctx.fillStyle = C.uiSubtext;
            ctx.textAlign = 'left';
            ctx.fillText(dirs, cx + 10, hy);
            hy += 20;
        }

        // Sidebar for choose screen
        _drawChooseSidebar();
    }

    function _drawChooseSidebar() {
        drawSidebarBase(ctx);
        const sx = SIDEBAR_X + 10, sw = SIDEBAR_WIDTH - 20;
        let y = 14;

        ctx.font = 'bold 19px Arial'; ctx.fillStyle = C.uiHeading;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText('Layer 3 – Hexagon', SIDEBAR_X + SIDEBAR_WIDTH/2, y); y += 28;
        ctx.strokeStyle = C.uiHeading; ctx.lineWidth = 1;
        _ln(sx, y, sx+sw, y); y += 10;

        drawText(ctx, 'Pick a heuristic to race!', sx+sw/2, y,
                 { size:13, color:C.uiSubtext, align:'center' }); y += 26;

        for (const [name, formula, desc, col] of [
            ['A* Manhattan', 'h = |Δx| + |Δy|',      'Press [M] to pick',  C.astarMan],
            ['A* Euclidean', 'h = √(Δx² + Δy²)',     'Press [E] to pick',  C.astarEuc],
            ['Dijkstra',     'h = 0 (uniform cost)',  'Monster AI',         C.dijkstra],
        ]) {
            drawRoundRect(ctx, sx, y, sw, 56, 5, { fill: C.uiPanel });
            ctx.fillStyle = col;
            ctx.beginPath(); ctx.roundRect(sx, y, 4, 56, 2); ctx.fill();
            drawText(ctx, name,    sx+10, y+ 4, { size:13, bold:true, color:col });
            drawText(ctx, formula, sx+10, y+22, { size:12, color:C.uiHilight });
            drawText(ctx, desc,    sx+10, y+40, { size:11, color:C.uiSubtext });
            y += 60;
        }
        y += 6; _ln(sx, y, sx+sw, y); y += 8;
        for (const line of ['Click a button or press [M]/[E]', 'ESC → Main Menu'])
            { drawText(ctx, line, sx, y, { size:12, color:C.uiSubtext }); y += 18; }
    }

    // ── Race sidebar ──────────────────────────────────────────────────────────

    function _drawRaceSidebar() {
        drawSidebarBase(ctx);
        const sx = SIDEBAR_X + 10, sw = SIDEBAR_WIDTH - 20;
        let y = 14;

        ctx.font = 'bold 19px Arial'; ctx.fillStyle = C.uiHeading;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText('Layer 3 – Hexagon', SIDEBAR_X + SIDEBAR_WIDTH/2, y); y += 28;
        _ln(sx, y, sx+sw, y); y += 10;

        // Turn indicator
        const turnLabel = winner
            ? (winner === 'Player' ? '🏆  You Win!' : '💀  Dijkstra Wins!')
            : playerTurn ? '▶  YOUR TURN' : '⏳  Monster moving…';
        const turnColor = winner
            ? (winner === 'Player' ? C.uiSuccess : C.dijMon)
            : playerTurn ? C.uiWarn : C.uiSubtext;
        drawText(ctx, turnLabel, sx+sw/2, y,
                 { size:14, bold:true, color:turnColor, align:'center' }); y += 24;
        _ln(sx, y, sx+sw, y); y += 10;

        // Algorithm card
        const algoName = algoKey === 'manhattan' ? 'A* Manhattan' : 'A* Euclidean';
        const formula  = algoKey === 'manhattan' ? 'h = |Δx| + |Δy|' : 'h = √(Δx² + Δy²)';
        drawRoundRect(ctx, sx, y, sw, 56, 5, { fill: C.uiPanel });
        ctx.fillStyle = guideCol;
        ctx.beginPath(); ctx.roundRect(sx, y, 4, 56, 2); ctx.fill();
        drawText(ctx, algoName,         sx+10, y+ 4, { size:14, bold:true, color:guideCol });
        drawText(ctx, 'Your algorithm', sx+10, y+22, { size:12, color:C.uiSubtext });
        drawText(ctx, formula,          sx+10, y+40, { size:12, color:C.uiHilight });
        y += 60;

        // Stat blocks
        y = drawStatBlock(ctx, sx, y, sw, 'You (A*)',         player.steps, player.elapsed, guideCol) + 8;
        y = drawStatBlock(ctx, sx, y, sw, 'Dijkstra Monster', monster.steps, monster.elapsed, C.dijMon) + 12;

        // Hex control reference
        _ln(sx, y, sx+sw, y); y += 8;
        drawText(ctx, '── Hex Controls ──', sx, y,
                 { size:12, bold:true, color:C.uiHeading }); y += 20;
        for (const [keys, dirs] of [['U / I','NW / NE'],['H / K','W  /  E'],['N / M','SW / SE']]) {
            ctx.font = 'bold 12px Arial'; ctx.fillStyle = C.uiHilight;
            ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            ctx.fillText(keys, sx, y);
            ctx.font = '12px Arial'; ctx.fillStyle = C.uiSubtext;
            ctx.textAlign = 'right';
            ctx.fillText(dirs, sx + sw, y); y += 18;
        }
        y += 4;
        drawText(ctx, 'ESC → re-choose heuristic', sx, y, { size:11, color:C.uiSubtext });
    }

    // ── Result overlay ────────────────────────────────────────────────────────

    function _drawResultOverlay() {
        resultBtns = [];
        ctx.fillStyle = 'rgba(0,0,0,0.68)';
        ctx.fillRect(0, 0, MAZE_AREA_WIDTH, SCREEN_HEIGHT);

        const pw = 560, ph = 380;
        const px = (MAZE_AREA_WIDTH - pw) / 2;
        const py = (SCREEN_HEIGHT   - ph) / 2;
        const winColor = winner === 'Player' ? C.uiSuccess : C.dijMon;

        drawRoundRect(ctx, px, py, pw, ph, 14,
                      { fill:'#14142a', stroke: winColor, lineWidth:2 });

        // Headline
        const headline = winner === 'Player'
            ? '🏆  You reached the exit first!'
            : '💀  Dijkstra reached the exit first!';
        drawText(ctx, headline, px+pw/2, py+16,
                 { size:18, bold:true, color:winColor, align:'center' });

        ctx.strokeStyle = C.uiBorder; ctx.lineWidth = 1;
        _ln(px+20, py+50, px+pw-20, py+50);

        // Stats
        const algoLabel = algoKey === 'manhattan' ? 'Manhattan' : 'Euclidean';
        drawText(ctx, `Algorithm: A* ${algoLabel}`, px+pw/2, py+60,
                 { size:14, color:C.uiText, align:'center' });
        drawText(ctx,
            `Your steps: ${player.steps}   Monster: ${monster.steps}`,
            px+pw/2, py+84, { size:13, color:C.uiSubtext, align:'center' });
        drawText(ctx,
            `Your time: ${player.elapsed.toFixed(1)}s   Monster: ${monster.elapsed.toFixed(1)}s`,
            px+pw/2, py+104, { size:13, color:C.uiSubtext, align:'center' });

        _ln(px+20, py+128, px+pw-20, py+128);

        // Pedagogical insight
        const isManhattan = algoKey === 'manhattan';
        const [note1, note2, note3] = isManhattan ? [
            'Why Manhattan may struggle on hex grids:',
            'h = |Δx|+|Δy| over-estimates hex distances — A* expanded',
            'more nodes than necessary, wasting search effort.',
        ] : [
            'Why Euclidean works better on hex grids:',
            'h = √(Δx²+Δy²) closely approximates the true geodesic distance,',
            'so A* guided the search efficiently toward the exit.',
        ];

        let iy = py + 140;
        drawText(ctx, note1, px+pw/2, iy,
                 { size:13, bold:true, color:C.uiHeading, align:'center' }); iy += 22;
        drawText(ctx, note2, px+pw/2, iy,
                 { size:12, color:C.uiSubtext, align:'center' }); iy += 20;
        drawText(ctx, note3, px+pw/2, iy,
                 { size:12, color:C.uiSubtext, align:'center' }); iy += 28;

        drawText(ctx,
            `Dijkstra expanded: ${monster.nodesExpanded} nodes (no heuristic)`,
            px+pw/2, iy, { size:12, color:C.dijkstra, align:'center' }); iy += 26;

        _ln(px+20, iy, px+pw-20, iy); iy += 12;

        // Buttons: ← Menu   |   Next Level →
        const bw = 150, bh = 40, gap2 = 24;
        const b1x = px + pw/2 - bw - gap2/2;
        const b2x = px + pw/2 + gap2/2;
        const by  = iy;

        for (const [bx, target, label, col] of [
            [b1x, 'MENU',    '← Menu',       C.uiSubtext],
            [b2x, 'MAZE_L4', 'Next Level →', C.uiSuccess],
        ]) {
            const rect = { x:bx, y:by, w:bw, h:bh };
            const hov  = _hit(rect, mouseX, mouseY);
            drawRoundRect(ctx, bx, by, bw, bh, 8, {
                fill: hov ? '#282840' : C.uiPanel,
                stroke: col, lineWidth:2,
            });
            drawText(ctx, label, bx+bw/2, by+bh/2-8,
                     { size:14, bold:true, color:col, align:'center' });
            resultBtns.push({ rect, target });
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function _hexPath(corners) {
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
        ctx.closePath();
    }

    function _hexColor(cssHex) {
        // Convert '#rrggbb' → 'r,g,b' for use in rgba(...)
        const r = parseInt(cssHex.slice(1,3),16);
        const g = parseInt(cssHex.slice(3,5),16);
        const b = parseInt(cssHex.slice(5,7),16);
        return `${r},${g},${b}`;
    }

    function _ln(x1,y1,x2,y2) {
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    }

    return { enter, update, draw, handleKey, handleClick, handleMouseMove };
}

function _hit(r, x, y) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
