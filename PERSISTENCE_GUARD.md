# PERSISTENCE GUARD — Anti-Regression Canon

> **Purpose:** Prevent the recurring problem where new updates cause OTHER features to silently revert. This document is a BINDING checklist that MUST be verified before EVERY deployment.
>
> **How to use:** Run `bash scripts/verify-aaaa-features.sh` before deploying. If ANY check fails, the deployment is BLOCKED. Fix the missing feature from the spec in this document, re-run until ALL pass.

## AAAA Feature Inventory

### 1. BaseEngine.ts — Core Infrastructure

| Feature | Grep Pattern | Min |
|---------|-------------|-----|
| Auto-celebrate opt-out | `_skipAutoCelebrate` | 2 |
| Auto-mascot opt-out | `_skipAutoMascot` | 2 |
| Sticker book opt-out | `_skipAutoStickerBook` | 2 |
| Auto-mascot creation | `_createAutoMascot` | 2 |
| Mascot celebrate | `_mascotCelebrate` | 2 |
| Sticker badge | `_createStickerBadge` | 2 |
| Sticker award | `_awardSticker` | 2 |
| Slow mode | `isSlowMode` | 2 |
| Extended time | `isExtendedTime` | 2 |
| timeMultiplier | `timeMultiplier` | 1 |
| questionMultiplier | `questionMultiplier` | 2 |
| speakPromptWithHighlight | `speakPromptWithHighlight` | 1 |
| makeHoverSpeakable | `makeHoverSpeakable` | 1 |
| _togglePause | `_togglePause` | 3 |
| timeScale=0 | `timeScale = 0` | 1 |
| timeScale=1 | `timeScale = 1` | 1 |
| physics pause | `physics.world.pause` | 1 |
| physics resume | `physics.world.resume` | 1 |
| Overlay depth 950 | `setDepth(950)` | 2 |
| KidsJuice import | `import { KidsJuice }` | 1 |
| celebrateCorrect call | `KidsJuice.celebrateCorrect` | 1 |
| clearHighlights | `KidsJuice.clearHighlights` | 2 |
| Mascot emoji map | `_MASCOT_EMOJIS` | 1 |
| _isPaused guards | `this._isPaused` | 3 |
| setupGlobalPointer guard | `this._isPaused` in setupGlobalPointer | 1 |

### 2. KidsJuice.ts

| Feature | Grep Pattern | Min |
|---------|-------------|-----|
| speakWithHighlight | `static speakWithHighlight` | 1 |
| celebrateCorrect | `static celebrateCorrect` | 1 |
| vfxExplosion | `static vfxExplosion` | 1 |
| confettiRain | `static confettiRain` | 1 |
| HIGHLIGHT_COLORS | `export const HIGHLIGHT_COLORS` | 1 |
| CELEBRATION_PHRASES | `export const CELEBRATION_PHRASES` | 1 |
| C4 523Hz | `freq: 523` | 1 |
| E4 659Hz | `freq: 659` | 1 |
| G4 784Hz | `freq: 784` | 1 |
| C5 1046Hz | `freq: 1046` | 1 |

### 3. audio.ts

| Feature | Grep Pattern | Min |
|---------|-------------|-----|
| onStart callback | `onStart` | 3 |
| onEnd callback | `onEnd` | 3 |

### 4. page.tsx

| Feature | Grep Pattern | Min |
|---------|-------------|-----|
| slowMode state | `slowMode` | 2 |
| extendedTime state | `extendedTime` | 2 |
| 🐢 Slow button | `🐢 Slow` | 1 |
| ⏱️ Time+ button | `⏱️ Time` | 1 |

### 5. All 32 Games

| Feature | Expected |
|---------|----------|
| speakPromptWithHighlight | 32/32 games |
| makeHoverSpeakable | 32/32 games |

### 6. QuizScene.ts — Living Storybook (712+ lines)

