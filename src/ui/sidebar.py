"""Sidebar panel drawn to the right of the maze area."""
import pygame
from src.config import (
    SIDEBAR_X, SIDEBAR_WIDTH, SCREEN_HEIGHT,
    UI_BG, UI_PANEL, UI_BORDER, UI_TEXT, UI_HEADING, UI_SUBTEXT,
    UI_HIGHLIGHT, UI_SUCCESS, UI_WARNING, UI_DANGER,
    ASTAR_MAN_COL, ASTAR_EUC_COL, DIJKSTRA_COL,
    font,
)


def draw_sidebar(
    surface: pygame.Surface,
    *,
    level_name: str       = "",
    player_stats: dict    = None,
    monster_stats: dict   = None,
    algo_info: list       = None,   # [{"name": ..., "color": ..., "desc": ...}]
    instructions: list    = None,   # list of str
    tomes: list           = None,   # ["manhattan", "euclidean"]
    overlay_text: str     = "",     # large centred text (phase transition)
    extra_lines: list     = None,   # additional info lines
) -> None:
    player_stats  = player_stats  or {}
    monster_stats = monster_stats or {}
    algo_info     = algo_info     or []
    instructions  = instructions  or []
    tomes         = tomes         or []
    extra_lines   = extra_lines   or []

    x = SIDEBAR_X + 8
    y = 10
    w = SIDEBAR_WIDTH - 16

    # ── Background ────────────────────────────────────────────────────────────
    pygame.draw.rect(surface, UI_BG, (SIDEBAR_X, 0, SIDEBAR_WIDTH, SCREEN_HEIGHT))
    pygame.draw.line(surface, UI_BORDER, (SIDEBAR_X, 0), (SIDEBAR_X, SCREEN_HEIGHT), 2)

    # ── Level title ───────────────────────────────────────────────────────────
    if level_name:
        y = _draw_heading(surface, level_name, x, y, w, UI_HEADING)
        y += 4

    # ── Algorithm cards ───────────────────────────────────────────────────────
    for info in algo_info:
        y = _draw_algo_card(surface, info, x, y, w)
        y += 4

    # ── Player stats ──────────────────────────────────────────────────────────
    if player_stats:
        y = _draw_stats_block(surface, "You", player_stats, ASTAR_MAN_COL, x, y, w)
        y += 4

    # ── Monster stats ─────────────────────────────────────────────────────────
    if monster_stats:
        y = _draw_stats_block(surface, monster_stats.get("_label","Monster"), monster_stats, DIJKSTRA_COL, x, y, w)
        y += 4

    # ── Extra lines ───────────────────────────────────────────────────────────
    for line in extra_lines:
        surf = font("small").render(line, True, UI_SUBTEXT)
        surface.blit(surf, (x, y))
        y += 18
    if extra_lines:
        y += 4

    # ── Instructions ──────────────────────────────────────────────────────────
    if instructions:
        y = _draw_section(surface, "Controls", instructions, UI_SUBTEXT, x, y, w)
        y += 4

    # ── Tomes / unlocks ───────────────────────────────────────────────────────
    if tomes:
        y = _draw_tomes(surface, tomes, x, y, w)

    # ── Big overlay text (level transition) ──────────────────────────────────
    if overlay_text:
        _draw_overlay(surface, overlay_text)


# ── Private helpers ───────────────────────────────────────────────────────────

def _draw_heading(surface, text, x, y, w, color):
    surf = font("heading").render(text, True, color)
    surface.blit(surf, (x, y))
    pygame.draw.line(surface, color,
                     (x, y + surf.get_height() + 2),
                     (x + w, y + surf.get_height() + 2), 1)
    return y + surf.get_height() + 6


def _draw_algo_card(surface, info, x, y, w):
    color = info.get("color", UI_TEXT)
    pygame.draw.rect(surface, UI_PANEL, (x, y, w, 52), border_radius=5)
    pygame.draw.rect(surface, color,    (x, y, 4, 52), border_radius=2)

    name_surf = font("body").render(info["name"], True, color)
    surface.blit(name_surf, (x + 10, y + 4))

    desc = info.get("desc", "")
    if desc:
        d_surf = font("small").render(desc, True, UI_SUBTEXT)
        surface.blit(d_surf, (x + 10, y + 24))

    formula = info.get("formula", "")
    if formula:
        f_surf = font("small").render(formula, True, UI_HIGHLIGHT)
        surface.blit(f_surf, (x + 10, y + 36))

    return y + 56


def _draw_stats_block(surface, label, stats, color, x, y, w):
    pygame.draw.rect(surface, UI_PANEL, (x, y, w, 72), border_radius=5)
    pygame.draw.rect(surface, color,    (x, y, 4, 72), border_radius=2)

    lbl = font("small").render(label, True, color)
    surface.blit(lbl, (x + 10, y + 4))

    step_s = font("body").render(f"Steps : {stats.get('steps', 0)}", True, UI_TEXT)
    cost_s = font("body").render(f"Cost  : {stats.get('cost',  0)}", True, UI_TEXT)
    time_s = font("body").render(f"Time  : {stats.get('time',  0)}s",True, UI_TEXT)

    surface.blit(step_s, (x + 10, y + 18))
    surface.blit(cost_s, (x + 10, y + 36))
    surface.blit(time_s, (x + 10, y + 54))
    return y + 76


def _draw_section(surface, heading, lines, color, x, y, w):
    h_surf = font("small").render(f"── {heading} ──", True, UI_HEADING)
    surface.blit(h_surf, (x, y))
    y += h_surf.get_height() + 4
    for line in lines:
        s = font("tiny").render(line, True, color)
        surface.blit(s, (x + 6, y))
        y += s.get_height() + 3
    return y


def _draw_tomes(surface, tomes, x, y, w):
    h_surf = font("small").render("── Unlocked ──", True, UI_HEADING)
    surface.blit(h_surf, (x, y))
    y += h_surf.get_height() + 6

    TOME_DATA = {
        "manhattan": ("A* Manhattan Tome",     ASTAR_MAN_COL, "h(n) = |Δx|+|Δy|"),
        "euclidean": ("A* Euclidean Technique", ASTAR_EUC_COL, "h(n) = √(Δx²+Δy²)"),
    }
    for tome in tomes:
        if tome not in TOME_DATA:
            continue
        name, color, formula = TOME_DATA[tome]
        pygame.draw.rect(surface, UI_PANEL, (x, y, w, 40), border_radius=5)
        pygame.draw.rect(surface, color,    (x, y, 4, 40), border_radius=2)
        # Book icon (simple)
        pygame.draw.rect(surface, color, (x + 8, y + 8, 14, 18), border_radius=1)
        pygame.draw.line(surface, UI_BG, (x + 15, y + 8), (x + 15, y + 26), 1)
        n_s = font("small").render(name, True, color)
        f_s = font("tiny").render(formula, True, UI_SUBTEXT)
        surface.blit(n_s, (x + 28, y + 4))
        surface.blit(f_s, (x + 28, y + 22))
        y += 44
    return y


def _draw_overlay(surface, text):
    overlay = pygame.Surface(
        (SIDEBAR_WIDTH - 20, 60), pygame.SRCALPHA
    )
    overlay.fill((30, 30, 50, 200))
    surface.blit(overlay, (SIDEBAR_X + 10, SCREEN_HEIGHT // 2 - 30))
    t = font("heading").render(text, True, UI_SUCCESS)
    surface.blit(
        t,
        (SIDEBAR_X + (SIDEBAR_WIDTH - t.get_width()) // 2,
         SCREEN_HEIGHT // 2 - 30 + (60 - t.get_height()) // 2)
    )
