# MiniStar Lab — Complete Build Summary

> **Last updated:** 2026-07-09
> **Repository:** https://github.com/Drewsure/ministar-lab
> **Live URL:** https://ministar-lab.vercel.app
> **Purpose:** Full build history + procedures for future sessions

---

## PROJECT OVERVIEW

MiniStar English Global Lab — a multi-tenant, white-label ESL vocabulary game platform built with Next.js 16 + Phaser 3.80.1 + TypeScript.

- **25 games** (24 Phaser scenes + 1 Star Farm Stardew clone)
- **10 themes** (space, jungle, festival, cityscape, ocean, candy, haunted, sports, christmas, easter)
- **5 brands** (multi-tenant white-label)
- **xAPI telemetry** with anti-cheat verification
- **Mobile-first** responsive design
- **ESL features**: TTS on every text, tap-to-hear, audio cues

---

## DEPLOYMENT PROCEDURE (FOLLOW EXACTLY)

### How to deliver code updates

Per `DEPLOY_PROCEDURE.md`:

1. **Create zip:**
```bash
cd /home/z/my-project
rm -f download/ministar-src-clean.zip
zip -r download/ministar-src-clean.zip \
  src/ public/ prisma/ scripts/ \
  package.json bun.lock tsconfig.json next.config.ts next-env.d.ts \
  tailwind.config.ts postcss.config.mjs components.json eslint.config.mjs \
  Caddyfile vercel.json .gitignore \
  -x "node_modules/*" ".*"
```

2. **Give user ONE PowerShell block:**
```
Expand-Archive -Path "$env:USERPROFILE\Downloads\ministar-src-clean.zip" -DestinationPath C:\Users\User\ministar-lab -Force
cd C:\Users\User\ministar-lab
git add .
git commit -m "<descriptive message>"
git push
```

3. **Password note:**
```
If `git push` asks for password: username = Drewsure, password = GitHub PAT from https://github.com/settings/tokens (classic, repo scope)
```

### User environment
- **OS:** Windows (PowerShell)
- **Repo path:** `C:\Users\User\ministar-lab`
- **Branch:** `main`
- **GitHub:** `https://github.com/Drewsure/ministar-lab.git`
- **Auth:** GitHub PAT (classic, repo scope)
- **Deployment:** Vercel auto-deploys on push to `main`

---

## ETERNAL_VIGILANCE.md — 13 CRITICAL CHECKS

Before creating ANY zip, verify ALL of these:

1. **accentHex crash** — `Juice.ts` tick() must NOT reference constructor-scoped `accentHex`
2. **Level badge** — top-LEFT (x=80), 120×36, "LVL 1" (not center, not "LEVEL 1")
3. **Ghosts/player** — MUST be emoji text (👻👹👺💀 / 😋), NOT `add.image` or texture sprite
4. **Update loop** — wrapped in try-catch
5. **Spot It** — card2 pool filters out BOTH matchTerm AND card1 term IDs
6. **Target visibility** — alpha ≥ 0.7, font ≥ 16px
7. **Scene registration** — `scene: []` with explicit key add+start
8. **SSR safety** — `serverExternalPackages: ["phaser"]`
9. **vercel.json** — `{"framework":"nextjs"}`, no BOM, postinstall = `prisma generate || true`
10. **Speed ramping** — slow start (Maze Chase 120px/s, Airplane 0.4x, etc.)
11. **NO infinite tweens** — `repeat: -1` → `repeat: 999` (ROOT CAUSE of all freezes)
12. **Pacing** — player faster than enemies, Scatter Mode, ESL timer min 8s
13. **Black screen prevention** — buildWorld wrapped in try-catch + `_showBuildError()` + feedback on every answer

---

## PACING_AUDIT.md — Per-Game Pacing

### Action Games
| Game | Speed | Notes |
|---|---|---|
| Maze Chase | Player 120px/s, Ghost 80px/s | Ghost = 84% of player (Pac-Man ratio) |
| Airplane | speedMultiplier 0.4→2.0 | Banners stagger 350ms, size 140×48 |
| Endless Runner | speed 40px/s start | Max 120+level×20 |
| Balloon Pop | riseDuration 12s L1 | Min 5s |
| Whack-a-Mole | spawn 1.8s L1 | Stay 3s L1 |
| Snaking | moveInterval 350ms | 3 lives, wall hit = lose life |

### Selection Games
| Game | Timer | Notes |
|---|---|---|
| Spot It | 15s→8s, final 10s | ESL minimum 8s |
| Quiz | Global HUD only | No per-question timer |
| Gameshow | Global HUD, 3 lifelines | No per-question timer |
| Spin Wheel | Untimed | Wheel radius 200, buttons 400×56 |

---

## SCREEN SIZING (CURRENT FIX — July 9)

