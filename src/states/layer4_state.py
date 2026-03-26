"""Layer 4 – Pacman Hunt.

Changes from spec:
• Fog of War DISABLED – full maze always visible.
• Player starts Top-Left (0, 0).
• Both monsters start Top-Right (GRID_COLS-1, 0).
• Exit at the CENTER of the grid (GRID_COLS//2, GRID_ROWS//2).
• Two A* monsters use live pathfinding to intercept the player.
• Player picks Square or Hex grid.
"""
import random
import pygame
from src.states.base_state import BaseState
from src.maze    import generate_square_maze, generate_hex_maze, SquareGrid, HexGrid
from src.algorithms import AStarManhattan
from src.entities   import Player, Monster
from src.ui.renderer import draw_square_maze, draw_hex_maze, update_fog
from src.ui.sidebar  import draw_sidebar
from src.config import (
    GRID_COLS, GRID_ROWS,
    SIDEBAR_X, SIDEBAR_WIDTH, SCREEN_HEIGHT, MAZE_AREA_WIDTH,
    UI_BG, UI_PANEL, UI_BORDER, UI_TEXT, UI_HEADING, UI_SUBTEXT,
    UI_SUCCESS, UI_DANGER, UI_HIGHLIGHT, UI_WARNING,
    ASTAR_MON_COL, ASTAR_MAN_COL,
    font,
)

