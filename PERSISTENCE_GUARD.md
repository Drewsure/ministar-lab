# PERSISTENCE GUARD — Anti-Regression Canon

> **Purpose:** Prevent the recurring problem where new updates to specific games cause OTHER games' AAAA features to silently revert to old versions. This document is a BINDING checklist that MUST be verified before EVERY deployment.
>
> **Root cause:** Session context resets + large file rewrites cause the AI to lose track of features added in prior turns. Files get overwritten with older versions, losing hours of work.
>
> **Solution:** This document lists EVERY AAAA feature, its exact file location, the grep pattern to verify it, and the expected result. Run the verification script before deploying. If ANY check fails, the deployment is BLOCKED.

---

## How to Use This Document

### Before ANY deployment:
1. Run the verification script: `bash scripts/verify-aaaa-features.sh`
2. If ANY check fails, STOP — do not deploy
3. Re-add the missing feature from the specification in this document
4. Re-run the verification script until ALL checks pass
5. Only then deploy

### Before rewriting ANY game scene:
1. Read this document to see what features that game MUST have
2. After rewriting, verify the game still has all its features
3. Run the full verification script to ensure no OTHER game was affected

---

## AAAA Feature Inventory

### 1. BaseEngine.ts — Core Infrastructure

**File:** `src/game/BaseEngine.ts`
**Expected line count:** ~1040+ lines

| Feature | Grep Pattern | Expected Matches |
|---------|-------------|-----------------|
| Auto-celebrate opt-out flag | `_skipAutoCelebrate` | 3+ (field + recordAnswer guard + Quiz/Gameshow opt-out) |
| Auto-mascot opt-out flag | `_skipAutoMascot` | 3+ (field + create guard + Quiz opt-out) |
| Sticker book opt-out flag | `_skipAutoStickerBook` | 3+ (field + create guard + Quiz opt-out) |
| Auto-mascot creation | `_createAutoMascot` | 2+ (method + delayedCall) |
| Mascot celebrate | `_mascotCelebrate` | 2+ (method + EventBus listener) |
| Sticker badge creation | `_createStickerBadge` | 2+ (method + delayedCall) |
| Sticker award | `_awardSticker` | 2+ (method + EventBus listener) |
| Slow mode API | `isSlowMode\|timeMultiplier` | 5+ |
| Extended time API | `isExtendedTime\|questionMultiplier` | 5+ |
| Static setters | `setSlowMode\|setExtendedTime` | 2+ each |
| Static getters | `getSlowMode\|getExtendedTime\|getStickerCount` | 3+ |
| Question multiplier in init | `questionMultiplier()` | 1+ (in init) |
| speakPromptWithHighlight | `speakPromptWithHighlight` | 1+ (method definition) |
| clearPromptHighlights | `clearPromptHighlights` | 1+ (method definition) |
| makeHoverSpeakable | `makeHoverSpeakable` | 1+ (method definition) |
| makeHoverSpeakable _isPaused guard | `if (this._isPaused` in makeHoverSpeakable | 2 (pointerover + pointerdown) |
| setupGlobalPointer _isPaused guard | `if (this._isPaused` in setupGlobalPointer | 1 |
| _togglePause centralized | `_togglePause` | 4+ (method + 3 call sites) |
| timeScale = 0 on pause | `timeScale = 0` | 1+ (in _togglePause) |
| timeScale = 1 on resume | `timeScale = 1` | 1+ (in _togglePause) |
| physics.world.pause | `physics.world.pause` | 1+ (in _togglePause) |
| physics.world.resume | `physics.world.resume` | 1+ (in _togglePause) |
| Overlay setInteractive | `setInteractive` in _showPauseOverlay | 1+ (overlay rectangle) |
| Overlay depth 950 | `setDepth(950)` | 2+ (overlay + container) |
| KidsJuice import | `import { KidsJuice }` | 1 |
| KidsJuice.celebrateCorrect call | `KidsJuice.celebrateCorrect` | 1+ (in recordAnswer) |
| KidsJuice.clearHighlights on shutdown | `KidsJuice.clearHighlights` | 2+ (shutdown + clearPromptHighlights) |
| Mascot emoji map | `_MASCOT_EMOJIS` | 1 (32-entry map) |
| Sticker storage key | `STICKER_STORAGE_KEY` | 3+ |
| Sticker emojis | `STICKER_EMOJIS` | 2+ |

### 2. KidsJuice.ts — Shared Helper

