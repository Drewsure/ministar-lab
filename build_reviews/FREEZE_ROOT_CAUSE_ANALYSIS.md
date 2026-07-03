# FREEZE ROOT CAUSE ANALYSIS — Final

**Date:** 2026-07-03
**Status:** All identified accumulation sources fixed

---

## The 5 root causes of the systemic freeze

### Cause #1: WebAudio node leak (CRITICAL)
**File:** `src/lib/audio.ts`
**Problem:** Every `audioBus.play()` call created an oscillator + gain node connected to the master gain. After `osc.stop()`, the nodes were NEVER disconnected. They stayed in the WebAudio graph forever. After 50+ correct answers, 100+ dead nodes clogged the audio context → main thread freeze.
**Fix:** Added `osc.onended = () => { osc.disconnect(); gain.disconnect(); }` to disconnect nodes after playback.

### Cause #2: Ghost aura leak (CRITICAL — introduced this session)
**File:** `src/game/scenes/MazeChaseScene.ts`
**Problem:** The ghost aura (`this.add.circle(px, py, ...)`) was created as a SEPARATE game object, not a child of the ghost container. When the ghost was destroyed, the aura survived with its infinite tween running forever. Each round added 1-2 orphaned auras with infinite tweens.
**Fix:** Made aura a child of the ghost container (`ghostContainer.add(aura)`) so it's destroyed when the container is destroyed.

### Cause #3: Particle emitter accumulation (MAJOR)
**File:** `src/game/Juice.ts`
**Problem:** Every `burst()` created a new particle emitter. If the student answered rapidly, multiple emitters existed simultaneously (each with 24 particles). On low-end devices, 5+ concurrent emitters could overwhelm the GPU.
**Fix:** Added `activeEmitters[]` array with `maxConcurrentEmitters = 5` cap. Oldest emitter destroyed before creating new.

### Cause #4: HUD text re-rendered every frame (MAJOR)
**File:** `src/game/Juice.ts`
**Problem:** `hud.tick()` called `setText()` on timer, score, and streak text EVERY FRAME (60x/second). Each `setText()` re-renders the text texture in Phaser. 3 text objects × 60 fps = 180 texture operations/second — wasteful and causes frame drops on mobile.
**Fix:** Only call `setText()` when the string value actually changes (compare `text !== newText` before calling).

### Cause #5: Pupil tracking timer accessing destroyed player (MINOR)
**File:** `src/game/scenes/MazeChaseScene.ts`
**Problem:** The ghost pupil tracking timer fired every 100ms and accessed `this.player.x` without checking if `this.player` exists. During scene shutdown/restart, `this.player` could be undefined → TypeError thrown every 100ms → console spam → performance degradation.
**Fix:** Added `!this.player || !this.player.active` guard to `updateEnemyPupils()`.

---

## Drama additions

### Global urgency vignette (ALL 24 Phaser games)
**File:** `src/game/BaseEngine.ts`
**Change:** When time remaining < 1 minute (20% of 5-minute timer), a red pulsing border activates around the screen edges. This adds visible tension to every game without per-scene code. Includes audio countdown cue.

### Maze Chase — Pac-Man ghosts (already deployed)
- Visible red ghost body with wavy bottom
- White eyes with blue pupils that track player
- Always chase player (faster in line-of-sight)
- Heavy screen shake on collision

### Airplane — storm cloud obstacles (NEW)
**File:** `src/game/scenes/AirplaneScene.ts`
**Change:** ⛈️ storm clouds fall from the top of the screen every 2.5 seconds. If the plane hits one, it's slowed to 30% speed for 1.5 seconds + screen shake + incorrect audio. Creates dodging tension.

---

## Verification

- Build: ✅ PASS
- TypeScript: ✅ 0 errors
- Runtime: UNVERIFIED (requires user to test in live app)

## What to test

1. **Any game** — play for 60+ seconds, get 10+ correct answers. Should NOT freeze.
2. **Maze Chase** — red ghosts should chase you with tracking eyes
3. **Airplane** — ⛈️ storm clouds should fall, slow you on contact
4. **Any game with < 1 minute left** — red pulsing border should appear
