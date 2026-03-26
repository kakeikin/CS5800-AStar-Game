"""Main menu – horizontal three-button layout with full mouse support."""
import math
import pygame
from src.states.base_state import BaseState
from src.config import (
    SCREEN_WIDTH, SCREEN_HEIGHT,
    UI_BG, UI_PANEL, UI_BORDER, UI_TEXT, UI_HEADING, UI_SUBTEXT,
    UI_HIGHLIGHT, UI_SUCCESS, ASTAR_MAN_COL, ASTAR_EUC_COL, DIJKSTRA_COL,
    font,
)

# ── Button layout constants ───────────────────────────────────────────────────
_BTN_W   = 210
_BTN_H   = 240
_BTN_GAP = 50
_BTN_TOP = (SCREEN_HEIGHT - _BTN_H) // 2 - 20   # vertical centre with offset for title
_TOTAL_W = 3 * _BTN_W + 2 * _BTN_GAP
_BTN_X0  = (SCREEN_WIDTH - _TOTAL_W) // 2

_BUTTONS = [
    {"label": "Tutorial", "sublabel": "Learn A* step by step", "state": "TUTORIAL", "key": pygame.K_t},
    {"label": "Maze",     "sublabel": "Race through 4 layers", "state": "MAZE_L1",  "key": pygame.K_1},
    {"label": "Custom",   "sublabel": "Coming soon…",          "state": "CUSTOM",   "key": pygame.K_c},
]