**File:** `src/game/KidsJuice.ts`
**Must exist:** YES
**Expected line count:** ~320+ lines

| Feature | Grep Pattern | Expected Matches |
|---------|-------------|-----------------|
| speakWithHighlight method | `static speakWithHighlight` | 1 |
| clearHighlights method | `static clearHighlights` | 1 |
| celebrateCorrect method | `static celebrateCorrect` | 1 |
| vfxExplosion method | `static vfxExplosion` | 1 |
| confettiRain method | `static confettiRain` | 1 |
| randomPraise method | `static randomPraise` | 1 |
| randomCelebration method | `static randomCelebration` | 1 |
| randomSticker method | `static randomSticker` | 1 |
| HIGHLIGHT_COLORS export | `export const HIGHLIGHT_COLORS` | 1 |
| CELEBRATION_PHRASES export | `export const CELEBRATION_PHRASES` | 1 |
| PRAISE_PHRASES export | `export const PRAISE_PHRASES` | 1 |
| STICKER_EMOJIS export | `export const STICKER_EMOJIS` | 1 |
| CONFETTI_EMOJIS export | `export const CONFETTI_EMOJIS` | 1 |
| celebrateCorrect: 7-layer fanfare | `audioBus.play('win')` + C4/E4/G4/C4 | 4+ (freq 523, 659, 784, 1046) |
| celebrateCorrect: confetti rain call | `KidsJuice.confettiRain` | 1+ |
| celebrateCorrect: bouncing text | `🎉 YOU GOT IT! 🎉` | 1+ |

### 3. audio.ts — TTS Callbacks

**File:** `src/lib/audio.ts`

| Feature | Grep Pattern | Expected Matches |
|---------|-------------|-----------------|
| onStart callback | `onStart` | 5+ (opts + fallback + utter.onstart + 2 fallback paths) |
| onEnd callback | `onEnd` | 5+ (opts + fallback + utter.onend + onerror + fallback) |
| Fallback timer | `estMs\|text.length \* 65` | 3+ |

### 4. page.tsx — React UI Toggles

**File:** `src/app/page.tsx`

| Feature | Grep Pattern | Expected Matches |
|---------|-------------|-----------------|
| slowMode state | `slowMode` | 4+ (useState + load + toggle + button) |
| extendedTime state | `extendedTime` | 4+ (useState + load + toggle + button) |
| 🐢 Slow button | `🐢 Slow` | 1 |
| ⏱️ Time+ button | `⏱️ Time+` | 1 |
| localStorage load | `localStorage.getItem('ministar-slow-mode')` | 2+ (load + toggle) |
| localStorage load | `localStorage.getItem('ministar-extended-time')` | 2+ (load + toggle) |

---

## Per-Game Feature Inventory

### ALL 32 Games Must Have:

| Feature | Grep Pattern | Expected per game |
|---------|-------------|-------------------|
| speakPromptWithHighlight | `speakPromptWithHighlight` | 1+ calls each |
| makeHoverSpeakable | `makeHoverSpeakable` | 1+ calls each |
| setData('speakText') | `setData('speakText'` | 1+ (where prompt updates) |

### QuizScene.ts — "Living Storybook" AAAA

**Expected line count:** ~730+ lines

| Feature | Grep Pattern | Must Exist |
|---------|-------------|-----------|
| Storybook mascot 🦊 | `_createStoryMascot\|storyMascot` | YES |
| Squishy hover | `_squishyHover` | YES |
| Squishy tap | `_squishyTap` | YES |
| Ripple ring | `_rippleRing` | YES |
| Bouncy background | `_createBouncyBackground\|_bouncyDecos` | YES |
| Mascot happy bounce | `_mascotHappyBounce` | YES |
| Mascot gentle nod | `_mascotGentleNod` | YES |
| Page-turn transition | `x: b.x - 60, angle: -8` | YES |
| Opt out auto-mascot | `_skipAutoMascot = true` | YES |
| Opt out auto-celebrate | `_skipAutoCelebrate = true` | YES |
| Opt out sticker book | `_skipAutoStickerBook = true` | YES |
| Serif font (storybook) | `Georgia` | YES |
| Cream paper bg | `0xfdf6e3` | YES |

### GameshowScene.ts — "Supercharged Spectacle" AAAA

**Expected line count:** ~620+ lines