_PLAYER_START  = (0, 0)
_MON_START     = (GRID_COLS - 1, 0)                     # top-right
_EXIT          = (GRID_COLS // 2, GRID_ROWS // 2)        # centre = (5, 5)

MONSTER_INTERVAL = 0.40   # seconds between monster steps

# Two distinct monster colours
_MON_COLORS = [(180, 60, 220), (220, 100, 60)]


class Layer4State(BaseState):

    def enter(self) -> None:
        self._phase    = "choose"
        self._grid_type= None
        self._anim     = 0.0
        self._choose_rects: list = []

    def _start_game(self, grid_type: str) -> None:
        self._grid_type = grid_type
        seed = random.randint(0, 9999)

        if grid_type == "square":
            passages   = generate_square_maze(GRID_COLS, GRID_ROWS, seed)
            self._grid = SquareGrid(passages)
        else:
            passages   = generate_hex_maze(GRID_COLS, GRID_ROWS, seed)
            self._grid = HexGrid(passages)

        self.player  = Player(_PLAYER_START)

        # Both monsters spawn at top-right
        algo = AStarManhattan()
        self.monsters = [
            Monster(_MON_START, algo, _MON_COLORS[0], "A* Hunter 1"),
            Monster(_MON_START, algo, _MON_COLORS[1], "A* Hunter 2"),
        ]

        # ── No fog: reveal ALL cells immediately ──────────────────────────
        self.revealed: set = set(self._grid.passages.keys())

        self._timers = [0.0, 0.0]
        self._result = None        # None | "escaped" | "caught"
        self._result_btns: list = []
        self._phase  = "game"

        # Initial monster paths toward player start
        for m in self.monsters:
            m.compute_path(self._grid, self.player.pos)

    # ── Events ────────────────────────────────────────────────────────────────

    def handle_event(self, event: pygame.event.Event) -> None:
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if self._phase == "choose":
                for rect, key in self._choose_rects:
                    if rect.collidepoint(event.pos):
                        self._start_game(key); return
            elif self._phase == "game" and self._result:
                for rect, target in self._result_btns:
                    if rect.collidepoint(event.pos):
                        self._go(target); return

        if event.type != pygame.KEYDOWN:
            return

        if event.key == pygame.K_ESCAPE:
            if self._phase == "game":
                self._phase = "choose"
            else:
                self._go("MENU")
            return

        if self._phase == "choose":
            if event.key == pygame.K_s:
                self._start_game("square")
            elif event.key == pygame.K_h:
                self._start_game("hex")

        elif self._phase == "game" and not self._result:
            delta = _arrow_to_delta(event.key)
            if delta:
                self._player_move(delta)

        elif self._phase == "game" and self._result:
            if event.key in (pygame.K_RETURN, pygame.K_SPACE):
                self._go("MENU")

    def _player_move(self, delta: tuple) -> None:
        c, r    = self.player.pos
        new_pos = (c + delta[0], r + delta[1])
        if not self._grid.is_passage(self.player.pos, new_pos):
            return
        self.player.move(new_pos)

        if new_pos == _EXIT:
            self._result = "escaped"
            if "MAZE_L4" not in self.game_data["completed_levels"]:
                self.game_data["completed_levels"].append("MAZE_L4")
            return

        for m in self.monsters:
            if m.pos == new_pos:
                self._result = "caught"; return

    # ── Update (real-time monster movement) ───────────────────────────────────

    def update(self, dt: float) -> None:
        self._anim += dt
        if self._phase != "game" or self._result:
            return

        for i, m in enumerate(self.monsters):
            self._timers[i] += dt
            if self._timers[i] >= MONSTER_INTERVAL:
                self._timers[i] = 0.0
                # Live A* toward player's current position
                m.compute_path(self._grid, self.player.pos)
                m.advance()
                if m.pos == self.player.pos:
                    self._result = "caught"; return

    # ── Draw ──────────────────────────────────────────────────────────────────

    def draw(self) -> None:
        self.screen.fill(UI_BG)

        if self._phase == "choose":
            self._draw_choose()
            return

        # Draw maze (no fog – all cells already in self.revealed)
        if self._grid_type == "square":
            draw_square_maze(
                self.screen, self._grid.passages, self.revealed,
                self.player.pos, _PLAYER_START, _EXIT,
                monsters=self.monsters,
            )
        else:
            draw_hex_maze(
                self.screen, self._grid.passages, self.revealed,
                self.player.pos, _PLAYER_START, _EXIT,
                monsters=self.monsters,
            )

        self._draw_sidebar()

        if self._result:
            self._draw_result()

    # ── Choose screen ─────────────────────────────────────────────────────────

    def _draw_choose(self) -> None:
        self._choose_rects = []
        s  = self.screen
        cx = MAZE_AREA_WIDTH // 2

        title = font("cn_large").render("第四关 – 追逃游戏！", True, (255,150,60))
        s.blit(title, (cx - title.get_width()//2, 60))

        lines = [
            ("Two A* monsters hunt you in real-time.", UI_TEXT),
            ("The ENTIRE maze is visible — no fog!", (80,200,255)),
            (f"Player: top-left  ·  Exit: center  ·  Monsters: top-right", UI_SUBTEXT),
            ("Reach the exit to win. Don't get caught!", UI_TEXT),
        ]
        y = 110
        for text, col in lines:
            ss = font("body").render(text, True, col)
            s.blit(ss,(cx-ss.get_width()//2,y)); y+=ss.get_height()+4

        # Grid choice buttons
        btn_data = [
            ("square", "[S]  方形迷宫", "Square Grid", ASTAR_MAN_COL),
            ("hex",    "[H]  六边形迷宫","Hex Grid",    (80,255,150)),
        ]
        bw, bh = 250, 100
        gap    = 40
        total_w= 2*bw+gap
        bx0    = (MAZE_AREA_WIDTH-total_w)//2
        by     = 200

        mx, my = pygame.mouse.get_pos()
        for i, (key, cn, en, col) in enumerate(btn_data):
            rect = pygame.Rect(bx0 + i*(bw+gap), by, bw, bh)
            hov  = rect.collidepoint(mx,my)
            pygame.draw.rect(s,(45,45,60) if hov else UI_PANEL, rect, border_radius=10)
            pygame.draw.rect(s, col, rect, width=2, border_radius=10)
            self._choose_rects.append((rect, key))
            cn_s = font("cn_body").render(cn, True, col)
            en_s = font("small").render(en, True, UI_SUBTEXT)
            s.blit(cn_s,(rect.x+(bw-cn_s.get_width())//2, rect.y+18))
            s.blit(en_s,(rect.x+(bw-en_s.get_width())//2, rect.y+54))

        # Info grid about positions
        info_y = by + bh + 30
        info_lines = [
            (f"🟢 Player spawn  : (0, 0) – top-left corner",      UI_SUCCESS),
            (f"🔴 Exit goal     : ({_EXIT[0]}, {_EXIT[1]}) – maze center",    (200,80,80)),
            (f"👾 Monster spawn : ({_MON_START[0]}, {_MON_START[1]}) – top-right corner", ASTAR_MON_COL),
            ("⚡ Monsters use real-time A* pathfinding each tick",   UI_SUBTEXT),
        ]
        for text, col in info_lines:
            ss = font("body").render(text, True, col)
            s.blit(ss,(cx-ss.get_width()//2,info_y)); info_y+=ss.get_height()+6

        draw_sidebar(
            self.screen,
            level_name   = "Layer 4 – Hunt",
            instructions = ["[S] Square","[H] Hex","ESC → Menu"],
            tomes        = self.game_data["tomes"],
        )

    # ── Race sidebar ──────────────────────────────────────────────────────────

    def _draw_sidebar(self) -> None:
        s = self.screen
        sx, sw, sh = SIDEBAR_X, SIDEBAR_WIDTH, SCREEN_HEIGHT
        pygame.draw.rect(s, UI_BG, (sx,0,sw,sh))
        pygame.draw.line(s, UI_BORDER,(sx,0),(sx,sh),2)
        x, y, w = sx+10, 12, sw-20

        # Title
        grid_cn = "方形" if self._grid_type=="square" else "六边形"
        t = font("cn_large").render(f"第四关 – {grid_cn}追逃", True, UI_HEADING)
        s.blit(t,(sx+(sw-t.get_width())//2,y)); y+=t.get_height()+6
        pygame.draw.line(s,UI_HEADING,(x,y),(x+w,y),1); y+=8

        # Status
        if self._result == "escaped":
            st_s = font("cn_body").render("✅ 成功逃出！", True, UI_SUCCESS)
        elif self._result == "caught":
            st_s = font("cn_body").render("❌ 被捉住了！", True, UI_DANGER)
        else:
            st_s = font("cn_body").render("🔴 全速逃跑！", True, UI_WARNING)
        s.blit(st_s,(x,y)); y+=st_s.get_height()+10

        # Player stats
        pygame.draw.rect(s, UI_PANEL,(x,y,w,60), border_radius=5)
        pygame.draw.rect(s, ASTAR_MAN_COL,(x,y,4,60), border_radius=2)
        s.blit(font("small").render("You",True,ASTAR_MAN_COL),(x+10,y+4))
        s.blit(font("body").render(f"Steps: {self.player.steps}",True,UI_TEXT),(x+10,y+22))
        s.blit(font("body").render(f"Time : {self.player.elapsed:.1f}s",True,UI_TEXT),(x+10,y+40))
        y+=64

        # Monster positions
        y+=6
        for i, m in enumerate(self.monsters):
            pygame.draw.rect(s, UI_PANEL,(x,y,w,44),border_radius=4)
            pygame.draw.rect(s, m.color,(x,y,4,44),border_radius=2)
            ms = font("small").render(m.name, True, m.color)
            ps = font("small").render(f"pos {m.pos}  steps {m.steps}", True, UI_TEXT)
            s.blit(ms,(x+10,y+4)); s.blit(ps,(x+10,y+24))
            y+=48

        # Info
        y+=8
        pygame.draw.line(s,UI_BORDER,(x,y),(x+w,y),1); y+=6
        for line in [
            "A* hunters recompute path",
            "to your position every tick.",
            "Full maze visible – no fog.",
            "Arrow keys to move.",
            f"Exit at centre: {_EXIT}",
        ]:
            ls = font("tiny").render(line, True, UI_SUBTEXT)
            s.blit(ls,(x,y)); y+=ls.get_height()+3

    # ── Result overlay ────────────────────────────────────────────────────────

    def _draw_result(self) -> None:
        self._result_btns = []
        s = self.screen
        overlay = pygame.Surface((MAZE_AREA_WIDTH, SCREEN_HEIGHT), pygame.SRCALPHA)
        overlay.fill((0,0,0,160)); s.blit(overlay,(0,0))
        cx, cy = MAZE_AREA_WIDTH//2, SCREEN_HEIGHT//2

        if self._result == "escaped":
            lines = [
                ("🎉 YOU ESCAPED!", UI_SUCCESS),
                ("", None),
                ("You outsmarted two real-time A* hunters!", UI_TEXT),
                ("Understanding A* helps you predict and", UI_TEXT),
                ("evade algorithmic pursuit.", UI_TEXT),
                ("", None),
                (f"Steps taken: {self.player.steps}", ASTAR_MAN_COL),
                ("", None),
            ]
        else:
            lines = [
                ("💀 CAUGHT!", UI_DANGER),
                ("", None),
                ("A* always finds the shortest path to you.", UI_TEXT),
                ("The hunters had perfect maze knowledge.", UI_TEXT),
                ("", None),
                (f"You lasted {self.player.steps} steps.", UI_SUBTEXT),
                ("", None),
            ]

        total_h = len(lines) * 28
        y = cy - total_h // 2
        for text, col in lines:
            if text and col:
                ss = font("body").render(text, True, col)
                s.blit(ss,(cx-ss.get_width()//2,y))
            y += 28

        bw, bh = 200, 42
        btn_rect = pygame.Rect(cx-bw//2, y+6, bw, bh)
        mx, my   = pygame.mouse.get_pos()
        hov      = btn_rect.collidepoint(mx,my)
        pygame.draw.rect(s, UI_PANEL if not hov else (50,50,70), btn_rect, border_radius=8)
        pygame.draw.rect(s, UI_SUCCESS, btn_rect, width=2, border_radius=8)
        ls = font("cn_body").render("← 返回主菜单", True, UI_SUCCESS)
        s.blit(ls,(btn_rect.x+(bw-ls.get_width())//2,
                   btn_rect.y+(bh-ls.get_height())//2))
        self._result_btns = [(btn_rect, "MENU")]


def _arrow_to_delta(key):
    return {
        pygame.K_UP:(0,-1), pygame.K_DOWN:(0,1),
        pygame.K_LEFT:(-1,0), pygame.K_RIGHT:(1,0),
    }.get(key)
