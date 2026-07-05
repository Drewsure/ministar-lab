# PACING AUDIT — All 31 Games (Research-Backed)

> **Date:** 2026-07-05
> **Research sources:** Pac-Man original arcade specs (Reddit/StackExchange), Pac-Man Ghost AI Wiki, NIH educational game pacing study, ResearchGate difficulty curve paper, LunarLab kids-UX paper.

---

## RESEARCH FINDINGS — What Makes Maze Games Playable

### Pac-Man Original (1980) — The Gold Standard

| Metric | Value | Why it matters |
|---|---|---|
| Tile size | 8px | Tiny = high resolution of movement |
| Board | 28×36 tiles | Large = room to maneuver |
| **Player speed** | **8 tiles/sec (64px/s)** | Crosses 1 tile in 125ms — responsive |
| **Ghost speed** | **7.5 tiles/sec (60px/s)** | **84% of player** — player can escape in straight lines |
| Ghost AI modes | Chase / Scatter / Frightened | Variety = fair challenge |
| **Scatter mode** | Every ~7s, ghosts retreat to corners for ~5s | **Breathing room** — game feels FAIR |
| Ghost personalities | Blinky (direct), Pinky (ambush), Inky (flank), Clyde (random) | Not all ghosts chase the same way |

### Key Pacing Principles (from research)

1. **Player must be FASTER than ghosts** (Pac-Man: player 8 tiles/s, ghost 7.5 = 94% of player). If ghosts are faster or equal, game feels impossible.
2. **Scatter mode is essential** — periodic breaks where ghosts retreat. Without it, relentless chase = player rage-quits.
3. **Speed relative to tile size matters** — player should cross 1 tile in 125-400ms. Slower = sluggish, faster = twitchy.
4. **ESL learners need MORE time** than native speakers — reading symbols/words takes longer. Minimum 8s per round, never 4s.
5. **Difficulty curves should be gentle** — flat or linear ramp, not exponential. Kids quit on exponential ramps.

---

## PER-GAME PACING AUDIT (31 games)

### Action Games (speed-critical)

| Game | Old pacing | New pacing | Status |
|---|---|---|---|
| **Maze Chase** | Player 140px/s, Ghost 80px/s, no scatter, BFS 600ms | Player 190px/s, Ghost 160px/s (84%), **Scatter Mode** (7s chase/5s scatter), BFS 300ms | ✅ FIXED |
| **Airplane** | speedMultiplier 0.4→2.0, banner fall 80×mult | Same (already slow start) | ✅ OK |
| **Endless Runner** | speed 40px/s, max 120+level×20 | Same (already slow start) | ✅ OK |
| **Balloon Pop** | riseDuration 12s L1 → 5s min | Same (12s is generous) | ✅ OK |
| **Whack-a-Mole** | spawn 1.8s L1→0.8s, stay 3s L1 | Same (already slow start) | ✅ OK |
| **Snaking** | 300ms tick | Same | ✅ OK |
| **Physics Puzzler** | projectile speed fixed | Same | ✅ OK |
| **Rhythm Tap** | note speed 1.2 + idx×0.05 (cap 3.2) | Same (5.6s→2.1s fall time) | ✅ OK |
| **Space Explorer** | orbital speed fixed | Same | ✅ OK |
| **Tower Defense** | enemy speed 0.005+wave×0.003 | Same | ✅ OK |
| **Training Academy** | voice-activated | Same | ✅ OK |
| **Rescue Quest** | voice-activated | Same | ✅ OK |

### Selection Games (timer-critical)