| Feature | Grep Pattern | Must Exist |
|---------|-------------|-----------|
| Host showman 🎤 | `_createHost\|hostCharacter` | YES |
| Neon borders | `_createNeonBorders\|neonBorders` | YES |
| Arcade buzzer sink | `_arcadeBuzzerSink` | YES |
| Camera zoom (NO pan) | `_cameraZoom\|zoomTo` | YES |
| Camera reset | `_cameraReset` | YES |
| Coin cascade | `_coinCascade` | YES |
| Pie-in-face | `_pieInFace` | YES |
| Host cheer | `_hostCheer` | YES |
| Host dismay | `_hostDismay` | YES |
| Dark navy bg | `0x0a0a1a` | YES |
| Neon cyan border | `0x00ffff` | YES |
| Arial Black font | `Arial Black` | YES |
| NO camera.pan | `cameras.main.pan` | MUST NOT EXIST |

### AirplaneScene.ts — Storm Clouds

| Feature | Grep Pattern | Must Exist |
|---------|-------------|-----------|
| StormCloud interface | `interface StormCloud` | YES |
| stormClouds array | `stormClouds` | YES |
| _spawnStormCloud | `_spawnStormCloud` | YES |
| _handleStormHit | `_handleStormHit` | YES |
| slowedUntil | `slowedUntil` | YES |
| Storm spawn in spawnBannerRow | `Math.random() < 0.12` | YES |
| Storm routing in handleOverlap | `getData('storm')` | YES |
| Speed cap 1.5 | `Math.min(1.5` | YES |
| Speed increment 0.1 | `+ 0.1` | YES |

### SnakingScene.ts — AAAA Letter-Spelling Snake

**Expected line count:** ~450+ lines

| Feature | Grep Pattern | Must Exist |
|---------|-------------|-----------|
| LetterBubble interface | `interface LetterBubble` | YES |
| Letter-by-letter spelling | `lettersCollected` | YES |
| Bubble visuals | `bubble: Phaser.GameObjects.Arc` | YES |
| Magnetic pull | `speedBoost = 1.25` | YES |
| Soft bounce (no game over) | `_softBounce` | YES |
| Expressive eyes | `_updateEyes\|snakeEyes` | YES |
| Hit-stop | `hitStopUntil` | YES |
| Progress slots | `progressSlots` | YES |
| Word complete | `_wordComplete` | YES |
| Respawn letter | `_respawnLetter` | YES |
| Golden pulse | `#fbbf24\|isCorrect` | YES |
| D-pad | `_createDPad` | YES |
| NO finishGame on wall hit | `finishGame(false)` in moveSnake | MUST NOT EXIST |

### EndlessRunnerScene.ts — Pacing

| Feature | Grep Pattern | Must Exist |
|---------|-------------|-----------|
| Start speed 30 | `private speed = 30` | YES |
| Max speed 70 + level*8 | `70 + (this.level - 1) * 8` | YES |
| Growth 0.15 | `0.15` | YES |
| timeMultiplier | `timeMultiplier()` | YES |

### WhackAMoleScene.ts — Pacing

| Feature | Grep Pattern | Must Exist |
|---------|-------------|-----------|
| Spawn 2000 base, floor 1000 | `Math.max(1000, 2000` | YES |
| Stay 3500 base, floor 1800 | `Math.max(1800, 3500` | YES |
| timeMultiplier | `timeMultiplier()` | YES |

### BalloonPopScene.ts — Pacing

| Feature | Grep Pattern | Must Exist |
|---------|-------------|-----------|
| Rise 14000 base, floor 8000 | `Math.max(8000, 14000` | YES |
| timeMultiplier | `timeMultiplier()` | YES |

### RhythmTapScene.ts — Pacing

| Feature | Grep Pattern | Must Exist |
|---------|-------------|-----------|
| Note speed 1.0 + 0.03/idx, cap 1.2 | `1.0 + Math.min(1.2` | YES |
| timeMultiplier | `timeMultiplier()` | YES |

### TowerDefenseScene.ts — Pacing

| Feature | Grep Pattern | Must Exist |
|---------|-------------|-----------|
| Wave speed 0.003 + wave*0.0015 | `0.003 + this.currentWave * 0.0015` | YES |

### MazeChaseScene.ts — Pacing (already well-tuned)

| Feature | Grep Pattern | Must Exist |
|---------|-------------|-----------|
| Player 120px/s | `baseSpeed = this.lod.isMobile ? 100 : 120` | YES |
| Ghost 80px/s | `chaseSpeed = (this.lod.isMobile ? 60 : 80)` | YES |

### maxQuestions — Hyper-Focus Window (FILL 150 seconds)