| Feature | Grep Pattern | Must Exist |
|---------|-------------|-----------|
| Storybook mascot | `_createStoryMascot\|storyMascot` | YES |
| Squishy hover | `_squishyHover` | YES |
| Squishy tap | `_squishyTap` | YES |
| Ripple ring | `_rippleRing` | YES |
| Bouncy background | `_createBouncyBackground\|_bouncyDecos` | YES |
| Mascot happy bounce | `_mascotHappyBounce` | YES |
| Mascot gentle nod | `_mascotGentleNod` | YES |
| Serif font | `Georgia` | YES |
| Opt out auto-mascot | `_skipAutoMascot = true` | YES |

### 7. GameshowScene.ts — Supercharged Spectacle (627+ lines)

| Feature | Grep Pattern | Must Exist |
|---------|-------------|-----------|
| Host showman | `_createHost\|hostCharacter` | YES |
| Neon borders | `_createNeonBorders\|neonBorders` | YES |
| Arcade buzzer | `_arcadeBuzzerSink` | YES |
| Camera zoom | `_cameraZoom\|zoomTo` | YES |
| Coin cascade | `_coinCascade` | YES |
| Pie-in-face | `_pieInFace` | YES |
| Dark navy bg | `0x0a0a1a` | YES |
| Arial Black | `Arial Black` | YES |
| NO camera.pan | `cameras.main.pan` | MUST NOT EXIST |

### 8. AirplaneScene.ts — Storm Clouds

| Feature | Grep Pattern | Must Exist |
|---------|-------------|-----------|
| StormCloud interface | `interface StormCloud` | YES |
| _spawnStormCloud | `_spawnStormCloud` | YES |
| _handleStormHit | `_handleStormHit` | YES |
| slowedUntil | `slowedUntil` | YES |
| Storm 12% spawn | `Math.random() < 0.12` | YES |
| Speed cap 1.5 | `Math.min(1.5` | YES |

### 9. SnakingScene.ts — AAAA Letter Snake (450+ lines)

| Feature | Grep Pattern | Must Exist |
|---------|-------------|-----------|
| LetterBubble | `interface LetterBubble` | YES |
| Letter spelling | `lettersCollected` | YES |
| Soft bounce | `_softBounce` | YES |
| Expressive eyes | `_updateEyes\|snakeEyes` | YES |
| Hit-stop | `hitStopUntil` | YES |
| Progress slots | `progressSlots` | YES |
| Word complete | `_wordComplete` | YES |
| Magnetic pull | `1.25` | YES |
| D-pad | `_createDPad` | YES |
| NO finishGame(false) | `finishGame\(false\)` | MUST NOT EXIST |

### 10. Pacing Fixes

| Game | Check |
|------|-------|
| EndlessRunner | `private speed = 30` + `70 + (this.level - 1) * 8` |
| WhackAMole | `Math.max(1000, 2000` + `Math.max(1800, 3500` |
| BalloonPop | `Math.max(8000, 14000` |
| RhythmTap | `1.0 + Math.min(1.2` |
| TowerDefense | `0.003 + this.currentWave * 0.0015` |

### 11. Hyper-Focus Window (FILL 150s)

| Game | Expected Cap |
|------|-------------|
| Airplane | 15 |
| Anagram | 7 |
| BalloonPop | 15 |
| BridgeBuilder | 7 |
| Crossword | 7 |
| EndlessRunner | 15 |
| FarmLife | 15 |
| FlashCards | 15 |
| Gameshow | 8 |
| GroupSort | 10 |
| LabelIt | 10 |
| MatchUp | 10 |
| MazeChase | 10 |
| MemoryMatch | 8 |
| PhysicsPuzzler | 7 |
| Quiz | 8 |
| RhythmTap | 15 |
| Snaking | 6 |
| SpaceExplorer | 10 |
| SpeakIt | 10 |
| SpinWheel | 8 |
| SpotIt | 15 |
| StarFarm | 10 |
| TowerDefense | 7 |
| TrainingAcademy | 10 |
| TreasureHunt | 8 |
| TypeAnswer | 8 |
| WhackAMole | 15 |
| Wordsearch | 6 |

**HUD Timer:** `src/game/Juice.ts` — `initialTimeMs = 150_000` (2.5 minutes).

## Binding Rule

**This document is BINDING.** Any deployment that does not pass `scripts/verify-aaaa-features.sh` is INVALID. If a feature is missing, re-add it from this spec before deploying.
