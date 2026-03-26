"""Tutorial State – two-phase player-controlled flow.

Phase A  "manual"       – Blind run. Fog active, player navigates with arrow keys.
                          Timer + step counter run live.  On reaching exit → freeze stats.
Transition "manual_done" – Show frozen Phase-A stats + clickable A* Wisdom Tome button.
Phase B  "guided"       – Player still controls movement, but the A* path projection
                          (full golden glow) is recomputed on every move.
                          Separate step counter + timer reset to zero.
Phase    "comparison"   – Modal popup: Manual Steps vs A*-Guided Steps + insight.
"""

import math
import random
import time
import pygame

from src.states.base_state import BaseState
from src.maze              import generate_square_maze, SquareGrid
from src.algorithms        import AStarManhattan
from src.entities          import Player
from src.ui.renderer       import draw_square_maze, update_fog, sq_cell_rect
from src.config import (
    GRID_COLS, GRID_ROWS, FOG_REVEAL_RADIUS,
    CELL_SIZE,
    SIDEBAR_X, SIDEBAR_WIDTH, SCREEN_HEIGHT, MAZE_AREA_WIDTH,
    UI_BG, UI_PANEL, UI_BORDER, UI_TEXT, UI_HEADING, UI_SUBTEXT,
    UI_SUCCESS, UI_WARNING, UI_HIGHLIGHT, UI_DANGER,
    ASTAR_MAN_COL, PLAYER_COLOR,
    font,
)

_START = (0, GRID_ROWS - 1)   # bottom-left
_END   = (GRID_COLS - 1, 0)   # top-right

# ── Colours for path-projection glow ─────────────────────────────────────────
_GLOW_COL      = ASTAR_MAN_COL          # (255, 220, 30)  warm yellow
_GLOW_NEXT_COL = (255, 245, 120)        # slightly brighter for the first 3 steps


