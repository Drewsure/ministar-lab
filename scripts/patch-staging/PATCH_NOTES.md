# MiniStar Lab — Patch: Bug Fixes + 6 Prototype Upgrades + Treasure Hunt

## What's in this patch

### Critical bug fixes (user-reported)

1. **Game canvas not filling the screen** — Removed inline canvas styles
   (maxHeight: 70vh, width: auto, height: auto) that were overriding
   Phaser's Scale.FIT mode. The game canvas now fills its parent container
   (4:3 aspect ratio, 1100px max-width).

2. **Memory Match cards stuck on reveal side** — Root cause was an 8-second
   periodic tweens.killAll() in BaseEngine that killed the in-flight
   flip-back animation, so isFlipped=false never ran and cards stayed
   permanently flipped + unclickable. Removed the periodic killer entirely
   (shutdown/destroy handlers + GameObject.destroy override are sufficient).
   Also bumped canInteract delay from 400ms to 800ms (animation takes 680ms).

### Game upgrades (6 prototype scenes expanded)

| Scene | Old lines | New lines | Key additions |
|-------|-----------|-----------|---------------|
| RhythmTapScene     | 150 | 389 | 3-lane Guitar Hero, combo x5/x10/x20, accuracy tracker |
| MonsterFighterScene| 202 | 320 | Floating damage numbers, XP bar, mid-battle level-up, ULTIMA spell |
| FarmLifeScene      | 273 | 410 | Day/night cycle, weather (sunny/rainy/stormy), animal care |
| TowerDefenseScene  | 183 | 425 | 2 lanes, 3 tower types, tower placement + upgrades, projectiles |
| SpaceExplorerScene | 156 | 320 | Orbital mechanics, rocket ship, asteroids, discovery log |
| StoryAdventureScene| 184 | 285 | 9 chapters (was 5), 3 endings, inventory, typewriter effect |

### New game: Treasure Hunt (31st game)

Minesweeper-meets-treasure-hunt on a 5x5 grid. Dig plots to find hidden
treasures. Hint numbers show adjacent treasure count (color-coded). Vocab
question on each treasure discovery. Bonus shovel powerup every 3 correct
answers. 12-energy dig budget.

## How to deploy

You already pushed the previous commit. For this patch:

```powershell
# 1. Unzip this archive in your ministar-lab folder
#    (overwrite existing files when prompted)

# 2. From your ministar-lab folder:
git add .
git commit -m "fix: screen-fill + memory-match stuck cards; upgrade 6 prototypes; add Treasure Hunt (31 games)"
git push origin main

# 3. Vercel auto-deploys - watch https://ministar-lab.vercel.app
```

## Verification

- tsc --noEmit passes (0 errors in src/)
- next build passes (4.2s compile time)
- All 31 games registered in GameCanvas, types, and gameModes
- All 31 games have entry-speech in BaseEngine.speakGameInstructions()
- Daily Challenge button now cycles through all 31 games
- Hero badge + footer count updated to "31 Games"

## File summary

- Modified: GameCanvas.tsx, page.tsx, BaseEngine.ts, MemoryMatchScene.ts,
  RhythmTapScene.ts, MonsterFighterScene.ts, FarmLifeScene.ts,
  TowerDefenseScene.ts, SpaceExplorerScene.ts, StoryAdventureScene.ts,
  types.ts, gameModes.ts
- Added: TreasureHuntScene.ts

Total games: 31 (24 original Phaser + 6 upgraded prototypes + 1 new Treasure Hunt)
