"""Maze rendering utilities for both square and hex grids."""
import math
import pygame
from src.config import (
    GRID_COLS, GRID_ROWS,
    CELL_SIZE, WALL_WIDTH, SQUARE_OFFSET_X, SQUARE_OFFSET_Y,
    HEX_SIZE, HEX_W, HEX_H, HEX_ROW_SPACING, HEX_OFFSET_X, HEX_OFFSET_Y,
    HEX_WALL_WIDTH, DIR_TO_EDGE, HEX_NBR_EVEN, HEX_NBR_ODD,
    FOG_COLOR, FLOOR_COLOR, WALL_COLOR, START_COLOR, END_COLOR,
    PLAYER_COLOR, DIJKSTRA_MON_COL, ASTAR_MON_COL,
    ASTAR_MAN_COL, ASTAR_EUC_COL, REWARD_COLOR, VISITED_TINT,
    MAZE_AREA_WIDTH, SCREEN_HEIGHT,
)


# ══════════════════════════════════════════════════════════════════════════════
#  Square grid renderer
# ══════════════════════════════════════════════════════════════════════════════

def sq_cell_rect(col: int, row: int) -> pygame.Rect:
    x = SQUARE_OFFSET_X + col * CELL_SIZE
    y = SQUARE_OFFSET_Y + row * CELL_SIZE
    return pygame.Rect(x, y, CELL_SIZE, CELL_SIZE)


