"""Layer 1 – The Race: Player (A* Manhattan) vs Dijkstra Monster, turn-based."""
import random
import pygame
from src.states.base_state import BaseState
from src.maze    import generate_square_maze, SquareGrid
from src.algorithms import AStarManhattan, Dijkstra
from src.entities   import Player, Monster
from src.ui.renderer import draw_square_maze, update_fog
from src.ui.sidebar  import draw_sidebar
from src.config import (
    GRID_COLS, GRID_ROWS, FOG_REVEAL_RADIUS,
    UI_BG, UI_SUCCESS, UI_WARNING, UI_TEXT, UI_SUBTEXT, UI_HEADING,
    ASTAR_MAN_COL, DIJKSTRA_COL, SCREEN_WIDTH, SCREEN_HEIGHT,
    MAZE_AREA_WIDTH, font,
)

_START = (0, GRID_ROWS - 1)
_END   = (GRID_COLS - 1, 0)

_INSTRUCT = [
    "Arrow keys to move",
    "Monster moves after you",
    "First to exit wins!",
    "ESC → Menu",
]


class Layer1State(BaseState):

    def enter(self) -> None:
        seed          = random.randint(0, 9999)
        passages      = generate_square_maze(GRID_COLS, GRID_ROWS, seed)
        self.grid     = SquareGrid(passages)

        self.player   = Player(_START)
        self.monster  = Monster(_START, Dijkstra(), (220, 70, 50), "Dijkstra")
        self.revealed = set()

        # Pre-compute Dijkstra monster path
        self.monster.compute_path(self.grid, _END)

        self._player_turn  = True
        self._finished     = False
        self._winner       = None
        self._show_result  = False

        update_fog(self.revealed, _START, self.grid.passages, FOG_REVEAL_RADIUS)

    def handle_event(self, event: pygame.event.Event) -> None:
        # Mouse – result overlay button
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if self._show_result and hasattr(self, "_result_btn"):
                if self._result_btn and self._result_btn.collidepoint(event.pos):
                    self._go("MAZE_L2"); return

        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                self._go("MENU"); return

            if self._show_result:
                if event.key in (pygame.K_RETURN, pygame.K_SPACE):
                    self._go("MAZE_L2")
                return

            if self._finished:
                return

            if self._player_turn:
                delta = _arrow_to_delta(event.key)
                if delta:
                    self._player_move(delta)

    def _player_move(self, delta: tuple) -> None:
        dc, dr  = delta
        c, r    = self.player.pos
        new_pos = (c + dc, r + dr)
        if self.grid.is_passage(self.player.pos, new_pos):
            self.player.move(new_pos)
            update_fog(self.revealed, new_pos, self.grid.passages, FOG_REVEAL_RADIUS)
            if new_pos == _END:
                self._end_race("Player")
                return
            # Monster's turn
            self._player_turn = False
            self._monster_step()

    def _monster_step(self) -> None:
        self.monster.advance()
        if self.monster.pos == _END:
            self._end_race("Dijkstra")
            return
        self._player_turn = True

    def _end_race(self, winner: str) -> None:
        self._finished    = True
        self._winner      = winner
        self._show_result = True
        if "MAZE_L1" not in self.game_data["completed_levels"]:
            self.game_data["completed_levels"].append("MAZE_L1")

    def update(self, dt: float) -> None:
        pass

    def draw(self) -> None:
        self.screen.fill(UI_BG)

        draw_square_maze(
            self.screen,
            self.grid.passages,
            self.revealed,
            self.player.pos,
            _START, _END,
            monsters=[self.monster],
        )

        turn_txt = "YOUR TURN" if self._player_turn else "Monster's turn…"
        extra = [f"Turn: {turn_txt}"]
        if self._winner:
            color = UI_SUCCESS if self._winner == "Player" else (220,70,50)
            extra.append(f"Winner: {self._winner}!")

        mon_stats = dict(self.monster.stats())
        mon_stats["_label"] = "Dijkstra Monster"

        draw_sidebar(
            self.screen,
            level_name    = "Layer 1 – The Race",
            player_stats  = self.player.stats(),
            monster_stats = mon_stats,
            algo_info     = [
                {"name":"A* Manhattan","color":ASTAR_MAN_COL,"desc":"Your guide","formula":"h=|Δx|+|Δy|"},
                {"name":"Dijkstra",    "color":DIJKSTRA_COL, "desc":"Monster","formula":"h=0"},
            ],
            instructions  = _INSTRUCT,
            tomes         = self.game_data["tomes"],
            extra_lines   = extra,
        )

        if self._show_result:
            self._draw_result()

    def _draw_result(self) -> None:
        overlay = pygame.Surface((MAZE_AREA_WIDTH, SCREEN_HEIGHT), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 170))
        self.screen.blit(overlay, (0, 0))
        cx, cy = MAZE_AREA_WIDTH // 2, SCREEN_HEIGHT // 2

        win_col = UI_SUCCESS if self._winner == "Player" else (220, 70, 50)
        lines = [
            (f"{self._winner} reached the exit first!", win_col),
            ("", UI_TEXT),
            (f"Your steps : {self.player.steps}   cost: {self.player.total_cost:.1f}", ASTAR_MAN_COL),
            (f"Monster    : {self.monster.steps}   cost: {self.monster.total_cost:.1f}", DIJKSTRA_COL),
            ("", UI_TEXT),
            ("A* Manhattan explores fewer nodes than Dijkstra", UI_SUBTEXT),
            ("because the heuristic guides the search.", UI_SUBTEXT),
            ("", UI_TEXT),
            ("[Enter] → Layer 2", UI_TEXT),
        ]
        total_h = len(lines) * 28
        y = cy - total_h // 2
        for text, color in lines:
            if text:
                s = font("body").render(text, True, color)
                self.screen.blit(s, (cx - s.get_width() // 2, y))
            y += 28

        # Clickable "Next Level" button
        bw, bh = 200, 40
        btn = pygame.Rect(cx - bw // 2, y + 4, bw, bh)
        self._result_btn = btn
        mx, my = pygame.mouse.get_pos()
        hov = btn.collidepoint(mx, my)
        pygame.draw.rect(self.screen, (50,50,70) if hov else (30,30,50), btn, border_radius=8)
        pygame.draw.rect(self.screen, UI_SUCCESS, btn, width=2, border_radius=8)
        ls = font("body").render("Next Level →", True, UI_SUCCESS)
        self.screen.blit(ls, (btn.x+(bw-ls.get_width())//2, btn.y+(bh-ls.get_height())//2))


def _arrow_to_delta(key):
    return {
        pygame.K_UP   : (0,-1), pygame.K_DOWN : (0,1),
        pygame.K_LEFT : (-1,0), pygame.K_RIGHT: (1,0),
    }.get(key)
