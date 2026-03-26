import math
import os
import pygame

# ── Screen ────────────────────────────────────────────────────────────────────
SCREEN_WIDTH  = 1100
SCREEN_HEIGHT = 720
FPS           = 60

# ── Grid ──────────────────────────────────────────────────────────────────────
GRID_COLS = 10
GRID_ROWS = 10

# ── Square grid ───────────────────────────────────────────────────────────────
CELL_SIZE          = 58
WALL_WIDTH         = 3
SQUARE_OFFSET_X    = 50   # pixels from left edge of maze area
SQUARE_OFFSET_Y    = 60

# ── Hex grid (pointy-top, odd-r offset) ──────────────────────────────────────
HEX_SIZE        = 30
HEX_W           = math.sqrt(3) * HEX_SIZE
HEX_H           = 2 * HEX_SIZE
HEX_ROW_SPACING = 1.5 * HEX_SIZE
HEX_OFFSET_X    = 88
HEX_OFFSET_Y    = 145
HEX_WALL_WIDTH  = 2

# ── Layout ────────────────────────────────────────────────────────────────────
MAZE_AREA_WIDTH = 680
SIDEBAR_X       = 680
SIDEBAR_WIDTH   = SCREEN_WIDTH - SIDEBAR_X   # 420

# ── Hex neighbors (even rows / odd rows) ─────────────────────────────────────
# Directions: 0=NE, 1=E, 2=SE, 3=SW, 4=W, 5=NW
HEX_NBR_EVEN = [(0,-1),(1,0),(0,1),(-1,1),(-1,0),(-1,-1)]
HEX_NBR_ODD  = [(1,-1),(1,0),(1,1),(0,1),(-1,0),(0,-1)]

# Direction-to-corner-pair for hex edge rendering (pointy-top corners 0-5)
DIR_TO_EDGE = [(0,1),(5,0),(4,5),(3,4),(2,3),(1,2)]  # NE,E,SE,SW,W,NW

# ── Colours – Maze ────────────────────────────────────────────────────────────
FOG_COLOR   = (12,  12,  20 )
FLOOR_COLOR = (185, 165, 135)
WALL_COLOR  = (65,  50,  38 )
START_COLOR = (40,  180, 60 )
END_COLOR   = (200, 50,  50 )

# ── Colours – Entities ───────────────────────────────────────────────────────
PLAYER_COLOR      = (60,  140, 255)
DIJKSTRA_MON_COL  = (220, 70,  50 )
ASTAR_MON_COL     = (180, 60,  220)

# ── Colours – Algorithm visualization ────────────────────────────────────────
ASTAR_MAN_COL  = (255, 220, 30 )
ASTAR_EUC_COL  = (255, 80,  80 )
ASTAR_HEX_COL  = (80,  255, 150)
DIJKSTRA_COL   = (80,  120, 255)
REWARD_COLOR   = (255, 200, 0  )
VISITED_TINT   = (40,  70,  40 )

# ── Colours – UI ─────────────────────────────────────────────────────────────
UI_BG        = (18,  18,  28 )
UI_PANEL     = (30,  30,  45 )
UI_BORDER    = (60,  60,  90 )
UI_TEXT      = (210, 210, 225)
UI_HEADING   = (255, 200, 80 )
UI_SUBTEXT   = (150, 150, 165)
UI_HIGHLIGHT = (80,  180, 255)
UI_SUCCESS   = (60,  200, 90 )
UI_WARNING   = (255, 170, 50 )
UI_DANGER    = (255, 70,  70 )

# ── Fog ───────────────────────────────────────────────────────────────────────
FOG_REVEAL_RADIUS = 2

# ── Fonts ─────────────────────────────────────────────────────────────────────
fonts: dict = {}

# macOS paths for Chinese-capable fonts (tried in order)
_CN_FONT_PATHS = [
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/STHeiti Light.ttc",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    "/System/Library/Fonts/Supplemental/Arial Unicode MS.ttf",
]

def _load_cn_font(size: int, bold: bool = False) -> pygame.font.Font:
    """Return a pygame Font that can render Chinese characters."""
    for path in _CN_FONT_PATHS:
        if os.path.exists(path):
            try:
                return pygame.font.Font(path, size)
            except Exception:
                pass
    # Fallback: try SysFont names
    for name in ["pingfangsc", "stheiti", "arial unicode ms", "arial"]:
        f = pygame.font.SysFont(name, size, bold=bold)
        if f:
            return f
    return pygame.font.Font(None, size)


def init_fonts() -> None:
    fonts["title"]    = pygame.font.SysFont("Arial", 30, bold=True)
    fonts["heading"]  = pygame.font.SysFont("Arial", 22, bold=True)
    fonts["body"]     = pygame.font.SysFont("Arial", 17)
    fonts["small"]    = pygame.font.SysFont("Arial", 14)
    fonts["tiny"]     = pygame.font.SysFont("Arial", 12)
    # Chinese-capable fonts for UI labels
    fonts["cn_xl"]    = _load_cn_font(34, bold=True)
    fonts["cn_large"] = _load_cn_font(26, bold=True)
    fonts["cn_body"]  = _load_cn_font(20)
    fonts["cn_small"] = _load_cn_font(16)


def font(key: str) -> pygame.font.Font:
    return fonts[key]