class MenuState(BaseState):

    def enter(self) -> None:
        self._hover   = -1   # index of hovered button (-1 = none)
        self._anim    = 0.0
        # Build rects for hit-testing
        self._rects = [
            pygame.Rect(_BTN_X0 + i * (_BTN_W + _BTN_GAP), _BTN_TOP, _BTN_W, _BTN_H)
            for i in range(len(_BUTTONS))
        ]

    # ── Events ────────────────────────────────────────────────────────────────

    def handle_event(self, event: pygame.event.Event) -> None:
        if event.type == pygame.MOUSEMOTION:
            self._hover = -1
            for i, r in enumerate(self._rects):
                if r.collidepoint(event.pos):
                    self._hover = i
                    break

        elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            for i, r in enumerate(self._rects):
                if r.collidepoint(event.pos):
                    self._go(_BUTTONS[i]["state"])
                    return

        elif event.type == pygame.KEYDOWN:
            for btn in _BUTTONS:
                if event.key == btn["key"]:
                    self._go(btn["state"])
                    return
            # ESC / Q quits to OS level is intentionally not handled here.

    # ── Update ────────────────────────────────────────────────────────────────

    def update(self, dt: float) -> None:
        self._anim += dt

    # ── Draw ──────────────────────────────────────────────────────────────────

    def draw(self) -> None:
        s = self.screen
        s.fill(UI_BG)

        # ── Animated background grid dots ─────────────────────────────────
        t = self._anim
        for gx in range(0, SCREEN_WIDTH, 60):
            for gy in range(0, SCREEN_HEIGHT, 60):
                alpha = int(30 + 20 * math.sin(t + gx * 0.05 + gy * 0.05))
                pygame.draw.circle(s, (alpha, alpha, alpha + 20), (gx, gy), 1)

        # ── Title ─────────────────────────────────────────────────────────
        cx = SCREEN_WIDTH // 2
        title_cn = font("cn_xl").render("算法之路", True, UI_HEADING)
        title_en = font("title").render("The Path of Algorithms", True, (180, 180, 200))
        sub      = font("body").render("A*  vs  Dijkstra  ·  Interactive Maze Learning", True, UI_SUBTEXT)
        s.blit(title_cn, (cx - title_cn.get_width() // 2, 60))
        s.blit(title_en, (cx - title_en.get_width() // 2, 106))
        s.blit(sub,      (cx - sub.get_width()     // 2, 140))

        # Decorative algorithm badges
        badges = [
            ("Dijkstra  h=0",            DIJKSTRA_COL),
            ("A* Manhattan  h=|Δx|+|Δy|", ASTAR_MAN_COL),
            ("A* Euclidean  h=√(Δx²+Δy²)", ASTAR_EUC_COL),
        ]
        bx = cx - 370
        for label, col in badges:
            bs = font("small").render(label, True, col)
            pygame.draw.rect(s, (*col, 40), (bx - 4, 168, bs.get_width() + 8, 20),
                             border_radius=3)
            s.blit(bs, (bx, 168))
            bx += bs.get_width() + 24

        # ── Three main buttons ─────────────────────────────────────────────
        for i, (btn, rect) in enumerate(zip(_BUTTONS, self._rects)):
            self._draw_button(s, i, btn, rect)

        # ── Key hints below buttons ────────────────────────────────────────
        hint_y = _BTN_TOP + _BTN_H + 20
        hint = font("small").render(
            "Click a button  ·  or press  [T] Tutorial   [1] Maze   [C] Custom",
            True, UI_SUBTEXT,
        )
        s.blit(hint, (cx - hint.get_width() // 2, hint_y))

        # ── Collected tomes ────────────────────────────────────────────────
        if self.game_data.get("tomes"):
            ty = SCREEN_HEIGHT - 38
            ts = font("small").render("Unlocked:", True, UI_HEADING)
            s.blit(ts, (30, ty))
            tx = 30 + ts.get_width() + 10
            for tome in self.game_data["tomes"]:
                col = ASTAR_MAN_COL if tome == "manhattan" else ASTAR_EUC_COL
                ls  = font("small").render(tome.capitalize() + " Tome ✦", True, col)
                s.blit(ls, (tx, ty))
                tx += ls.get_width() + 14

    # ── Single button draw ────────────────────────────────────────────────────

    def _draw_button(self, s, idx, btn, rect):
        hovered = (self._hover == idx)
        pulse   = 0.5 + 0.5 * math.sin(self._anim * 2 + idx * 1.2)

        # Background
        base_col = (45, 45, 68) if hovered else (30, 30, 48)
        pygame.draw.rect(s, base_col, rect, border_radius=16)

        # Glowing border on hover
        border_col = UI_HIGHLIGHT if hovered else UI_BORDER
        if hovered:
            # Outer glow
            glow_r = pygame.Rect(rect.x - 2, rect.y - 2, rect.w + 4, rect.h + 4)
            pygame.draw.rect(s, (*UI_HIGHLIGHT, int(60 + 40 * pulse)),
                             glow_r, width=2, border_radius=18)
        pygame.draw.rect(s, border_col, rect, width=2, border_radius=16)

        # Icon area (top 130 px of button)
        icon_cx = rect.centerx
        icon_cy = rect.y + 75

        if idx == 0:        # Tutorial – book icon
            _draw_book_icon(s, icon_cx, icon_cy, hovered)
        elif idx == 1:      # Maze – mini maze icon
            _draw_maze_icon(s, icon_cx, icon_cy, hovered)
        else:               # Custom – pencil + gear icon
            _draw_custom_icon(s, icon_cx, icon_cy, hovered)

        # Main label
        lbl_surf = font("heading").render(btn["label"], True,
                                          UI_HEADING if hovered else UI_TEXT)
        s.blit(lbl_surf, (icon_cx - lbl_surf.get_width() // 2, rect.y + 152))

        # Sublabel / description
        sub_surf = font("small").render(btn["sublabel"], True,
                                        UI_HIGHLIGHT if hovered else UI_SUBTEXT)
        s.blit(sub_surf, (icon_cx - sub_surf.get_width() // 2, rect.y + 184))

        # Key hint chip
        key_labels = {"TUTORIAL": "[T]", "MAZE_L1": "[1]", "CUSTOM": "[C]"}
        kl = font("tiny").render(key_labels.get(btn["state"], ""), True, UI_SUBTEXT)
        s.blit(kl, (icon_cx - kl.get_width() // 2, rect.y + 214))


# ── Icon drawing helpers ───────────────────────────────────────────────────────

def _draw_book_icon(s, cx, cy, hovered):
    col = ASTAR_MAN_COL if hovered else (160, 140, 100)
    # Left page
    pygame.draw.rect(s, col, (cx - 38, cy - 30, 36, 50), border_radius=3)
    # Right page
    pygame.draw.rect(s, col, (cx + 2,  cy - 30, 36, 50), border_radius=3)
    # Spine
    pygame.draw.rect(s, UI_BG, (cx - 3, cy - 30, 6, 50))
    pygame.draw.rect(s, (*col, 150), (cx - 3, cy - 30, 6, 50))
    # Page lines
    page_line = (UI_BG[0], UI_BG[1], UI_BG[2])
    for dy in (0, 10, 20):
        pygame.draw.line(s, page_line, (cx - 34, cy - 18 + dy), (cx - 6, cy - 18 + dy), 2)
        pygame.draw.line(s, page_line, (cx + 6,  cy - 18 + dy), (cx + 34, cy - 18 + dy), 2)
    # A* star label on right page
    star = font("small").render("A*", True, UI_BG)
    s.blit(star, (cx + 14, cy + 4))


def _draw_maze_icon(s, cx, cy, hovered):
    """Draw a tiny 5×5 maze grid with a winding highlighted path."""
    col_wall  = ASTAR_MAN_COL if hovered else (100, 160, 100)
    col_path  = UI_SUCCESS     if hovered else (60, 140, 60)
    cell = 10
    ox   = cx - 2 * cell - cell // 2
    oy   = cy - 2 * cell - cell // 2
    # Draw grid outline
    pygame.draw.rect(s, col_wall, (ox - 1, oy - 1, 5 * cell + 2, 5 * cell + 2), 2)
    # Internal walls (hand-crafted to look maze-like)
    walls = [
        # horizontal walls (block going down)
        ((0,0),(1,0)), ((2,0),(3,0)),
        ((1,1),(2,1)), ((3,1),(4,1)),
        ((0,2),(0,3)), ((2,2),(2,3)),((4,2),(4,3)),
        ((1,3),(2,3)), ((3,3),(3,4)),
    ]
    for (c1,r1),(c2,r2) in walls:
        x1 = ox + c1 * cell; y1 = oy + r1 * cell
        x2 = ox + c2 * cell; y2 = oy + r2 * cell
        pygame.draw.line(s, col_wall, (x1, y1), (x2, y2), 2)
    # Path (start bottom-left → end top-right)
    path_cells = [(0,4),(0,3),(1,3),(1,2),(2,2),(2,1),(3,1),(3,0),(4,0)]
    for c, r in path_cells:
        pygame.draw.rect(s, col_path,
                         (ox + c*cell+2, oy + r*cell+2, cell-4, cell-4), border_radius=2)
    # Start / end dots
    pygame.draw.circle(s, START_COLOR, (ox + 0*cell + cell//2, oy + 4*cell + cell//2), 4)
    pygame.draw.circle(s, END_COLOR,   (ox + 4*cell + cell//2, oy + 0*cell + cell//2), 4)


def _draw_custom_icon(s, cx, cy, hovered):
    col = ASTAR_EUC_COL if hovered else (120, 120, 160)
    # Pencil body
    body_pts = [
        (cx - 8, cy - 34), (cx + 8, cy - 34),
        (cx + 8, cy + 24), (cx - 8, cy + 24),
    ]
    pygame.draw.polygon(s, col, body_pts)
    # Pencil tip
    tip_pts = [(cx - 8, cy + 24), (cx + 8, cy + 24), (cx, cy + 40)]
    pygame.draw.polygon(s, (220, 180, 100), tip_pts)
    # Eraser
    pygame.draw.rect(s, (220, 100, 100), (cx - 8, cy - 44, 16, 10), border_radius=2)
    # Lines on pencil body
    for dy in (-20, -8, 4):
        pygame.draw.line(s, (*UI_BG, 180), (cx - 6, cy + dy), (cx + 6, cy + dy), 1)
    # Gear/cog to the right of pencil
    gcx, gcy, gr = cx + 28, cy - 10, 14
    pygame.draw.circle(s, col, (gcx, gcy), gr, 2)
    pygame.draw.circle(s, col, (gcx, gcy), 5)
    for a in range(0, 360, 45):
        rad = math.radians(a)
        gx1 = gcx + int((gr - 2) * math.cos(rad))
        gy1 = gcy + int((gr - 2) * math.sin(rad))
        gx2 = gcx + int((gr + 4) * math.cos(rad))
        gy2 = gcy + int((gr + 4) * math.sin(rad))
        pygame.draw.line(s, col, (gx1, gy1), (gx2, gy2), 3)


# Bring colours into scope for icon drawing
from src.config import START_COLOR, END_COLOR  # noqa: E402
