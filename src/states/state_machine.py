"""Finite state machine that drives the whole game."""
import pygame
from src.states.menu_state    import MenuState
from src.states.tutorial_state import TutorialState
from src.states.layer1_state  import Layer1State
from src.states.layer2_state  import Layer2State
from src.states.layer3_state  import Layer3State
from src.states.layer4_state  import Layer4State
from src.states.custom_state  import CustomState


class StateMachine:
    STATES = {
        "MENU"     : MenuState,
        "TUTORIAL" : TutorialState,
        "MAZE_L1"  : Layer1State,
        "MAZE_L2"  : Layer2State,
        "MAZE_L3"  : Layer3State,
        "MAZE_L4"  : Layer4State,
        "CUSTOM"   : CustomState,
    }

    def __init__(self, screen: pygame.Surface):
        self.screen    = screen
        self.game_data = {"tomes": [], "completed_levels": []}
        self._state    = None
        self._switch("MENU")

    def _switch(self, name: str) -> None:
        if self._state:
            self._state.exit()
        cls          = self.STATES[name]
        self._state  = cls(self.screen, self.game_data)
        self._state.enter()

    def handle_event(self, event: pygame.event.Event) -> None:
        self._state.handle_event(event)

    def update(self, dt: float) -> None:
        self._state.update(dt)
        nxt = self._state.next_state
        if nxt:
            self._switch(nxt)

    def draw(self) -> None:
        self._state.draw()
