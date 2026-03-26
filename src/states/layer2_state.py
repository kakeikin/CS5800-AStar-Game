"""Layer 2 – The Weighted Reward.

Player's A* is modified to route through a -10 step bonus reward that lies
slightly off the optimal direct path.  Dijkstra monster ignores it.
"""
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
    UI_BG, UI_SUCCESS, UI_TEXT, UI_SUBTEXT, UI_PANEL,
    ASTAR_MAN_COL, DIJKSTRA_COL, REWARD_COLOR,
    SCREEN_HEIGHT, MAZE_AREA_WIDTH, font,
)

_START  = (0, GRID_ROWS - 1)
_END    = (GRID_COLS - 1, 0)
_REWARD_BONUS = -10   # step penalty applied on collection

_INSTRUCT = [
    "Arrow keys to move",
    "Gold circle = -10 step reward",
    "Your path is routed via reward",
    "Dijkstra ignores it",
    "ESC → Menu",
]


class Layer2State(BaseState):

    def enter(self) -> None:
        seed          = random.randint(0, 9999)
        passages      = generate_square_maze(GRID_COLS, GRID_ROWS, seed)
        self.grid     = SquareGrid(passages)

        self.player   = Player(_START)
        self.monster  = Monster(_START, Dijkstra(), (220, 70, 50), "Dijkstra")
        self.revealed = set()

        # ── Place reward off the optimal path, ~4 BFS steps from start ──────
        self.reward_pos = _find_reward(self.grid, _START, _END)
        self.reward_collected = False

        # ── Player guide: path via reward if net cost is better ──────────────
        self.guide_path = _compute_reward_path(self.grid, _START, _END, self.reward_pos)

        # ── Monster: straight Dijkstra to end ────────────────────────────────
        self.monster.compute_path(self.grid, _END)

        self._player_turn  = True
        self._finished     = False
        self._show_result  = False
        self._result_btn   = None

        update_fog(self.revealed, _START, self.grid.passages, FOG_REVEAL_RADIUS)

    def handle_event(self, event: pygame.event.Event) -> None:
        # Mouse – result overlay button
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if self._show_result and hasattr(self, "_result_btn"):
                if self._result_btn and self._result_btn.collidepoint(event.pos):
                    if "euclidean" not in self.game_data["tomes"]:
                        self.game_data["tomes"].append("euclidean")
                    self._go("MAZE_L3"); return

        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                self._go("MENU"); return

            if self._show_result:
                if event.key in (pygame.K_RETURN, pygame.K_SPACE):
                    if "euclidean" not in self.game_data["tomes"]:
                        self.game_data["tomes"].append("euclidean")
                    self._go("MAZE_L3")
                return

            if self._finished or not self._player_turn:
                return

            delta = _arrow_to_delta(event.key)
            if delta:
                self._player_move(delta)

    def _player_move(self, delta: tuple) -> None:
        c, r    = self.player.pos
        new_pos = (c + delta[0], r + delta[1])
        if not self.grid.is_passage(self.player.pos, new_pos):
            return

        self.player.move(new_pos)
        update_fog(self.revealed, new_pos, self.grid.passages, FOG_REVEAL_RADIUS)

        # Check reward collection
        if new_pos == self.reward_pos and not self.reward_collected:
            self.reward_collected = True
            self.player.add_bonus(_REWARD_BONUS)
            # Update guide: now route directly to end
            astar = AStarManhattan()
            path, _, _ = astar.find_path(self.grid, new_pos, _END)
            self.guide_path = path[1:3]

        # Update guide next 2 steps
        if not self.reward_collected and self.guide_path:
            # Advance guide to reflect current position
            astar = AStarManhattan()
            path, _, _ = astar.find_path(self.grid, new_pos, _END)
            # If reward still ahead, route via reward
            if self.reward_pos not in [new_pos]:
                self.guide_path = _compute_reward_path(
                    self.grid, new_pos, _END, self.reward_pos
                )
            else:
                self.guide_path = path[1:3]

        if new_pos == _END:
            self._finish_race("Player"); return

        self._player_turn = False
        self.monster.advance()
        if self.monster.pos == _END:
            self._finish_race("Dijkstra"); return
        self._player_turn = True

    def _finish_race(self, winner: str) -> None:
        self._finished   = True
        self._winner     = winner
        self._show_result = True
        if "MAZE_L2" not in self.game_data["completed_levels"]:
            self.game_data["completed_levels"].append("MAZE_L2")

    def update(self, dt: float) -> None:
        pass

    def draw(self) -> None:
        self.screen.fill(UI_BG)

        rp = None if self.reward_collected else self.reward_pos
        draw_square_maze(
            self.screen,
            self.grid.passages,
            self.revealed,
            self.player.pos,
            _START, _END,
            monsters   = [self.monster],
            guide_path = self.guide_path,
            guide_color= REWARD_COLOR,
            reward_pos = rp,
        )

        bonus_txt = "Reward collected! -10 steps" if self.reward_collected else "Gold circle = -10 steps bonus"
        mon_stats = dict(self.monster.stats()); mon_stats["_label"] = "Dijkstra"

        draw_sidebar(
            self.screen,
            level_name    = "Layer 2 – Weighted Reward",
            player_stats  = self.player.stats(),
            monster_stats = mon_stats,
            algo_info     = [
                {"name":"A* + Reward","color":REWARD_COLOR,"desc":"Routes via bonus","formula":"modified g(n)"},
                {"name":"Dijkstra",   "color":DIJKSTRA_COL,"desc":"Ignores reward", "formula":"h=0"},
            ],
            instructions  = _INSTRUCT,
            tomes         = self.game_data["tomes"],
            extra_lines   = [bonus_txt],
        )

        if self._show_result:
            self._draw_result()

    def _draw_result(self) -> None:
        overlay = pygame.Surface((MAZE_AREA_WIDTH, SCREEN_HEIGHT), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 170))
        self.screen.blit(overlay, (0, 0))
        cx, cy = MAZE_AREA_WIDTH // 2, SCREEN_HEIGHT // 2
        lines = [
            (f"{'You' if self._winner=='Player' else 'Dijkstra'} won!", UI_SUCCESS),
            ("", UI_TEXT),
            (f"Your steps : {self.player.steps}  (reward saved 10 steps!)" if self.reward_collected
             else f"Your steps : {self.player.steps}", ASTAR_MAN_COL),
            (f"Monster    : {self.monster.steps}", DIJKSTRA_COL),
            ("", UI_TEXT),
            ("Detour + Reward = smart weighted A*", UI_SUBTEXT),
            ("Dijkstra can't reason about future bonuses.", UI_SUBTEXT),
            ("", UI_TEXT),
            ("Unlocked: A* Euclidean Technique!", (255,100,100)),
            ("", UI_TEXT),
            ("[Enter] → Layer 3", UI_TEXT),
        ]
        total_h = len(lines) * 26
        y = cy - total_h // 2
        for text, color in lines:
            if text:
                s = font("body").render(text, True, color)
                self.screen.blit(s, (cx - s.get_width() // 2, y))
            y += 26

        # Clickable button
        bw, bh = 200, 40
        btn = pygame.Rect(cx - bw // 2, y + 4, bw, bh)
        self._result_btn = btn
        mx, my = pygame.mouse.get_pos()
        hov = btn.collidepoint(mx, my)
        pygame.draw.rect(self.screen, (50,50,70) if hov else (30,30,50), btn, border_radius=8)
        pygame.draw.rect(self.screen, UI_SUCCESS, btn, width=2, border_radius=8)
        ls2 = font("body").render("Next Level →", True, UI_SUCCESS)
        self.screen.blit(ls2, (btn.x+(bw-ls2.get_width())//2, btn.y+(bh-ls2.get_height())//2))


# ── Helpers ───────────────────────────────────────────────────────────────────

def _find_reward(grid: SquareGrid, start: tuple, end: tuple) -> tuple:
    """Find a cell ~4 BFS steps from start that isn't on the direct optimal path."""
    from src.algorithms import AStarManhattan
    astar = AStarManhattan()
    opt_path, _, _ = astar.find_path(grid, start, end)
    opt_set  = set(opt_path)
    bfs_dist = grid.bfs_distance(start)

    candidates = [
        pos for pos, d in bfs_dist.items()
        if d == 4 and pos not in opt_set and pos != end
    ]
    if not candidates:
        # Fallback: any cell 3-5 steps away, off optimal path
        candidates = [
            pos for pos, d in bfs_dist.items()
            if 2 <= d <= 6 and pos not in opt_set and pos != end
        ]
    if not candidates:
        candidates = [pos for pos in grid.cells() if pos != start and pos != end]

    return random.choice(candidates)


def _compute_reward_path(grid: SquareGrid, start, end, reward) -> list:
    """Return guide highlight: next 2 steps on path start→reward→end."""
    astar = AStarManhattan()
    p1, _, _ = astar.find_path(grid, start, reward)
    p2, _, _ = astar.find_path(grid, reward, end)
    full = p1 + p2[1:]    # merge (remove duplicate reward node)
    return full[1:3]


def _arrow_to_delta(key):
    return {
        pygame.K_UP:(0,-1), pygame.K_DOWN:(0,1),
        pygame.K_LEFT:(-1,0), pygame.K_RIGHT:(1,0),
    }.get(key)
