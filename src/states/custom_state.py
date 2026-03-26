"""Custom mode – placeholder."""
import pygame
from src.states.base_state import BaseState
from src.config import (
    SCREEN_WIDTH, SCREEN_HEIGHT, MAZE_AREA_WIDTH,
    UI_BG, UI_TEXT, UI_SUBTEXT, UI_HEADING,
    ASTAR_MAN_COL, font,
)
from src.ui.sidebar import draw_sidebar


class CustomState(BaseState):

    def enter(self) -> None:
        self._anim = 0.0

    def handle_event(self, event: pygame.event.Event) -> None:
        if event.type == pygame.KEYDOWN:
            if event.key in (pygame.K_ESCAPE, pygame.K_RETURN, pygame.K_SPACE):
                self._go("MENU")

    def update(self, dt: float) -> None:
        self._anim += dt

    def draw(self) -> None:
        self.screen.fill(UI_BG)

        cx, cy = MAZE_AREA_WIDTH // 2, SCREEN_HEIGHT // 2
        lines = [
            ("Custom Mode",         ASTAR_MAN_COL),
            ("",                    UI_TEXT),
            ("Coming soon!",        UI_HEADING),
            ("",                    UI_TEXT),
            ("Design your own maze,",     UI_TEXT),
            ("place walls and weights,",  UI_TEXT),
            ("and compare algorithms.",   UI_TEXT),
            ("",                    UI_TEXT),
            ("[ESC / Enter] → Menu", UI_SUBTEXT),
        ]
        total_h = len(lines) * 34
        y = cy - total_h // 2
        for text, color in lines:
            if text:
                s = font("body").render(text, True, color)
                self.screen.blit(s, (cx - s.get_width() // 2, y))
            y += 34

        draw_sidebar(
            self.screen,
            level_name   = "Custom Mode",
            instructions = ["ESC or Enter → Menu"],
            tomes        = self.game_data["tomes"],
        )