### Root cause history
The screen sizing went through multiple iterations:
1. `Scale.FIT` with `maxHeight: 70vh` → small box, 30% wasted space
2. `Scale.RESIZE` → squished UI on mobile, zoomed on PC
3. `Scale.RESIZE` with `width:100%, height:100%` canvas → components scattered
4. **CURRENT: `Scale.FIT` + `aspect-ratio: 4/3` container** → matches game ratio, no letterboxing

### Current approach (research-backed)
- **Game dimensions:** 800×600 (4:3 aspect ratio)
- **Scale mode:** `Phaser.Scale.FIT` — scales uniformly, maintains aspect ratio
- **Container CSS:** `aspect-ratio: 4/3, maxWidth: 900px, width: 100%`
- **Canvas styles:** Only accessibility/touch (NO width/height overrides)
- **Result:** Game scales to fill the 4:3 container, no black bars, no squishing

### Key files
- `src/components/ministar/GameCanvas.tsx` — Phaser config + canvas styles
- `src/app/page.tsx` — game frame container with aspect-ratio

---

## RECENT FIXES (July 2026)

### Card/Memory Match fixes
- **Stuck cards:** Removed periodic `tweens.killAll()` (was killing in-flight flip tweens)
- **Bulletproof flip:** Replaced tween `onComplete` with `setTimeout` (always fires)
- **Pairs 7/6:** Removed `+1` over-count (recordAnswer already increments)
- **Card visuals:** Emoji 72px + word 22px, cards 140×160 (responsive to screen size)
- **canInteract delay:** 800ms (matches 680ms flip-back animation)

### Pause system
- **Root cause:** `scene.pause()` freezes ALL input including resume button
- **Fix:** Replaced with `_isPaused` flag — input keeps working, resume button clickable
- **Pause button:** 28px with 60×40 background
- **Pause overlay:** 240×56 buttons stacked vertically, 24px text, green/red backgrounds

### FinishGame screen
- **3 buttons:** Play Again / New Game / ✓ Complete (stacked vertically, 280×50, 22px text)
- **Stats:** 3 separate text lines stacked with 25px spacing (no overlap)
- **Title:** Responsive font size based on screen width

### Group Sort fix
- **Root cause:** Return-to-home tween animated to CURRENT position, not HOME position
- **Fix:** Added `homeX/homeY` to SortTerm, used in bounce-back tween

### Spin Wheel fix
- **Wheel radius:** 140→200
- **Segment text:** 20px→24px
- **Spin button:** 180×50→220×56
- **Option buttons:** 320×50→400×56, text 18px→20px

### Maze Chase fixes
- **Ghosts:** Emoji text (👻👹👺💀), NOT `add.image` (CHECK 3)
- **Player:** Emoji text (😋), physics-enabled, NOT texture sprite
- **Infinite tweens:** All `repeat: -1` → `repeat: 999` (CHECK 11)

### Airplane fixes
- **Clouds (not bricks):** Ellipse + 3 puff circles, white/blue
- **Staggered spawns:** 350ms apart (not all at once)
- **Varied fall speed:** 0.9/1.0/1.1 (minimal variation)
- **Smaller banners:** 140×48 (was 180×64)

### Spot It fixes
- **Timer:** 15s→8s minimum (was 12s→4s — impossible for ESL)
- **Telemetry:** MAX_COORDINATE_JUMP_PX 1800→4000 (false-positive quarantine fix)

### Word Snake fixes
- **3 lives:** Wall hit loses a life (was instant game over)
- **Slower start:** 350ms move interval (was 250ms)
- **Food tappable:** Local pointerdown speaks word (no stopPropagation)

---

## STAR FARM (Stardew Valley Clone)

### Features
- **1791 lines** in `StarFarmScene.ts`
- **16×9 tilemap** with 7 terrain types (grass, dirt, water, paths, rocks, trees, forage)
- **16 crops** across 4 seasons (Spring/Summer/Fall/Winter, 28 days each)
- **6 tools** (Hoe, Watering Can, Seeds, Harvest, Axe, Pickaxe) with Lv1-3 upgrades
- **4 animals** (🐔 Chicken, 🐄 Cow, 🐑 Sheep, 🐷 Pig) — feed daily, collect produce
- **6 fish** + fishing minigame (cast → wait → bite → reel)
- **10 cooking recipes** (Salad, Soup, Pie, Juice, Pizza, Bread, Wine, Coffee, Fruit Bowl, Star Cake)
- **8 seasonal festivals** (Spring Flower, Summer Luau, Fall Harvest, Winter Star + finales)
- **5 NPCs** with 5-heart friendship system (Shop, Quest, Friend, Cook)
- **24 achievements** (First Harvest, Master Farmer, Wealthy, Angler, etc.)
- **Mining + tree chopping + foraging**
- **Save/load** (localStorage)
- **Day/night cycle** + weather + energy system
- **Procedural farmer sprite** with 4-direction × 2-frame walk cycle
- **Camera follow** + screen shake + night overlay + shadows

