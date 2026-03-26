"""Entry point for 'The Path of Algorithms: A* vs Dijkstra'."""
import sys
import pygame
from src.config import SCREEN_WIDTH, SCREEN_HEIGHT, FPS, init_fonts
from src.states.state_machine import StateMachine


def main() -> None:
    pygame.init()
    pygame.display.set_caption("The Path of Algorithms: A* vs Dijkstra")
    screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
    clock  = pygame.time.Clock()

    init_fonts()

    game = StateMachine(screen)

    while True:
        dt = clock.tick(FPS) / 1000.0

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            game.handle_event(event)

        game.update(dt)
        game.draw()
        pygame.display.flip()


if __name__ == "__main__":
    main()