def draw_square_maze(
    surface    : pygame.Surface,
    passages   : dict,
    revealed   : set,
    player_pos : tuple,
    start      : tuple,
    end        : tuple,
    monsters   : list        = None,    # list of Monster objects
    guide_path : list        = None,    # highlighted path cells
    guide_color: tuple       = ASTAR_MAN_COL,
    reward_pos : tuple       = None,
    visited_vis: set         = None,    # cells to tint (algorithm expansion)
) -> None:
    monsters  = monsters  or []
    guide_path= guide_path or []
    visited_vis = visited_vis or set()

    # Maze background
    pygame.draw.rect(surface, (20, 20, 30),
                     (0, 0, MAZE_AREA_WIDTH, SCREEN_HEIGHT))

    for (c, r) in passages:
        rect  = sq_cell_rect(c, r)
        pos   = (c, r)

        if pos not in revealed:
            pygame.draw.rect(surface, FOG_COLOR, rect)
            continue

        # Floor
        col_fill = FLOOR_COLOR
        if pos == start:       col_fill = START_COLOR
        elif pos == end:       col_fill = END_COLOR
        elif pos in visited_vis: col_fill = _blend(FLOOR_COLOR, VISITED_TINT, 0.4)
        pygame.draw.rect(surface, col_fill, rect)

        # Guide path highlight
        if pos in guide_path and pos not in (start, end):
            alpha_surf = pygame.Surface((CELL_SIZE, CELL_SIZE), pygame.SRCALPHA)
            alpha_surf.fill((*guide_color, 80))
            surface.blit(alpha_surf, rect.topleft)

        # Reward
        if pos == reward_pos:
            cr = rect.center
            pygame.draw.circle(surface, REWARD_COLOR, cr, CELL_SIZE // 4)
            pygame.draw.circle(surface, (255, 255, 200), cr, CELL_SIZE // 4 - 3)

        # Walls
        px, py = rect.x, rect.y
        s = CELL_SIZE
        if (c, r - 1) not in passages.get(pos, set()):   # N wall
            pygame.draw.line(surface, WALL_COLOR, (px, py), (px + s, py), WALL_WIDTH)
        if (c, r + 1) not in passages.get(pos, set()):   # S wall
            pygame.draw.line(surface, WALL_COLOR, (px, py + s), (px + s, py + s), WALL_WIDTH)
        if (c - 1, r) not in passages.get(pos, set()):   # W wall
            pygame.draw.line(surface, WALL_COLOR, (px, py), (px, py + s), WALL_WIDTH)
        if (c + 1, r) not in passages.get(pos, set()):   # E wall
            pygame.draw.line(surface, WALL_COLOR, (px + s, py), (px + s, py + s), WALL_WIDTH)

    # Entities on top
    for m in monsters:
        if m.pos in revealed:
            _draw_entity(surface, sq_cell_rect(*m.pos).center, m.color, CELL_SIZE // 3)
    if player_pos in passages:
        _draw_entity(surface, sq_cell_rect(*player_pos).center, PLAYER_COLOR, CELL_SIZE // 3, outline=True)


# ══════════════════════════════════════════════════════════════════════════════
#  Hex grid renderer
# ══════════════════════════════════════════════════════════════════════════════

def hex_center(col: int, row: int) -> tuple:
    x = HEX_OFFSET_X + col * HEX_W + (row % 2) * HEX_W / 2
    y = HEX_OFFSET_Y + row * HEX_ROW_SPACING
    return int(x), int(y)


def hex_corners(col: int, row: int) -> list:
    cx, cy = hex_center(col, row)
    pts = []
    for i in range(6):
        a = math.radians(60 * i + 30)   # pointy-top
        pts.append((int(cx + HEX_SIZE * math.cos(a)),
                    int(cy + HEX_SIZE * math.sin(a))))
    return pts


def draw_hex_maze(
    surface    : pygame.Surface,
    passages   : dict,
    revealed   : set,
    player_pos : tuple,
    start      : tuple,
    end        : tuple,
    monsters   : list        = None,
    guide_path : list        = None,
    guide_color: tuple       = ASTAR_MAN_COL,
    reward_pos : tuple       = None,
    visited_vis: set         = None,
) -> None:
    monsters    = monsters   or []
    guide_path  = guide_path or []
    visited_vis = visited_vis or set()

    pygame.draw.rect(surface, (20, 20, 30),
                     (0, 0, MAZE_AREA_WIDTH, SCREEN_HEIGHT))

    for (c, r) in passages:
        pos     = (c, r)
        corners = hex_corners(c, r)
        cx, cy  = hex_center(c, r)

        if pos not in revealed:
            pygame.draw.polygon(surface, FOG_COLOR, corners)
            continue

        # Floor fill
        col_fill = FLOOR_COLOR
        if pos == start:         col_fill = START_COLOR
        elif pos == end:         col_fill = END_COLOR
        elif pos in visited_vis: col_fill = _blend(FLOOR_COLOR, VISITED_TINT, 0.4)
        pygame.draw.polygon(surface, col_fill, corners)

        # Guide path
        if pos in guide_path and pos not in (start, end):
            alpha_s = pygame.Surface((HEX_SIZE * 3, HEX_SIZE * 3), pygame.SRCALPHA)
            off_x = cx - HEX_SIZE - alpha_s.get_width()  // 2
            off_y = cy - HEX_SIZE - alpha_s.get_height() // 2
            shifted = [(p[0] - cx + alpha_s.get_width() // 2 + HEX_SIZE,
                        p[1] - cy + alpha_s.get_height() // 2 + HEX_SIZE) for p in corners]
            alpha_s.fill((0,0,0,0))
            pygame.draw.polygon(alpha_s, (*guide_color, 80), shifted)
            surface.blit(alpha_s, (off_x, off_y))

        # Reward
        if pos == reward_pos:
            pygame.draw.circle(surface, REWARD_COLOR, (cx, cy), HEX_SIZE // 2)
            pygame.draw.circle(surface, (255, 255, 200), (cx, cy), HEX_SIZE // 2 - 3)

        # Walls – draw each edge that has no passage
        offsets = HEX_NBR_ODD if r % 2 == 1 else HEX_NBR_EVEN
        for d in range(6):
            dc, dr = offsets[d]
            nbr = (c + dc, r + dr)
            has_passage = nbr in passages.get(pos, set())
            c1i, c2i   = DIR_TO_EDGE[d]
            if not has_passage:
                pygame.draw.line(surface, WALL_COLOR,
                                 corners[c1i], corners[c2i], HEX_WALL_WIDTH)

    # Entities
    for m in monsters:
        if m.pos in revealed:
            cx, cy = hex_center(*m.pos)
            _draw_entity(surface, (cx, cy), m.color, HEX_SIZE // 2)
    if player_pos in passages:
        cx, cy = hex_center(*player_pos)
        _draw_entity(surface, (cx, cy), PLAYER_COLOR, HEX_SIZE // 2, outline=True)


# ── Shared helpers ────────────────────────────────────────────────────────────

def _draw_entity(surface, center, color, radius, outline=False):
    pygame.draw.circle(surface, color, center, radius)
    if outline:
        pygame.draw.circle(surface, (255, 255, 255), center, radius, 2)


def _blend(c1, c2, t):
    return tuple(int(c1[i] * (1 - t) + c2[i] * t) for i in range(3))


# ── Fog-of-war helper ─────────────────────────────────────────────────────────

def update_fog(revealed: set, player_pos: tuple, passages: dict,
               radius: int = 2) -> None:
    """Reveal all cells within Chebyshev distance `radius` of player."""
    pc, pr = player_pos
    for (c, r) in passages:
        if max(abs(c - pc), abs(r - pr)) <= radius:
            revealed.add((c, r))
