# The Path of Algorithms: A\* vs Dijkstra

> A 2-D pedagogical maze game built with **Python + Pygame** for CS 5800.
> Players learn pathfinding algorithms through interactive gameplay and comparative analysis.

---

## Project Structure

```
Project Game/
│
├── main.py                        # Entry point – pygame loop & StateMachine bootstrap
├── README.md
├── 想法.txt                        # Free-form idea scratchpad
│
└── src/
    ├── config.py                  # Global constants: screen size, colours, fonts, hex geometry
    │
    ├── algorithms/                # Strategy-pattern pathfinding engines
    │   ├── base.py                # Abstract PathfindingAlgorithm interface
    │   ├── dijkstra.py            # Dijkstra – uniform-cost search  h(n) = 0
    │   └── astar.py               # A* Manhattan · A* Euclidean · A* Hex (cube distance)
    │
    ├── maze/                      # Maze data structures & generation
    │   ├── generator.py           # Iterative DFS (recursive backtracker) for square & hex
    │   ├── square_grid.py         # SquareGrid wrapper – get_neighbors_with_cost, BFS utils
    │   └── hex_grid.py            # HexGrid wrapper  – odd-r offset coordinate system
    │
    ├── entities/                  # Game actors
    │   ├── player.py              # Player – position, step counter, cost, timer
    │   └── monster.py             # Monster – algorithm reference, cached/live A* path
    │
    ├── ui/                        # Rendering & HUD
    │   ├── renderer.py            # draw_square_maze / draw_hex_maze, fog-of-war helper
    │   └── sidebar.py             # Right-panel: stat blocks, algo cards, tome badges
    │
    └── states/                    # Finite-state machine
        ├── state_machine.py       # StateMachine – drives state transitions
        ├── base_state.py          # BaseState – enter / exit / handle_event / update / draw
        ├── menu_state.py          # Main menu  – 3 horizontal icon buttons, mouse + keyboard
        ├── tutorial_state.py      # Tutorial   – 4-phase flow (see below)
        ├── layer1_state.py        # Layer 1    – The Race (turn-based vs Dijkstra)
        ├── layer2_state.py        # Layer 2    – Weighted Reward (modified A* path)
        ├── layer3_state.py        # Layer 3    – Hexagonal maze (Manhattan vs Euclidean)
        ├── layer4_state.py        # Layer 4    – Pacman Hunt (real-time A* monsters)
        └── custom_state.py        # Custom     – placeholder
```

---

## How to Run

```bash
# Install dependency (one-time)
pip install pygame

# Launch the game
cd "Project Game"
python3 main.py
```

Requires **Python 3.11+** and **Pygame 2.x**.

---

## Game Flow

```
Main Menu
    │
    ├─ Tutorial ──────────────────────────────────────────────────────────┐
    │   Phase 1 "manual"        Player navigates freely; timer & steps    │
    │   Phase 2 "manual_done"   Stats frozen; A* Tome button appears      │
    │   Phase 3 "astar_running" A* auto-plays the same maze               │
    │   Phase 4 "comparison"    Side-by-side popup: Manual vs A* stats    │
    │                                                                      │
    ├─ Layer 1 – The Race                                                  │
    │   10×10 square maze + fog. Turn-based: you move, Dijkstra moves.    │
    │   First to reach the exit wins. Compare step counts.                │
    │                                                                      │
    ├─ Layer 2 – Weighted Reward                                           │
    │   A "−10 steps" gold circle sits off the optimal path.              │
    │   Your A* is routed through it; Dijkstra ignores it.                │
    │   Unlocks the A* Euclidean Technique tome.                          │
    │                                                                      │
    ├─ Layer 3 – The Hexagon                                               │
    │   10×10 hex maze + fog. Choose Manhattan (yellow) or                │
    │   Euclidean (red) heuristic, then race Dijkstra.                    │
    │   Demonstrates why heuristic choice matters on hex grids.           │
    │   Hex controls: U/I = NW/NE · H/K = W/E · N/M = SW/SE             │
    │                                                                      │
    └─ Layer 4 – Pacman Hunt                                               │
        No fog – full maze visible. Player: top-left (0,0).               │
        Two A* monsters start top-right (9,0). Exit at centre (5,5).      │
        Monsters recompute A* path to you every ~0.4 s. Escape to win.   │
```