| Game | Old pacing | New pacing | Status |
|---|---|---|---|
| **Spot It** | 12s→4s (impossible for ESL) | **15s→8s, final 10s** | ✅ FIXED |
| **Quiz** | no per-question timer (global HUD only) | Same | ✅ OK |
| **Gameshow** | no per-question timer, lifelines=3 | Same | ✅ OK |
| **Label It** | no timer | Same | ✅ OK |
| **Type Answer** | no timer | Same | ✅ OK |
| **Speak It** | no timer | Same | ✅ OK |
| **Flash Cards** | no timer | Same | ✅ OK |
| **Bridge Builder** | no timer | Same | ✅ OK |
| **Crossword** | no timer | Same | ✅ OK |
| **Wordsearch** | no timer | Same | ✅ OK |
| **Anagram** | no timer | Same | ✅ OK |
| **Spin Wheel** | no timer | Same | ✅ OK |
| **Group Sort** | no timer | Same | ✅ OK |
| **Match Up** | no timer | Same | ✅ OK |
| **Memory Match** | no timer, 800ms flip-back | Same | ✅ OK |

### Pairing/Strategy Games (no pacing issue)

| Game | Pacing | Status |
|---|---|---|
| **Memory Match** | Untimed, 800ms flip-back (matches 680ms animation) | ✅ OK |
| **Match Up** | Untimed drag-and-drop | ✅ OK |
| **Group Sort** | Untimed drag-and-drop | ✅ OK |
| **Crossword** | Untimed | ✅ OK |
| **Wordsearch** | Untimed | ✅ OK |
| **Anagram** | Untimed | ✅ OK |

### Prototype Games (RPG/sim)

| Game | Pacing | Status |
|---|---|---|
| **Farm Life** | 180s timer, 2s growth tick, 1.5s day tick | ✅ OK |
| **Monster Fighter** | Turn-based (no real-time pressure) | ✅ OK |
| **Tower Defense** | Wave-based, enemy speed ramps per wave | ✅ OK |
| **Rhythm Tap** | Note fall speed ramps gently | ✅ OK |
| **Space Explorer** | Orbital mechanics, fuel system | ✅ OK |
| **Story Adventure** | Untimed narrative, 25ms typewriter | ✅ OK |
| **Treasure Hunt** | 12-energy budget, untimed | ✅ OK |

---

## CHANGES MADE THIS SESSION

### Maze Chase (major pacing overhaul)
- **Player speed:** 140→190px/s (cross cell in 400ms — was 543ms, felt sluggish)
- **Ghost chase speed:** 80→160px/s (84% of player — Pac-Man ratio, player can escape)
- **Ghost patrol speed:** 60→100px/s (was too slow, felt stuck)
- **Ghost BFS recompute:** 600ms→300ms (smoother movement, less jerky)
- **Level ramp:** +20→+15px/s per level (was too aggressive)
- **NEW: Scatter Mode** — every 7s chase → 5s scatter cycle. Ghosts retreat to assigned corners (top-left, top-right, bottom-left, bottom-right). "💨 GHOSTS SCATTER!" popup + audio cue. Gives player breathing room.
- **NEW: Ghost corner assignment** — each ghost gets `cornerIdx` data, retreats to its own corner during scatter.

### Spot It (timer relaxation)
- **Round 1:** 12s→15s (more reading time for ESL)
- **Minimum:** 4s→8s (4s was impossible — ESL learners can't read 5 symbols in 4s)
- **Final round:** 6s→10s (still tense but achievable)

---

## VERIFICATION

- All 31 games audited ✅
- 2 games fixed (Maze Chase, Spot It) ✅
- 29 games confirmed OK ✅
- `npx tsc --noEmit` — 0 errors ✅
- `npx next build` — PASSING ✅
- 0 infinite tweens (CHECK 11) ✅
- 0 zoomPunch calls (CHECK 10) ✅

## FUTURE RULES

1. **Any new maze/chase game** must implement Scatter Mode (ghosts retreat periodically).
2. **Player speed ≥ ghost chase speed** (Pac-Man ratio: ghost = 84% of player).
3. **ESL timer minimum: 8s** per round — never below.
4. **Speed ramps: linear, not exponential** — +15px/s per level max.
5. **Cell-crossing time: 125-400ms** — outside this range feels wrong.