class TutorialState(BaseState):

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def enter(self) -> None:
        seed          = random.randint(0, 9999)
        passages      = generate_square_maze(GRID_COLS, GRID_ROWS, seed)
        self.grid     = SquareGrid(passages)
        self.player   = Player(_START)
        self.revealed : set = set()
        self._anim    = 0.0       # drives the pulse animation

        # ── Phase A (blind run) ───────────────────────────────────────────────
        self._phase     = "manual"
        self._man_start = time.time()
        self._man_steps = 0
        self._man_time  = 0.0

        # ── Phase B (guided run) ──────────────────────────────────────────────
        self._guide_start  : float = 0.0
        self._guided_steps : int   = 0
        self._guided_time  : float = 0.0   # frozen after phase B ends
        self._guide_path   : list  = []    # full A* path from player.pos → _END

        # ── UI state ──────────────────────────────────────────────────────────
        self._tome_rect   : pygame.Rect | None = None
        self._popup_btns  : list = []

        # Optimal path length (computed once, used in comparison)
        _astar = AStarManhattan()
        opt, _, _ = _astar.find_path(self.grid, _START, _END)
        self._optimal_steps = max(0, len(opt) - 1)

        update_fog(self.revealed, _START, self.grid.passages, FOG_REVEAL_RADIUS)

    # ── Events ────────────────────────────────────────────────────────────────

    def handle_event(self, event: pygame.event.Event) -> None:
        if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
            self._go("MENU"); return

        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            self._on_click(event.pos); return

        if event.type == pygame.KEYDOWN:
            delta = _arrow_to_delta(event.key)
            if delta:
                if self._phase == "manual":
                    self._move_manual(delta)
                elif self._phase == "guided":
                    self._move_guided(delta)

    def _on_click(self, pos: tuple) -> None:
        if self._phase == "manual_done":
            if self._tome_rect and self._tome_rect.collidepoint(pos):
                self._begin_guided()

        elif self._phase == "comparison":
            for rect, target in self._popup_btns:
                if rect.collidepoint(pos):
                    if target == "MAZE_L1":
                        if "manhattan" not in self.game_data["tomes"]:
                            self.game_data["tomes"].append("manhattan")
                        if "TUTORIAL" not in self.game_data["completed_levels"]:
                            self.game_data["completed_levels"].append("TUTORIAL")
                    self._go(target)
                    return

    # ── Movement – Phase A ────────────────────────────────────────────────────

    def _move_manual(self, delta: tuple) -> None:
        new_pos = _neighbour(self.player.pos, delta)
        if not self.grid.is_passage(self.player.pos, new_pos):
            return
        self.player.move(new_pos)
        update_fog(self.revealed, new_pos, self.grid.passages, FOG_REVEAL_RADIUS)
        if new_pos == _END:
            self._man_steps = self.player.steps
            self._man_time  = time.time() - self._man_start
            self._phase     = "manual_done"

    # ── Transition: Phase A → Phase B ─────────────────────────────────────────

    def _begin_guided(self) -> None:
        """Reset player, reset fog to start-only, activate A* projection."""
        self.player.reset(_START)
        self.revealed = set()                                           # wipe Phase-A fog
        update_fog(self.revealed, _START, self.grid.passages, FOG_REVEAL_RADIUS)
        self._guide_start  = time.time()
        self._guided_steps = 0
        self._guide_path   = []
        self._phase        = "guided"
        self._recompute_guide()   # first projection from start

    # ── Movement – Phase B ────────────────────────────────────────────────────

    def _move_guided(self, delta: tuple) -> None:
        new_pos = _neighbour(self.player.pos, delta)
        if not self.grid.is_passage(self.player.pos, new_pos):
            return
        self.player.move(new_pos)
        self._guided_steps += 1
        update_fog(self.revealed, new_pos, self.grid.passages, FOG_REVEAL_RADIUS)

        if new_pos == _END:
            self._guided_time = time.time() - self._guide_start
            self._guide_path  = []
            self._phase       = "comparison"
            return

        # Always recompute – adaptive to any deviation from the suggested path
        self._recompute_guide()

    def _recompute_guide(self) -> None:
        """Run A* from current position to exit and cache the path."""
        astar = AStarManhattan()
        path, _, _ = astar.find_path(self.grid, self.player.pos, _END)
        # Drop the first node (= current position); rest is the projection
        self._guide_path = path[1:] if len(path) > 1 else []

    # ── Update ────────────────────────────────────────────────────────────────

    def update(self, dt: float) -> None:
        self._anim += dt

    # ── Draw ──────────────────────────────────────────────────────────────────

    def draw(self) -> None:
        self.screen.fill(UI_BG)

        # 1. Draw the maze (floor, fog, walls, player, start/end)
        draw_square_maze(
            self.screen,
            self.grid.passages,
            self.revealed,
            self.player.pos,
            _START, _END,
        )

        # 2. Draw A* path projection ON TOP (Phase B only)
        if self._phase == "guided" and self._guide_path:
            self._draw_guide_projection()

        # 3. Sidebar
        self._draw_sidebar()

        # 4. Comparison popup (Phase comparison)
        if self._phase == "comparison":
            self._draw_comparison_popup()

    # ── Dynamic A* Path Projection ────────────────────────────────────────────

    def _draw_guide_projection(self) -> None:
        """
        Render ONLY the single next A* step as a pulsing golden glow.

        Fog of War is preserved – the full path is NOT shown.  Only the one
        adjacent tile the player should move to next is highlighted.  Because
        that tile is always within the player's fog-reveal radius (Chebyshev 1),
        the glow is always visible inside the already-lit area.

        Visual layers (all SRCALPHA so they sit cleanly on top of the fog):
          • Soft square fill   – fills the entire cell with a warm amber tint
          • Pulsing circle     – bright golden orb, radius breathes with _anim
          • Outer ring         – crisp halo ring to draw the eye
          • "→" arrow label   – tiny directional cue in the centre
        """
        if not self._guide_path:
            return

        next_pos = self._guide_path[0]
        if next_pos == _END:
            return

        pulse = 0.5 + 0.5 * math.sin(self._anim * 3.2)   # 0 … 1,  ~3 Hz
        rect  = sq_cell_rect(*next_pos)
        cx    = rect.x + CELL_SIZE // 2
        cy    = rect.y + CELL_SIZE // 2

        # ── Layer 1: warm amber cell fill ─────────────────────────────────
        fill_surf = pygame.Surface((CELL_SIZE, CELL_SIZE), pygame.SRCALPHA)
        fill_surf.fill((*_GLOW_COL, int(55 + 35 * pulse)))   # 55 … 90
        self.screen.blit(fill_surf, rect.topleft)

        # ── Layer 2: central glowing orb ──────────────────────────────────
        r_circ    = max(6, int(CELL_SIZE * 0.30 + 5 * pulse))
        circ_surf = pygame.Surface((CELL_SIZE, CELL_SIZE), pygame.SRCALPHA)
        pygame.draw.circle(
            circ_surf,
            (*_GLOW_COL, int(170 + 70 * pulse)),   # 170 … 240
            (CELL_SIZE // 2, CELL_SIZE // 2),
            r_circ,
        )
        self.screen.blit(circ_surf, rect.topleft)

        # ── Layer 3: outer halo ring ───────────────────────────────────────
        pad       = 8                                # ring surface padding
        ring_r    = r_circ + int(5 + 4 * pulse)
        ring_surf = pygame.Surface((CELL_SIZE + pad * 2, CELL_SIZE + pad * 2),
                                   pygame.SRCALPHA)
        pygame.draw.circle(
            ring_surf,
            (*_GLOW_NEXT_COL, int(110 + 100 * pulse)),   # 110 … 210
            ((CELL_SIZE + pad * 2) // 2, (CELL_SIZE + pad * 2) // 2),
            ring_r,
            2,    # ring thickness
        )
        self.screen.blit(ring_surf, (rect.x - pad, rect.y - pad))

        # ── Layer 4: tiny arrow label in the centre ────────────────────────
        arrow = font("tiny").render("→", True, (30, 20, 0))
        self.screen.blit(
            arrow,
            (cx - arrow.get_width() // 2, cy - arrow.get_height() // 2),
        )

    # ── Sidebar ───────────────────────────────────────────────────────────────

    def _draw_sidebar(self) -> None:
        s  = self.screen
        sx, sw, sh = SIDEBAR_X, SIDEBAR_WIDTH, SCREEN_HEIGHT
        pygame.draw.rect(s, UI_BG,    (sx, 0, sw, sh))
        pygame.draw.line(s, UI_BORDER, (sx, 0), (sx, sh), 2)
        x, y, w = sx + 10, 12, sw - 20

        # ── Title ─────────────────────────────────────────────────────────
        title = font("heading").render("Tutorial", True, UI_HEADING)
        s.blit(title, (sx + (sw - title.get_width()) // 2, y))
        y += title.get_height() + 4
        pygame.draw.line(s, UI_HEADING, (x, y), (x + w, y), 1); y += 8

        # ── Per-phase content ─────────────────────────────────────────────
        if self._phase == "manual":
            y = self._sidebar_manual(s, x, y, w)

        elif self._phase == "manual_done":
            y = self._sidebar_manual_done(s, x, y, w)

        elif self._phase == "guided":
            y = self._sidebar_guided(s, x, y, w)

        elif self._phase == "comparison":
            y = self._stat_block(s, x, y, w, "Phase A – Blind Run",
                                 self._man_steps, self._man_time, UI_SUBTEXT)
            y += 6
            y = self._stat_block(s, x, y, w, "Phase B – A*-Guided",
                                 self._guided_steps, self._guided_time, UI_SUCCESS)

    # ── Sidebar sub-renderers ─────────────────────────────────────────────────

    def _sidebar_manual(self, s, x, y, w) -> int:
        # Running phase label
        lbl = font("small").render("▶  Phase A – Blind Run", True, UI_WARNING)
        s.blit(lbl, (x, y)); y += lbl.get_height() + 8

        # Live stats
        elapsed = time.time() - self._man_start
        y = self._stat_block(s, x, y, w, "Manual Run",
                             self.player.steps, elapsed, PLAYER_COLOR)
        y += 10

        # Instructions
        for line in [
            "Arrow keys to move",
            "Reach the GREEN exit",
            "Fog hides the maze – explore!",
            "ESC → Main Menu",
        ]:
            ls = font("small").render(line, True, UI_SUBTEXT)
            s.blit(ls, (x, y)); y += ls.get_height() + 4
        return y

    def _sidebar_manual_done(self, s, x, y, w) -> int:
        # Done label
        lbl = font("small").render("✓  Phase A Complete!", True, UI_SUCCESS)
        s.blit(lbl, (x, y)); y += lbl.get_height() + 8

        # Frozen stats
        y = self._stat_block(s, x, y, w, "Your Blind Run",
                             self._man_steps, self._man_time, UI_SUCCESS)
        y += 14

        # Tome button
        y = self._draw_tome_button(s, x, y, w)

        # Teaser
        note = font("small").render(
            "Can A* beat your record?", True, UI_SUBTEXT)
        s.blit(note, (x + (w - note.get_width()) // 2, y)); y += note.get_height() + 4
        return y

    def _sidebar_guided(self, s, x, y, w) -> int:
        # Phase label
        lbl = font("small").render("▶  Phase B – A*-Guided Run", True, ASTAR_MAN_COL)
        s.blit(lbl, (x, y)); y += lbl.get_height() + 8

        # Phase A frozen (dimmed)
        y = self._stat_block(s, x, y, w, "Phase A (done)",
                             self._man_steps, self._man_time, UI_SUBTEXT)
        y += 6

        # Phase B live
        elapsed = time.time() - self._guide_start
        y = self._stat_block(s, x, y, w, "Phase B – live",
                             self._guided_steps, elapsed, ASTAR_MAN_COL)
        y += 10

        # Algorithm card
        pygame.draw.rect(s, UI_PANEL, (x, y, w, 60), border_radius=5)
        pygame.draw.rect(s, ASTAR_MAN_COL, (x, y, 4, 60), border_radius=2)
        ns = font("body").render("A* Manhattan",  True, ASTAR_MAN_COL)
        fs = font("small").render("f(n) = g(n) + h(n)",    True, UI_HIGHLIGHT)
        hs = font("small").render("h(n) = |Δx| + |Δy|",   True, UI_SUBTEXT)
        s.blit(ns, (x+10, y+4)); s.blit(fs, (x+10, y+24)); s.blit(hs, (x+10, y+42))
        y += 64

        # Pedagogical note (word-wrapped manually)
        pygame.draw.line(s, UI_BORDER, (x, y), (x + w, y), 1); y += 6
        for line in [
            "The  ● glow marks your",
            "single best next step.",
            "",
            "Fog stays – explore just",
            "like before, but let A*",
            "hint one move at a time.",
            "",
            "Detour → glow instantly",
            "shifts to the new best",
            "next step.",
        ]:
            if line:
                ls = font("tiny").render(line, True, UI_SUBTEXT)
                s.blit(ls, (x, y))
            y += 16
        return y

    # ── Reusable widgets ──────────────────────────────────────────────────────

    def _stat_block(self, s, x, y, w, label, steps, elapsed, color) -> int:
        pygame.draw.rect(s, UI_PANEL, (x, y, w, 76), border_radius=6)
        pygame.draw.rect(s, color,    (x, y, 4, 76), border_radius=3)
        s.blit(font("small").render(label,               True, color),   (x+10, y+4))
        s.blit(font("body").render(f"Steps : {steps}",  True, UI_TEXT), (x+10, y+24))
        s.blit(font("body").render(f"Time  : {elapsed:.1f}s", True, UI_TEXT), (x+10, y+48))
        return y + 80

    def _draw_tome_button(self, s, x, y, w) -> int:
        """A* Wisdom Tome – clickable button. Stores rect for hit-testing."""
        bh   = 72
        rect = pygame.Rect(x, y, w, bh)
        self._tome_rect = rect

        mx, my  = pygame.mouse.get_pos()
        hovered = rect.collidepoint(mx, my)
        pulse   = 0.5 + 0.5 * math.sin(self._anim * 2.5)

        bg  = (60, 54, 22) if hovered else (42, 38, 16)
        bdr = _GLOW_COL    if hovered else (130, 110, 45)
        pygame.draw.rect(s, bg,  rect, border_radius=8)
        pygame.draw.rect(s, bdr, rect, width=2, border_radius=8)

        # Pulsing outer glow when hovered
        if hovered:
            g = pygame.Rect(x-2, y-2, w+4, bh+4)
            pygame.draw.rect(s, (*_GLOW_COL, int(40 + 40*pulse)),
                             g, width=2, border_radius=10)

        # Book icon (left side)
        bx, by2 = x + 12, y + 12
        pygame.draw.rect(s, _GLOW_COL, (bx,      by2, 18, 26), border_radius=2)
        pygame.draw.rect(s, (30,25,10),(bx + 8,  by2, 2,  26))
        pygame.draw.rect(s, _GLOW_COL, (bx + 10, by2, 18, 26), border_radius=2)
        for dy in (5, 11, 17):
            pygame.draw.line(s, UI_BG, (bx+2,   by2+dy), (bx+6,   by2+dy), 1)
            pygame.draw.line(s, UI_BG, (bx+12,  by2+dy), (bx+26,  by2+dy), 1)

        # Text
        t1 = font("body").render("A* Wisdom Tome", True,
                                 _GLOW_COL if hovered else (200, 175, 80))
        t2 = font("small").render("Click to begin guided run →", True,
                                  UI_TEXT if hovered else UI_SUBTEXT)
        s.blit(t1, (x + 42, y + 10))
        s.blit(t2, (x + 42, y + 38))
        return y + bh + 10

    # ── Comparison popup ──────────────────────────────────────────────────────

    def _draw_comparison_popup(self) -> None:
        self._popup_btns = []
        s  = self.screen
        pw, ph = 660, 440
        px = (MAZE_AREA_WIDTH - pw) // 2
        py = (SCREEN_HEIGHT   - ph) // 2

        # Dark backdrop
        backdrop = pygame.Surface((MAZE_AREA_WIDTH, SCREEN_HEIGHT), pygame.SRCALPHA)
        backdrop.fill((0, 0, 0, 185))
        s.blit(backdrop, (0, 0))

        # Popup box
        popup = pygame.Rect(px, py, pw, ph)
        pygame.draw.rect(s, (24, 24, 38), popup, border_radius=14)
        pygame.draw.rect(s, UI_HEADING,   popup, width=2, border_radius=14)

        # ── Title ─────────────────────────────────────────────────────────
        title = font("heading").render("Performance Comparison Report", True, UI_HEADING)
        s.blit(title, (px + (pw - title.get_width()) // 2, py + 14))

        # ── Column layout ─────────────────────────────────────────────────
        col_w  = (pw - 60) // 2
        lx     = px + 20             # left column x
        rx     = px + 20 + col_w + 20 # right column x
        mid_x  = px + pw // 2

        # Headers
        lh = font("small").render("Phase A – Blind Run",    True, PLAYER_COLOR)
        rh = font("small").render("Phase B – A*-Guided Run",True, ASTAR_MAN_COL)
        s.blit(lh, (lx + (col_w - lh.get_width()) // 2, py + 52))
        s.blit(rh, (rx + (col_w - rh.get_width()) // 2, py + 52))

        pygame.draw.line(s, UI_BORDER, (mid_x, py + 48), (mid_x, py + 310), 1)
        pygame.draw.line(s, UI_BORDER, (px+16, py + 78), (px+pw-16, py + 78), 1)

        # ── Stat rows ─────────────────────────────────────────────────────
        man_s = self._man_steps
        man_t = self._man_time
        gui_s = self._guided_steps
        gui_t = self._guided_time

        rows = [
            ("Steps", f"{man_s}", f"{gui_s}", PLAYER_COLOR, ASTAR_MAN_COL),
            ("Time",  f"{man_t:.1f} s", f"{gui_t:.1f} s", PLAYER_COLOR, ASTAR_MAN_COL),
        ]
        ry = py + 90
        for label, lv, rv, lc, rc in rows:
            lb_s = font("small").render(label, True, UI_SUBTEXT)
            s.blit(lb_s, (mid_x - lb_s.get_width() // 2, ry))
            lv_s = font("heading").render(lv, True, lc)
            rv_s = font("heading").render(rv, True, rc)
            s.blit(lv_s, (lx + (col_w - lv_s.get_width()) // 2, ry + 22))
            s.blit(rv_s, (rx + (col_w - rv_s.get_width()) // 2, ry + 22))
            ry += 78

        # ── Divider + insight ─────────────────────────────────────────────
        pygame.draw.line(s, UI_BORDER, (px+16, ry), (px+pw-16, ry), 1); ry += 12

        saved = man_s - gui_s
        if saved > 0:
            insight1 = f"By following the A* guidance, you saved {saved} step{'s' if saved!=1 else ''}!"
            insight_col = UI_SUCCESS
        elif saved == 0:
            insight1 = "You matched the A* guided path exactly — perfect!"
            insight_col = UI_SUCCESS
        else:
            insight1 = f"You took {-saved} extra step{'s' if saved!=-1 else ''} off the A* path."
            insight_col = UI_WARNING

        i1 = font("body").render(insight1, True, insight_col)
        s.blit(i1, (px + (pw - i1.get_width()) // 2, ry)); ry += i1.get_height() + 6

        # Optimal path note
        opt_note = font("small").render(
            f"Theoretical optimum (pure A*): {self._optimal_steps} steps  "
            f"│  Your guided run: {gui_s} steps",
            True, UI_SUBTEXT,
        )
        s.blit(opt_note, (px + (pw - opt_note.get_width()) // 2, ry)); ry += opt_note.get_height() + 4

        formula_note = font("small").render(
            "f(n) = g(n) + h(n)  ·  h(n) = |Δx|+|Δy|  →  A* always finds the global optimum.",
            True, UI_SUBTEXT,
        )
        s.blit(formula_note, (px + (pw - formula_note.get_width()) // 2, ry))

        # ── Buttons ───────────────────────────────────────────────────────
        btn_y = py + ph - 56
        btn_h = 40
        btn_w = 180
        mx, my = pygame.mouse.get_pos()
        btns = [
            (pygame.Rect(px + 30,              btn_y, btn_w, btn_h),
             "MENU",   "← Back to Menu",  UI_SUBTEXT),
            (pygame.Rect(px + pw - 30 - btn_w, btn_y, btn_w, btn_h),
             "MAZE_L1","Next Level →",    UI_SUCCESS),
        ]
        self._popup_btns = []
        for rect, target, label, color in btns:
            hov = rect.collidepoint(mx, my)
            pygame.draw.rect(s, (50,50,70) if hov else UI_PANEL, rect, border_radius=8)
            pygame.draw.rect(s, color, rect, width=2, border_radius=8)
            ls = font("body").render(label, True, color)
            s.blit(ls, (rect.x + (rect.w - ls.get_width())  // 2,
                        rect.y + (rect.h - ls.get_height()) // 2))
            self._popup_btns.append((rect, target))


# ── Helpers ───────────────────────────────────────────────────────────────────

def _neighbour(pos: tuple, delta: tuple) -> tuple:
    return (pos[0] + delta[0], pos[1] + delta[1])


def _arrow_to_delta(key) -> tuple | None:
    return {
        pygame.K_UP   : (0, -1),
        pygame.K_DOWN : (0,  1),
        pygame.K_LEFT : (-1, 0),
        pygame.K_RIGHT: ( 1, 0),
    }.get(key)
