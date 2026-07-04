# Game Design Research Findings — Applied to MiniStar 28 Games

**Research Date:** 2026-07-04
**Sources:** 25 web searches across academic papers, game design forums, educational technology sites, and competitor analysis (Kahoot, Blooket, Duolingo, Wordwall)

---

## KEY FINDINGS FROM RESEARCH

### 1. Difficulty Curve (from game design research)
- **Gradual increase** is essential — players like "gradually increasing difficulty"
- **Reverse difficulty curves are bad** — starting too hard causes frustration
- **Flow state** requires difficulty matching skill level
- **Application:** Each level should increase ONE parameter (speed, complexity, time pressure, or enemy count) — not all at once

### 2. Streak Systems (from Kahoot/Duolingo research)
- Kahoot: "Answer streaks award bonus points for consecutive correct answers"
- Duolingo: Streaks build habits — "streaks are the perfect way to build a study habit that actually sticks"
- **Key insight:** Streaks should NOT punish breaking — only reward maintaining
- **Application:** Streak milestones at 3, 5, 10, 15 with increasing visual celebration

### 3. Spaced Repetition + Gamification (from academic research)
- "Combining spaced repetition with gamification produces 3x better retention than either approach alone"
- "Without spaced repetition, learning atrophies to 10% or less"
- **Application:** Terms the student gets wrong should reappear more frequently in later rounds

### 4. Speed-Based Scoring (from Kahoot research)
- Kahoot: "Points awarded based on speed of answer — divide response time by question timer"
- Faster answers = more points = more engagement
- **Application:** Time bonus on correct answers (faster = more XP)

### 5. Pac-Man Ghost AI (from game design research)
- 4 ghosts with DIFFERENT behaviors: Blinky (chase), Pinky (ambush), Inky (flank), Clyde (random)
- **Application:** Maze Chase should have ghosts with different chase patterns per level

### 6. Snake Game Difficulty (from Reddit/game design)
- "Difficulty increments itself at same pace as player progresses"
- Speed increase + growth = natural difficulty ramp
- **Application:** Snake speed increases per correct word, not per level

### 7. Educational Game Retention (from academic papers)
- "Experimental group's vocabulary learning and retention were significantly higher than control"
- "Gamified English vocabulary learning significantly better than non-gamified"
- **Application:** All games must reinforce vocabulary through repeated exposure

### 8. Duolingo Gamification Secrets
- XP system + badges + leagues + streaks = retention
- "Achievers focus on points, badges, and statuses"
- "Badge reward system is a core tactic to improve user retention through achievement"
- **Application:** Achievement badges on completion screen

### 9. Word Search Difficulty Scaling
- Grid size increases with difficulty
- More words = harder
- Diagonal/backwards words = harder
- **Application:** Level 1-2: horizontal only, Level 3-4: add vertical, Level 5: add diagonal

### 10. Memory Match Difficulty
- Start with 4 pairs (8 cards)
- Increase to 6, 8, 10 pairs per level
- **Application:** Card count increases per level

---

## APPLIED DESIGN: 5-LEVEL PROGRESSION SYSTEM

### Level Structure (all 24 Phaser games)

| Level | Score Range | Difficulty Change | Visual Indicator |
|---|---|---|---|
| 1 | 0-2 | Base speed, base complexity | Level badge: blue |
| 2 | 3-5 | +20% speed OR +1 enemy OR -10% timer | Level badge: green |
| 3 | 6-8 | +40% speed OR +2 enemies OR -20% timer | Level badge: yellow |
| 4 | 9-11 | +60% speed OR +1 decoy per round OR -30% timer | Level badge: orange |
| 5 | 12+ | Max difficulty, all modifiers active | Level badge: red |

### Per-Game Difficulty Application

| Game | Level 1 | Level 2 | Level 3 | Level 4 | Level 5 |
|---|---|---|---|---|---|
| Maze Chase | 1 ghost, slow | 1 ghost, faster | 2 ghosts | 2 ghosts, faster | 3 ghosts, max speed |
| Quiz | 4 choices, 30s/q | 4 choices, 20s/q | 4 choices, 15s/q | 5 choices, 12s/q | 5 choices, 10s/q |
| Airplane | Slow banners | +20% speed | +storm clouds | +40% speed | Max speed + storms |
| Gameshow | 3 lifelines | 2 lifelines | 1 lifeline | 1 lifeline, faster | No lifelines, max speed |
| Memory Match | 4 pairs | 5 pairs | 6 pairs | 7 pairs | 8 pairs |
| Match Up | 4 pairs | 5 pairs | 6 pairs | 7 pairs | 8 pairs |
| Balloon Pop | Slow rise | +20% speed | +carrier moves | +40% speed | Max speed + moving carrier |
| Whack-a-Mole | 3s stay | 2.5s stay | 2s stay | 1.5s stay | 1.2s stay |
| Anagram | 4-letter words | 5-letter | 6-letter | 7-letter | 8+ letter |
| Word Search | 6x6 grid, horizontal | 8x8, +vertical | 10x10, +diagonal | 12x12, +backwards | 14x14, all directions |
| Bridge Builder | 6 wrong allowed | 5 wrong | 4 wrong | 3 wrong | 2 wrong |
| Crossword | 4 words | 5 words | 6 words | 7 words | 8 words |
| Flash Cards | 8 cards | 10 cards | 12 cards | 14 cards | 16 cards |
| Spin Wheel | 6 segments | 8 segments | 10 segments | 12 segments | 14 segments |
| Group Sort | 2 categories | 3 categories | 4 categories | 5 categories | 6 categories |
| Type Answer | 10s per word | 8s | 6s | 5s | 4s |
| Spot It | 4 symbols/card | 5 symbols | 6 symbols | 7 symbols | 8 symbols |
| Endless Runner | 60 speed | 80 speed | 100 speed | 120 speed | 150 speed |
| Physics Puzzler | 15 ammo, slow blocks | 12 ammo | 10 ammo, faster | 8 ammo, faster | 6 ammo, max speed |
| Word Snake | 250ms move | 220ms | 190ms | 160ms | 130ms |
| Speak It | 8s to answer | 7s | 6s | 5s | 4s |
| Training Academy | 6 commands | 8 commands | 10 commands | 12 commands | 15 commands |
| Rescue Quest | 3 obstacles | 4 obstacles | 5 obstacles | 6 obstacles | 7 obstacles |
| Label It | 4 choices | 4 choices, less time | 5 choices | 5 choices, less time | 6 choices |
