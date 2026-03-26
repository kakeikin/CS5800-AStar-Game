"""Abstract base class for all game states."""
import pygame


class BaseState:
    def __init__(self, screen: pygame.Surface, game_data: dict):
        self.screen    = screen
        self.game_data = game_data   # shared between states (tomes, etc.)
        self._next: str | None = None

    # ── State machine interface ───────────────────────────────────────────────

    def enter(self) -> None:
        """Called once when the state becomes active."""

    def exit(self) -> None:
        """Called once when leaving the state."""

    def handle_event(self, event: pygame.event.Event) -> None:
        """Process a single pygame event."""

    def update(self, dt: float) -> None:
        """Advance simulation by dt seconds."""

    def draw(self) -> None:
        """Draw everything to self.screen."""

    @property
    def next_state(self) -> str | None:
        """Non-None signals the state machine to transition."""
        return self._next

    def _go(self, state_name: str) -> None:
        self._next = state_name
