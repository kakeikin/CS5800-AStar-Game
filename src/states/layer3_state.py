"""Layer 3 – The Hexagon.

10×10 hex maze. Player chooses Manhattan (Yellow) or Euclidean (Red) A*.
Dijkstra monster races them.

Hex controls (V-shape cluster):
    U   I       ← NW / NE
   H     K      ← W  / E
    N   M       ← SW / SE
"""
import random
import pygame
from src.states.base_state import BaseState
from src.maze    import generate_hex_maze, HexGrid
from src.algorithms import AStarManhattan, AStarEuclidean, Dijkstra
from src.entities   import Player, Monster
from src.ui.renderer import draw_hex_maze, update_fog
from src.ui.sidebar  import draw_sidebar
from src.config import (
    GRID_COLS, GRID_ROWS, FOG_REVEAL_RADIUS,
    HEX_NBR_EVEN, HEX_NBR_ODD,
    SIDEBAR_X, SIDEBAR_WIDTH, SCREEN_HEIGHT, MAZE_AREA_WIDTH,
    UI_BG, UI_PANEL, UI_BORDER, UI_TEXT, UI_HEADING, UI_SUBTEXT,
    UI_SUCCESS, UI_HIGHLIGHT,
    ASTAR_MAN_COL, ASTAR_EUC_COL, DIJKSTRA_COL,
    font,
)

_START = (0, GRID_ROWS - 1)
_END   = (GRID_COLS - 1, 0)

# ── Hex key → direction index (0=NE,1=E,2=SE,3=SW,4=W,5=NW) ─────────────────
_HEX_KEY_DIR = {
    pygame.K_i: 0,   # NE
    pygame.K_k: 1,   # E
    pygame.K_m: 2,   # SE
    pygame.K_n: 3,   # SW
    pygame.K_h: 4,   # W
    pygame.K_u: 5,   # NW
}

_CONTROLS_TEXT = [
    "── Hex Controls ──",
    "  U / I   → NW / NE",
    "  H / K   → W  / E",
    "  N / M   → SW / SE",
    "ESC → re-choose heuristic",
]