---

## GAME LIST (25 games)

### Selection Engine (Physics & Choice)
1. Maze Chase 🌽
2. Quiz ❓
3. Balloon Pop 🎈
4. Gameshow 🎮
5. Spin Wheel 🎡
6. Memory Match 🃏
7. Airplane ✈️
8. Whack-a-Mole 🔨
9. Flash Cards 📇
10. Group Sort 📊
11. Bridge Builder 🌉
12. Label It 🏷️
13. Endless Runner 🏃
14. Physics Puzzler 🎯
15. Snaking 🐍
16. Training Academy 🎓
17. Rescue Quest 🦸
18. Spot It 👁️
19. Tower Defense 🏰
20. Rhythm Tap 🎵
21. Space Explorer 🚀
22. Story Adventure 📖
23. Treasure Hunt 🗺️
24. Star Farm 🌾

### Pairing Engine (Match & Compare)
- Match Up, Memory Match, Group Sort

### Text Engine (Spelling & Words)
- Anagram, Wordsearch, Crossword, Type Answer, Bridge Builder

---

## KEY FILES

### Game engine
- `src/game/BaseEngine.ts` — Abstract base class for all games
- `src/game/Juice.ts` — Particles, shake, flash, HUD, ThemeAtlas
- `src/components/ministar/GameCanvas.tsx` — Phaser bootstrap + scaling

### Game scenes
- `src/game/scenes/*.ts` — 25 scene files (one per game)

### Configuration
- `src/lib/gameModes.ts` — Game metadata (id, name, emoji, minTerms, etc.)
- `src/lib/types.ts` — TypeScript types (GameModeId, TermItem, etc.)
- `src/lib/themes.ts` — 10 theme manifests
- `src/lib/telemetry.ts` — xAPI events + verification

### Documentation
- `ETERNAL_VIGILANCE.md` — 13 critical checks (READ BEFORE EVERY DELIVERY)
- `DEPLOY_PROCEDURE.md` — How to deliver code (zip + PowerShell)
- `PACING_AUDIT.md` — Per-game pacing analysis
- `QUALITY_BENCHMARKS.md` — Wordwall/Blooket competitor research

---

## KNOWN ISSUES (as of July 9)

1. **Screen sizing:** Using Scale.FIT + aspect-ratio:4/3 container. Components stay proportional. If still not filling screen, the container maxWidth:900px may need to be increased.
2. **Theme icons:** Some game icons (target language emojis) may still be small — need per-game audit
3. **Mobile landscape:** Orientation change listener added but may need testing

---

## BUILD COMMANDS

```bash
# Type-check
npx tsc --noEmit

# Build (production)
npx next build

# Dev server
npx next dev -p 3000

# Create deploy zip
rm -f download/ministar-src-clean.zip
zip -r download/ministar-src-clean.zip src/ public/ prisma/ scripts/ \
  package.json bun.lock tsconfig.json next.config.ts next-env.d.ts \
  tailwind.config.ts postcss.config.mjs components.json eslint.config.mjs \
  Caddyfile vercel.json .gitignore \
  -x "node_modules/*" ".*"
```

---

## NEXT STEPS

1. **Per-game icon audit** — check all 25 games for small icons/emojis
2. **Screen sizing verification** — test on PC + iPhone portrait + iPhone landscape
3. **More Star Farm features** — seasons, animals, festivals all built; could add more crops/NPCs
4. **Performance audit** — check FPS on mobile
5. **Accessibility audit** — screen reader, keyboard navigation

---

## IMPORTANT NOTES FOR FUTURE SESSIONS

1. **ALWAYS read `ETERNAL_VIGILANCE.md` before creating a zip** — the 13 checks prevent recurring bugs
2. **ALWAYS follow `DEPLOY_PROCEDURE.md`** — zip named `ministar-src-clean.zip`, ONE PowerShell block
3. **NEVER use `scene.pause()`** — use `_isPaused` flag instead (freezes input)
4. **NEVER use `repeat: -1`** — use `repeat: 999` (causes freezes when target destroyed)
5. **NEVER use `tweens.killAll()` periodically** — kills in-flight tweens, causes stuck cards
6. **NEVER use `cam.zoomTo()` (zoomPunch)** — corrupts camera tween state → freeze
7. **ALWAYS use `setTimeout` for critical callbacks** — tween onComplete can be killed
8. **Screen sizing:** Scale.FIT + aspect-ratio:4/3 container = no letterboxing
9. **Ghosts/player:** MUST be emoji text, NOT add.image or texture sprite
10. **Cards:** 800ms canInteract delay (matches 680ms flip animation)