**GUIDELINE:** All games MUST fill the full 150-second (2.5 minute) hyper-focus window.
150s is both the minimum AND the maximum target. Games should last ~150s, not finish early.
The HUD timer defaults to 150,000ms. maxQuestions caps are calibrated to FILL this window.

| Game | Expected Cap | Est. Time/Q | Total Est. |
|------|-------------|-------------|-----------|
| Airplane | 15 | ~10s | 150s |
| Anagram | 7 | ~20s | 140s |
| BalloonPop | 15 | ~10s | 150s |
| BridgeBuilder | 7 | ~20s | 140s |
| Crossword | 7 | ~20s | 140s |
| EndlessRunner | 15 | ~10s | 150s |
| FarmLife | 15 | ~10s | 150s |
| FlashCards | 15 | ~10s | 150s |
| Gameshow | 8 | ~20s | 160s |
| GroupSort | 10 | ~15s | 150s |
| LabelIt | 10 | ~15s | 150s |
| MatchUp | 10 | ~15s | 150s |
| MazeChase | 10 | ~15s | 150s |
| MemoryMatch | 8 | ~18s | 144s |
| MonsterFighter | MONSTERS.length | structural | — |
| PhysicsPuzzler | 7 | ~20s | 140s |
| Quiz | 8 | ~20s | 160s |
| RescueQuest | min(6, OBSTACLE_TYPES) | structural | — |
| RhythmTap | 15 | ~10s | 150s |
| Snaking | 6 | ~25s/word | 150s |
| SpaceExplorer | 10 | ~15s | 150s |
| SpeakIt | 10 | ~15s | 150s |
| SpinWheel | 8 | ~20s | 160s |
| SpotIt | 15 | ~10s | 150s |
| StarFarm | 10 | ~15s | 150s |
| StoryAdventure | CHAPTERS (structural) | — | — |
| TowerDefense | 7 | ~20s | 140s |
| TrainingAcademy | 10 | ~15s | 150s |
| TreasureHunt | 8 | ~20s | 160s |
| TypeAnswer | 8 | ~20s | 160s |
| WhackAMole | 15 | ~10s | 150s |
| Wordsearch | 6 | ~25s | 150s |

**HUD Timer:** `src/game/Juice.ts` — `initialTimeMs = 150_000` (2.5 minutes).

---

## Common Regression Patterns (WATCH FOR THESE)

### 1. "Session reset" regression
**Symptom:** Features added in earlier turns disappear after a context window reset.
**Cause:** AI doesn't remember prior work, overwrites files with old versions.
**Prevention:** ALWAYS run `scripts/verify-aaaa-features.sh` before deploying. If a feature is missing, re-add it from this document.

### 2. "Game-specific rewrite" regression
**Symptom:** Rewriting Game A causes Game B to lose features.
**Cause:** AI rewrites a shared file (BaseEngine, KidsJuice, audio.ts) with an older version.
**Prevention:** NEVER rewrite shared files when working on a single game. Only edit the specific game's scene file. After editing, run the verification script.

### 3. "Zip rollback" regression
**Symptom:** Deploying a zip for Game A reverts Game B to an old version.
**Cause:** The zip was built from a working copy that didn't have Game B's latest changes.
**Prevention:** ALWAYS run `git status` before zipping to ensure all changes are on disk. Run the verification script AFTER zipping but BEFORE deploying.

### 4. "Partial apply" regression
**Symptom:** Only some of a game's AAAA features survive a rewrite.
**Cause:** AI applies changes incrementally and loses track of which features were added.
**Prevention:** After rewriting a game, check it against the Per-Game Feature Inventory in this document.

---

## Emergency Recovery Procedure

If the verification script fails:

1. **Identify the missing feature** from the script output.
2. **Find the specification** in this document.
3. **Re-add the feature** to the correct file.
4. **Re-run** `scripts/verify-aaaa-features.sh`.
5. **Repeat** until ALL checks pass.
6. **Only then** deploy.

DO NOT deploy with failing checks. A single missing feature can cascade — e.g., if `KidsJuice.celebrateCorrect` is missing, ALL 32 games lose their celebration fanfare.

---

## Binding Rule

**This document is BINDING for all future MiniStar Lab development.** Any deployment that does not pass `scripts/verify-aaaa-features.sh` is INVALID and must be corrected before pushing to GitHub.

The verification script is the source of truth. If the script passes, the deployment is safe. If it fails, fix the failure before deploying.