class Layer3State(BaseState):

    def enter(self) -> None:
        self._phase  = "choose"
        self._algo_key = None
        self._anim   = 0.0
        # Mouse-clickable algo rects (set in draw)
        self._choose_rects: list = []

    def _start_race(self, algo_key: str) -> None:
        seed     = random.randint(0, 9999)
        passages = generate_hex_maze(GRID_COLS, GRID_ROWS, seed)
        self._grid   = HexGrid(passages)

        self.player  = Player(_START)
        self.monster = Monster(_START, Dijkstra(), (220,70,50), "Dijkstra")
        self.revealed= set()

        if algo_key == "manhattan":
            self._algo      = AStarManhattan()
            self._algo_key  = "manhattan"
            self._guide_col = ASTAR_MAN_COL
        else:
            self._algo      = AStarEuclidean()
            self._algo_key  = "euclidean"
            self._guide_col = ASTAR_EUC_COL

        self.monster.compute_path(self._grid, _END)

        self._player_turn = True
        self._winner      = None
        self._guide_path  : list = []
        self._phase       = "race"
        self._result_btns : list = []

        update_fog(self.revealed, _START, self._grid.passages, FOG_REVEAL_RADIUS)
        self._refresh_guide()

    def _refresh_guide(self) -> None:
        path, _, _ = self._algo.find_path(self._grid, self.player.pos, _END)
        self._guide_path = path[1:3]

    # ── Events ────────────────────────────────────────────────────────────────

    def handle_event(self, event: pygame.event.Event) -> None:
        # Mouse clicks
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if self._phase == "choose":
                for rect, key in self._choose_rects:
                    if rect.collidepoint(event.pos):
                        self._start_race(key)
                        return
            elif self._phase == "race" and self._winner:
                for rect, target in self._result_btns:
                    if rect.collidepoint(event.pos):
                        self._go(target); return

        if event.type != pygame.KEYDOWN:
            return

        if event.key == pygame.K_ESCAPE:
            if self._phase == "race":
                self._phase = "choose"
            else:
                self._go("MENU")
            return

        if self._phase == "choose":
            if event.key == pygame.K_m:
                self._start_race("manhattan")
            elif event.key == pygame.K_e:
                self._start_race("euclidean")

        elif self._phase == "race":
            if self._winner:
                if event.key in (pygame.K_RETURN, pygame.K_SPACE):
                    self._go("MAZE_L4")
                return
            if not self._player_turn:
                return
            direction = _HEX_KEY_DIR.get(event.key)
            if direction is not None:
                self._player_move_hex(direction)

    def _player_move_hex(self, direction: int) -> None:
        c, r    = self.player.pos
        offsets = HEX_NBR_ODD if r % 2 == 1 else HEX_NBR_EVEN
        dc, dr  = offsets[direction]
        new_pos = (c + dc, r + dr)
        if not self._grid.is_passage(self.player.pos, new_pos):
            return
        self.player.move(new_pos)
        update_fog(self.revealed, new_pos, self._grid.passages, FOG_REVEAL_RADIUS)
        self._refresh_guide()
        if new_pos == _END:
            self._winner = "Player"; return
        self._player_turn = False
        self.monster.advance()
        if self.monster.pos == _END:
            self._winner = "Dijkstra"; return
        self._player_turn = True

    # ── Update ────────────────────────────────────────────────────────────────

    def update(self, dt: float) -> None:
        self._anim += dt

    # ── Draw ──────────────────────────────────────────────────────────────────

    def draw(self) -> None:
        self.screen.fill(UI_BG)

        if self._phase == "choose":
            self._draw_choose()
            return

        draw_hex_maze(
            self.screen,
            self._grid.passages,
            self.revealed,
            self.player.pos,
            _START, _END,
            monsters    = [self.monster],
            guide_path  = self._guide_path,
            guide_color = self._guide_col,
        )

        self._draw_race_sidebar()

        if self._winner:
            self._draw_result()

    # ── Choose screen ─────────────────────────────────────────────────────────

    def _draw_choose(self) -> None:
        self._choose_rects = []
        s  = self.screen
        cx = MAZE_AREA_WIDTH // 2

        # Title
        t = font("cn_large").render("第三关 – 六边形迷宫", True, UI_HEADING)
        s.blit(t, (cx - t.get_width()//2, 60))
        sub = font("body").render("Choose your heuristic, then race Dijkstra!", True, UI_SUBTEXT)
        s.blit(sub, (cx - sub.get_width()//2, 104))

        # Two large algo buttons
        btn_data = [
            ("manhattan", "[M]  A* Manhattan", "h(n) = |Δx| + |Δy|",
             ASTAR_MAN_COL, "黄色路径引导"),
            ("euclidean",  "[E]  A* Euclidean", "h(n) = √(Δx² + Δy²)",
             ASTAR_EUC_COL, "红色路径引导"),
        ]
        bw, bh = 280, 140
        gap    = 30
        total_w = 2 * bw + gap
        bx0    = (MAZE_AREA_WIDTH - total_w) // 2
        by     = 170

        mx, my = pygame.mouse.get_pos()
        for i, (key, title, formula, col, cn) in enumerate(btn_data):
            rect = pygame.Rect(bx0 + i * (bw + gap), by, bw, bh)
            hov  = rect.collidepoint(mx, my)
            pygame.draw.rect(s, (45,45,60) if hov else UI_PANEL, rect, border_radius=10)
            pygame.draw.rect(s, col, rect, width=2, border_radius=10)
            self._choose_rects.append((rect, key))

            ts = font("body").render(title, True, col)
            fs = font("small").render(formula, True, UI_HIGHLIGHT)
            cs = font("cn_small").render(cn, True, UI_SUBTEXT)
            s.blit(ts, (rect.x + (bw - ts.get_width())//2, rect.y + 18))
            s.blit(fs, (rect.x + (bw - fs.get_width())//2, rect.y + 50))
            s.blit(cs, (rect.x + (bw - cs.get_width())//2, rect.y + 76))

            # Colour swatch
            pygame.draw.circle(s, col,
                               (rect.x + bw//2, rect.y + 112), 14)

        # Hex control reference
        ctrl_y = by + bh + 28
        ch = font("cn_body").render("六边形操控键：", True, UI_TEXT)
        s.blit(ch, (cx - ch.get_width()//2, ctrl_y)); ctrl_y += ch.get_height() + 8
        ctrl_keys = [
            ("U  /  I", "西北 / 东北"),
            ("H  /  K", "西  /  东"),
            ("N  /  M", "西南 / 东南"),
        ]
        for keys, dirs in ctrl_keys:
            ks = font("body").render(keys, True, UI_HIGHLIGHT)
            ds = font("cn_small").render(dirs, True, UI_SUBTEXT)
            row_w = ks.get_width() + 16 + ds.get_width()
            rx = cx - row_w // 2
            s.blit(ks, (rx, ctrl_y))
            s.blit(ds, (rx + ks.get_width() + 16, ctrl_y))
            ctrl_y += ks.get_height() + 6

        # Sidebar
        draw_sidebar(
            self.screen,
            level_name   = "Layer 3 – Hexagon",
            instructions = ["[M] Manhattan","[E] Euclidean",
                            "ESC → Menu"],
            tomes        = self.game_data["tomes"],
            algo_info    = [
                {"name":"A* Manhattan","color":ASTAR_MAN_COL,
                 "desc":"Square-grid tuned","formula":"h=|Δx|+|Δy|"},
                {"name":"A* Euclidean","color":ASTAR_EUC_COL,
                 "desc":"Geometry-aware","formula":"h=√(Δx²+Δy²)"},
                {"name":"Dijkstra",    "color":DIJKSTRA_COL,
                 "desc":"Monster","formula":"h=0"},
            ],
        )

    # ── Race sidebar ──────────────────────────────────────────────────────────

    def _draw_race_sidebar(self) -> None:
        s  = self.screen
        sx, sw, sh = SIDEBAR_X, SIDEBAR_WIDTH, SCREEN_HEIGHT
        pygame.draw.rect(s, UI_BG, (sx,0,sw,sh))
        pygame.draw.line(s, UI_BORDER, (sx,0),(sx,sh),2)
        x, y, w = sx+10, 12, sw-20

        # Title
        t = font("cn_large").render("第三关 – 六边形", True, UI_HEADING)
        s.blit(t,(sx+(sw-t.get_width())//2,y)); y+=t.get_height()+6
        pygame.draw.line(s,UI_HEADING,(x,y),(x+w,y),1); y+=8

        # Algorithm card
        algo_label = "A* Manhattan" if self._algo_key=="manhattan" else "A* Euclidean"
        formula    = "h=|Δx|+|Δy|" if self._algo_key=="manhattan" else "h=√(Δx²+Δy²)"
        col        = self._guide_col
        pygame.draw.rect(s, UI_PANEL, (x,y,w,52), border_radius=5)
        pygame.draw.rect(s, col,      (x,y,4,52), border_radius=2)
        ns = font("body").render(algo_label, True, col)
        ds = font("small").render("Your algorithm", True, UI_SUBTEXT)
        fs = font("small").render(formula, True, UI_HIGHLIGHT)
        s.blit(ns,(x+10,y+4)); s.blit(ds,(x+10,y+22)); s.blit(fs,(x+10,y+36))
        y += 56

        # Stat blocks
        y = self._stat_row(s,x,y,w,"You (A*)", self.player.stats(), col)
        mon_st = self.monster.stats()
        y = self._stat_row(s,x,y+4,w,"Dijkstra Monster", mon_st, DIJKSTRA_COL)
        y += 10

        # Turn indicator
        turn_txt = "YOUR TURN" if self._player_turn else "Monster moving…"
        ts = font("small").render(f"Turn: {turn_txt}", True,
                                  UI_SUCCESS if self._player_turn else UI_SUBTEXT)
        s.blit(ts,(x,y)); y+=ts.get_height()+12

        # ── Hex control reference ─────────────────────────────────────────
        pygame.draw.line(s,UI_BORDER,(x,y),(x+w,y),1); y+=6
        hl = font("small").render("── Hex 控制键 ──", True, UI_HEADING)
        s.blit(hl,(x,y)); y+=hl.get_height()+4

        ctrl_rows = [
            ("U  /  I", "NW / NE"),
            ("H  /  K", "W  / E"),
            ("N  /  M", "SW / SE"),
        ]
        for keys, dirs in ctrl_rows:
            ks = font("small").render(keys, True, UI_HIGHLIGHT)
            ds2= font("small").render(dirs,  True, UI_SUBTEXT)
            s.blit(ks,(x,y))
            s.blit(ds2,(x+w-ds2.get_width(),y))
            y += ks.get_height()+3

        y += 6
        note = font("tiny").render("ESC → re-choose heuristic", True, UI_SUBTEXT)
        s.blit(note,(x,y))

    def _stat_row(self, s, x, y, w, label, stats, color) -> int:
        pygame.draw.rect(s, UI_PANEL, (x,y,w,60), border_radius=5)
        pygame.draw.rect(s, color,    (x,y,4,60), border_radius=2)
        ls = font("small").render(label, True, color)
        ss = font("body").render(f"Steps: {stats['steps']}", True, UI_TEXT)
        ts = font("body").render(f"Time : {stats['time']}s", True, UI_TEXT)
        s.blit(ls,(x+10,y+4)); s.blit(ss,(x+10,y+22)); s.blit(ts,(x+10,y+40))
        return y+64

    # ── Result overlay ────────────────────────────────────────────────────────

    def _draw_result(self) -> None:
        self._result_btns = []
        s = self.screen
        overlay = pygame.Surface((MAZE_AREA_WIDTH, SCREEN_HEIGHT), pygame.SRCALPHA)
        overlay.fill((0,0,0,160)); s.blit(overlay,(0,0))
        cx, cy = MAZE_AREA_WIDTH//2, SCREEN_HEIGHT//2

        wc  = (60,200,90) if self._winner=="Player" else (220,70,50)
        algo_label = "Manhattan" if self._algo_key=="manhattan" else "Euclidean"
        note1 = ("Manhattan over-estimates distances on hex grids"
                 if self._algo_key=="manhattan"
                 else "Euclidean is closer to true hex (geodesic) distance")
        note2 = ("→ A* explored more unnecessary nodes."
                 if self._algo_key=="manhattan"
                 else "→ A* guided efficiently toward the exit.")

        lines = [
            (f"{'You' if self._winner=='Player' else 'Dijkstra'} reached the exit first!", wc),
            ("", None),
            (f"Algorithm: A* {algo_label}", UI_TEXT),
            (f"Your steps : {self.player.steps}   Monster: {self.monster.steps}", UI_SUBTEXT),
            ("", None),
            (note1, UI_SUBTEXT),
            (note2, UI_SUBTEXT),
        ]
        total_h = len(lines) * 28
        y = cy - total_h // 2
        for text, color in lines:
            if text and color:
                ss = font("body").render(text, True, color)
                s.blit(ss, (cx - ss.get_width()//2, y))
            y += 28

        # Buttons
        bw, bh = 160, 40
        gap    = 30
        b1_rect = pygame.Rect(cx - bw - gap//2, y+10, bw, bh)
        b2_rect = pygame.Rect(cx + gap//2,       y+10, bw, bh)
        mx, my  = pygame.mouse.get_pos()
        for rect, label, col in [
            (b1_rect, "← Menu",      UI_SUBTEXT),
            (b2_rect, "Next Level →", UI_SUCCESS),
        ]:
            hov = rect.collidepoint(mx, my)
            pygame.draw.rect(s, UI_PANEL if not hov else (50,50,70), rect, border_radius=8)
            pygame.draw.rect(s, col, rect, width=2, border_radius=8)
            ls2 = font("body").render(label, True, col)
            s.blit(ls2, (rect.x+(rect.w-ls2.get_width())//2,
                         rect.y+(rect.h-ls2.get_height())//2))
        self._result_btns = [(b1_rect,"MENU"),(b2_rect,"MAZE_L4")]
