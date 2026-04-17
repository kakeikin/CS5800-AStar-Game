/**
 * menuState.js — Main menu: animated backdrop, 3 icon buttons, algorithm badges.
 * Mirrors src/states/menu_state.py
 */

import { SCREEN_WIDTH, SCREEN_HEIGHT, C, drawRoundRect, drawText } from '../renderer.js';

// ── Button layout ─────────────────────────────────────────────────────────────
const BTN_W    = 220;
const BTN_H    = 230;
const BTN_GAP  = 44;
const TOTAL_W  = 3 * BTN_W + 2 * BTN_GAP;
const BTN_X0   = Math.floor((SCREEN_WIDTH - TOTAL_W) / 2);
// Push cards lower so header breathes, cards sit in comfortable lower half
const BTN_TOP  = 210;

const BTNS = [
    { label: 'Tutorial', sub: 'Learn A* step by step',  target: 'TUTORIAL', hint: 'T' },
    { label: 'Maze',     sub: 'Race through 4 layers',  target: 'MAZE_L1',  hint: '1' },
    { label: 'Custom',   sub: 'Free-form visualizer',   target: 'CUSTOM',   hint: 'C' },
];

// Layers tracked for completion badges on the Maze card
const LAYERS = ['MAZE_L1', 'MAZE_L2', 'MAZE_L3', 'MAZE_L4'];

const KEY_MAP = { t: 'TUTORIAL', '1': 'MAZE_L1', c: 'CUSTOM' };

// ── Factory ───────────────────────────────────────────────────────────────────