---

## Algorithms

| Algorithm | Heuristic h(n) | Best suited for |
|-----------|----------------|-----------------|
| **Dijkstra** | `0` (blind) | Baseline; always optimal, slower |
| **A\* Manhattan** | `|Δx| + |Δy|` | Square 4-way grids |
| **A\* Euclidean** | `√(Δx² + Δy²)` | Any geometry; more accurate on hex |
| **A\* Hex** | Cube-coordinate distance | Hexagonal grids (optimal) |

All algorithms implement the same `PathfindingAlgorithm` interface and return
`(path, visited_order, cost_map)` — making them interchangeable via the **Strategy Pattern**.

### Benchmark (seed = 42, 10 × 10 square grid)

| Algorithm | Path length | Nodes visited |
|-----------|:-----------:|:-------------:|
| Dijkstra | 37 | 55 |
| A\* Manhattan | 37 | **42** |
| A\* Euclidean | 37 | **42** |
| A\* Hex (cube) | 23 | **24** |

---

## Grid Systems

### Square Grid – `SquareGrid`
- 10 × 10, orthogonal **4-way** movement (N / S / E / W)
- Generated by iterative DFS (recursive backtracker)
- Passages stored as `{(col, row): set of (nc, nr)}` — bidirectional

### Hexagonal Grid – `HexGrid`
- 10 × 10, **6-way** movement
- **Odd-r offset** coordinates for storage/display
- Directions indexed `0 = NE, 1 = E, 2 = SE, 3 = SW, 4 = W, 5 = NW`
- Pathfinding heuristics use **cube-coordinate** conversion for correctness

---

## UI Layout

```
┌─────────────────────────────────────────┬──────────────────────┐
│                                         │  Sidebar (420 px)    │
│          Maze Area (680 px)             │  ─ Level title       │
│                                         │  ─ Algorithm card    │
│   [ fog | floor | walls | entities ]    │  ─ Player stats      │
│                                         │  ─ Monster stats     │
│                                         │  ─ Controls          │
│                                         │  ─ Unlocked tomes    │
└─────────────────────────────────────────┴──────────────────────┘
         1100 × 720 px total
```

---

## Controls

| Context | Key / Mouse | Action |
|---------|-------------|--------|
| Menu | Click / `T` `1` `C` | Select mode |
| All mazes | `↑ ↓ ← →` | Move player |
| Hex maze (Layer 3) | `U I H K N M` | Move in 6 directions |
| Tutorial | Click Tome button | Start A\* auto-run |
| Tutorial popup | Click button | Return to menu / next level |
| Any overlay | `Enter` / `Space` | Confirm / advance |
| Any screen | `ESC` | Back / menu |

---

## Key Design Decisions

- **Strategy Pattern** — All algorithms share one interface; swapping them requires zero changes to game logic.
- **Bidirectional passage dict** — `passages[(c,r)]` holds the set of reachable neighbours; used by both the renderer (wall detection) and the pathfinder (neighbour expansion).
- **Fog of war** — Chebyshev radius-2 reveal around the player, accumulated across moves. Layer 4 disables fog entirely for full visibility.
- **Auto-play A\*** — Tutorial Phase 3 advances the player one step every 0.22 s along the pre-computed A\* path, giving a clear visual demonstration without user input.
- **Live A\* chasing** — Layer 4 monsters recompute `find_path(grid, monster_pos, player_pos)` on every movement tick, ensuring they always pursue the optimal route even as the player moves.

---

## File / Module Dependency Graph

```
main.py
 └─ states/state_machine.py
     ├─ states/menu_state.py
     ├─ states/tutorial_state.py  ──┐
     ├─ states/layer1_state.py    ──┤
     ├─ states/layer2_state.py    ──┤─── maze/{generator, square_grid, hex_grid}
     ├─ states/layer3_state.py    ──┤─── algorithms/{dijkstra, astar}
     ├─ states/layer4_state.py    ──┤─── entities/{player, monster}
     └─ states/custom_state.py    ──┘─── ui/{renderer, sidebar}
                                          └─ config.py
```