export function createMenuState(ctx, goTo, gameData) {
    let anim  = 0;
    let mx = 0, my = 0;

    const rects = BTNS.map((_, i) => ({
        x: BTN_X0 + i * (BTN_W + BTN_GAP), y: BTN_TOP, w: BTN_W, h: BTN_H,
    }));

    function enter() { anim = 0; }
    function update(dt) { anim += dt; }
    function handleMouseMove(x, y) { mx = x; my = y; }

    function handleClick(x, y) {
        for (let i = 0; i < BTNS.length; i++)
            if (_hit(rects[i], x, y)) { goTo(BTNS[i].target); return; }
    }

    function handleKey(key) {
        const target = KEY_MAP[key.toLowerCase()];
        if (target) goTo(target);
    }

    // ── Draw ──────────────────────────────────────────────────────────────────

    function draw() {
        // Light academic background
        ctx.fillStyle = '#f4f6fc';
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

        // Subtle grid pattern (academic graph-paper feel)
        ctx.strokeStyle = 'rgba(160,170,210,0.25)';
        ctx.lineWidth   = 1;
        for (let gx = 0; gx < SCREEN_WIDTH; gx += 40) {
            ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, SCREEN_HEIGHT); ctx.stroke();
        }
        for (let gy = 0; gy < SCREEN_HEIGHT; gy += 40) {
            ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(SCREEN_WIDTH, gy); ctx.stroke();
        }

        // Animated accent dots at grid intersections
        for (let gx = 0; gx < SCREEN_WIDTH; gx += 40) {
            for (let gy = 0; gy < SCREEN_HEIGHT; gy += 40) {
                const pulse = 0.12 + 0.06 * Math.sin(anim * 0.6 + gx * 0.04 + gy * 0.04);
                ctx.fillStyle = `rgba(37,99,235,${pulse.toFixed(3)})`;
                ctx.beginPath(); ctx.arc(gx, gy, 1.5, 0, Math.PI * 2); ctx.fill();
            }
        }

        const cx = SCREEN_WIDTH / 2;
        ctx.textBaseline = 'top';
        ctx.textAlign    = 'center';

        // ── Header bar (academic paper style) ────────────────────────────────
        ctx.fillStyle = '#6b7d96';
        ctx.fillRect(0, 0, SCREEN_WIDTH, 36);
        ctx.font      = '500 13px "Inter", Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText('CS5800 · Algorithms & Data Structures', 20, 18);
        ctx.textAlign = 'right';
        ctx.fillText('Interactive Learning Tool', SCREEN_WIDTH - 20, 18);

        // ── Title block ───────────────────────────────────────────────────────
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';

        // English title (enlarged, moved up since CJK removed)
        ctx.font      = '700 38px "Inter", Arial, sans-serif';
        ctx.fillStyle = '#3a4a6a';
        ctx.fillText('The Path of Algorithms', cx, 54);

        // Subtitle
        ctx.font      = '400 14px "Inter", Arial, sans-serif';
        ctx.fillStyle = C.uiSubtext;
        ctx.fillText('A*  vs  Dijkstra  ·  Interactive Maze Learning', cx, 102);

        // ── Algorithm badge pills ─────────────────────────────────────────────
        _drawBadges(cx);

        // ── Three main cards ──────────────────────────────────────────────────
        for (let i = 0; i < BTNS.length; i++) _drawButton(i);

        // ── Key-shortcut strip ────────────────────────────────────────────────
        const hintY = BTN_TOP + BTN_H + 18;
        ctx.font      = '400 13px "Inter", Arial, sans-serif';
        ctx.fillStyle = C.uiSubtext;
        ctx.textAlign = 'center';
        ctx.fillText(
            '[T] Tutorial  ·  [1] Maze  ·  [C] Custom',
            cx, hintY,
        );

        // ── Unlocked tomes strip (bottom-left) ────────────────────────────────
        // Bottom border
        ctx.fillStyle = '#d0d4e8';
        ctx.fillRect(0, SCREEN_HEIGHT - 34, SCREEN_WIDTH, 1);
        ctx.fillStyle = '#f8f9fd';
        ctx.fillRect(0, SCREEN_HEIGHT - 33, SCREEN_WIDTH, 33);

        if (gameData.tomes?.length) {
            ctx.textAlign    = 'left';
            ctx.textBaseline = 'middle';
            ctx.font         = '600 11px "Inter", Arial, sans-serif';
            ctx.fillStyle    = C.uiSubtext;
            ctx.fillText('UNLOCKED', 20, SCREEN_HEIGHT - 17);
            let tx = 20 + ctx.measureText('UNLOCKED').width + 12;
            for (const t of gameData.tomes) {
                const col = t === 'manhattan' ? C.astarMan
                          : t === 'euclidean' ? C.astarEuc
                          : C.astarHex;
                const label = t.charAt(0).toUpperCase() + t.slice(1);
                ctx.font = '500 11px "Inter", Arial, sans-serif';
                const lw = ctx.measureText(label).width;
                ctx.fillStyle   = col + '20';
                ctx.strokeStyle = col + '80';
                ctx.lineWidth   = 1;
                ctx.beginPath(); ctx.roundRect(tx, SCREEN_HEIGHT - 26, lw + 16, 18, 4);
                ctx.fill(); ctx.stroke();
                ctx.fillStyle = col;
                ctx.fillText(label, tx + 8, SCREEN_HEIGHT - 17);
                tx += lw + 28;
            }
        } else {
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.font = '400 12px "Inter", Arial, sans-serif';
            ctx.fillStyle = C.uiSubtext;
            ctx.fillText('Complete Tutorial to unlock algorithm tomes.', 20, SCREEN_HEIGHT - 17);
        }
    }

    function _drawBadges(cx) {
        const badges = [
            { text: 'Dijkstra  h=0',              color: C.dijkstra },
            { text: 'A* Manhattan  h=|Δx|+|Δy|',  color: C.astarMan },
            { text: 'A* Euclidean  h=√(Δx²+Δy²)', color: C.astarEuc },
        ];
        ctx.font = '500 12px "Inter", Arial, sans-serif';
        const gap = 12, padX = 10, badgeY = 150, badgeH = 24;
        const widths = badges.map(b => ctx.measureText(b.text).width + padX * 2);
        const total  = widths.reduce((a, w) => a + w + gap, -gap);
        let bx = cx - total / 2;
        for (let i = 0; i < badges.length; i++) {
            const { text, color } = badges[i];
            const bw = widths[i];
            ctx.fillStyle   = color + '18';
            ctx.strokeStyle = color + '80';
            ctx.lineWidth   = 1;
            ctx.beginPath(); ctx.roundRect(bx, badgeY, bw, badgeH, 5);
            ctx.fill(); ctx.stroke();
            ctx.fillStyle    = color;
            ctx.textAlign    = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, bx + padX, badgeY + badgeH / 2);
            bx += bw + gap;
        }
    }

    function _drawButton(idx) {
        const { x, y, w, h } = rects[idx];
        const btn   = BTNS[idx];
        const hov   = _hit(rects[idx], mx, my);
        const pulse = 0.5 + 0.5 * Math.sin(anim * 1.8 + idx * 1.1);
        const icx   = x + w / 2;
        const icy   = y + 72;

        // Card — white surface with drop shadow illusion via border
        ctx.fillStyle = hov ? '#f0f4ff' : '#ffffff';
        ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill();

        // Card border — accent on hover, subtle otherwise
        const accentCol = idx === 0 ? C.astarMan : idx === 1 ? C.dijkstra : C.astarEuc;
        if (hov) {
            ctx.strokeStyle = accentCol;
            ctx.lineWidth   = 2;
        } else {
            ctx.strokeStyle = C.uiBorder;
            ctx.lineWidth   = 1;
        }
        ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.stroke();

        // Accent top bar (always visible, brightens on hover)
        ctx.fillStyle = accentCol + (hov ? 'ee' : '99');
        ctx.beginPath(); ctx.roundRect(x, y, w, 4, [12, 12, 0, 0]); ctx.fill();

        // Icon
        if      (idx === 0) _drawBookIcon(icx, icy, hov);
        else if (idx === 1) _drawMazeIcon(icx, icy, hov);
        else                _drawCustomIcon(icx, icy, hov);

        // Label
        ctx.font         = '700 18px "Inter", Arial, sans-serif';
        ctx.fillStyle    = hov ? C.uiHeading : C.uiText;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(btn.label, icx, y + 146);

        // Sub-label
        ctx.font      = '400 13px "Inter", Arial, sans-serif';
        ctx.fillStyle = hov ? C.uiHilight : C.uiSubtext;
        ctx.fillText(btn.sub, icx, y + 170);

        // Completion dots for Maze card (layers L1-L4)
        if (idx === 1) {
            const dotGap = 16, dotR = 4;
            const dotsW  = LAYERS.length * dotGap - (dotGap - dotR * 2);
            let dx = icx - dotsW / 2 + dotR;
            const dotY  = y + 196;
            for (const lvl of LAYERS) {
                const done = gameData.completedLevels?.includes(lvl);
                ctx.fillStyle = done ? C.uiSuccess : C.uiBorder;
                ctx.beginPath(); ctx.arc(dx, dotY, dotR, 0, Math.PI * 2); ctx.fill();
                if (done) {
                    ctx.fillStyle = 'rgba(255,255,255,0.9)';
                    ctx.beginPath(); ctx.arc(dx - 1, dotY - 1, 1.5, 0, Math.PI * 2); ctx.fill();
                }
                dx += dotGap;
            }
        }

        // Key hint pill (keyboard shortcut badge)
        const kx = x + w - 30, ky = y + h - 28;
        ctx.fillStyle   = '#e8ecf8';
        ctx.strokeStyle = C.uiBorder;
        ctx.lineWidth   = 1;
        ctx.beginPath(); ctx.roundRect(kx, ky, 22, 18, 4); ctx.fill(); ctx.stroke();
        ctx.font      = '600 11px "Inter", Arial, sans-serif';
        ctx.fillStyle = C.uiSubtext;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(btn.hint, kx + 11, ky + 9);
    }

    // ── Icon drawing ──────────────────────────────────────────────────────────

    function _drawBookIcon(cx, cy, hov) {
        const col     = hov ? C.astarMan : 'rgb(160,140,100)';
        const spineAlpha = hov ? 'rgba(255,220,30,0.6)' : 'rgba(160,140,100,0.6)';

        ctx.fillStyle = col;
        ctx.beginPath(); ctx.roundRect(cx - 38, cy - 30, 36, 50, 3); ctx.fill();
        ctx.beginPath(); ctx.roundRect(cx +  2, cy - 30, 36, 50, 3); ctx.fill();

        // Spine
        ctx.fillStyle = C.uiBg;       ctx.fillRect(cx - 3, cy - 30, 6, 50);
        ctx.fillStyle = spineAlpha;   ctx.fillRect(cx - 3, cy - 30, 6, 50);

        // Page lines
        ctx.strokeStyle = C.uiBg; ctx.lineWidth = 2;
        for (const dy of [0, 10, 20]) {
            _stroke(cx - 34, cy - 18 + dy, cx - 6, cy - 18 + dy);
            _stroke(cx +  6, cy - 18 + dy, cx + 34, cy - 18 + dy);
        }

        // "A*" label
        ctx.font         = 'bold 13px Arial';
        ctx.fillStyle    = C.uiBg;
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('A*', cx + 14, cy + 4);
    }

    function _drawMazeIcon(cx, cy, hov) {
        const colWall = hov ? C.astarMan : 'rgb(100,160,100)';
        const colPath = hov ? C.uiSuccess : 'rgb(60,140,60)';
        const cell = 10;
        const ox = cx - 2.5 * cell, oy = cy - 2.5 * cell;

        // Outline
        ctx.strokeStyle = colWall; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.rect(ox - 1, oy - 1, 5*cell+2, 5*cell+2); ctx.stroke();

        // Walls
        for (const [c1,r1,c2,r2] of [
            [0,0,1,0],[2,0,3,0], [1,1,2,1],[3,1,4,1],
            [0,2,0,3],[2,2,2,3],[4,2,4,3], [1,3,2,3],[3,3,3,4],
        ]) { _stroke(ox+c1*cell, oy+r1*cell, ox+c2*cell, oy+r2*cell); }

        // Path cells
        ctx.fillStyle = colPath;
        for (const [c,r] of [[0,4],[0,3],[1,3],[1,2],[2,2],[2,1],[3,1],[3,0],[4,0]]) {
            ctx.beginPath(); ctx.roundRect(ox+c*cell+2, oy+r*cell+2, cell-4, cell-4, 2); ctx.fill();
        }

        // Start / End dots
        ctx.fillStyle = C.start;
        ctx.beginPath(); ctx.arc(ox+cell/2, oy+4*cell+cell/2, 4, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = C.end;
        ctx.beginPath(); ctx.arc(ox+4*cell+cell/2, oy+cell/2, 4, 0, Math.PI*2); ctx.fill();
    }

    function _drawCustomIcon(cx, cy, hov) {
        const col = hov ? C.astarEuc : 'rgb(120,120,160)';

        // Pencil body
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(cx-8, cy-34); ctx.lineTo(cx+8, cy-34);
        ctx.lineTo(cx+8, cy+24); ctx.lineTo(cx-8, cy+24);
        ctx.closePath(); ctx.fill();

        // Tip
        ctx.fillStyle = 'rgb(220,180,100)';
        ctx.beginPath();
        ctx.moveTo(cx-8, cy+24); ctx.lineTo(cx+8, cy+24); ctx.lineTo(cx, cy+40);
        ctx.closePath(); ctx.fill();

        // Eraser
        ctx.fillStyle = 'rgb(220,100,100)';
        ctx.beginPath(); ctx.roundRect(cx-8, cy-44, 16, 10, 2); ctx.fill();

        // Body lines
        ctx.strokeStyle = 'rgba(18,18,28,0.7)'; ctx.lineWidth = 1;
        for (const dy of [-20, -8, 4]) _stroke(cx-6, cy+dy, cx+6, cy+dy);

        // Gear
        const [gcx, gcy, gr] = [cx + 28, cy - 10, 14];
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(gcx, gcy, gr, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(gcx, gcy, 5, 0, Math.PI*2); ctx.fill();
        ctx.lineWidth = 3;
        for (let a = 0; a < 360; a += 45) {
            const r = (Math.PI / 180) * a;
            _stroke(gcx+(gr-2)*Math.cos(r), gcy+(gr-2)*Math.sin(r),
                    gcx+(gr+4)*Math.cos(r), gcy+(gr+4)*Math.sin(r));
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function _stroke(x1, y1, x2, y2) {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }

    return { enter, update, draw, handleKey, handleClick, handleMouseMove };
}

function _hit(r, x, y) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
