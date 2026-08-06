# ⚠️ ETERNAL VIGILANCE — STANDARD CHECKS FOR EVERY DELIVERY ⚠️

## READ THIS FILE BEFORE EVERY DELIVERY. NO EXCEPTIONS.

This document exists because the same bugs keep recurring across sessions.
Every fix below was paid for in hours of debugging. Do not skip any check.

---

## THE 10 STANDARD CHECKS

### ✅ CHECK 1: accentHex crash (causes game freeze within seconds)

**What happens:** `Juice.ts` line ~1260 references `accentHex` inside `tick()` method, but `accentHex` is a `const` declared inside the constructor. The `tick()` method cannot access it → `ReferenceError: accentHex is not defined` → crashes the game loop EVERY FRAME → all games freeze.

**How to verify:**
```bash
grep -n "accentHex" src/game/Juice.ts
```
Line ~1260 must say:
```typescript
this.streakText.setColor('#' + this.theme.accent.toString(16).padStart(6, '0'));
```
NOT:
```typescript
this.streakText.setColor(accentHex);  // ❌ CRASHES
```

**Why it keeps coming back:** The fix gets overwritten when the user extracts a zip that has the old `Juice.ts`. Always verify this line before zipping.

---

### ✅ CHECK 2: Level badge overlap with prompt text

**What happens:** The "LEVEL 1" badge (BaseEngine.ts) was positioned at center-top (x=width/2, y=45), same position as the game prompt text. They overlap, making both unreadable.

**How to verify:**
```bash
grep -n "levelBg\|levelBadge" src/game/BaseEngine.ts | head -5
```
Level badge must be:
- Position: x=80, y=45 (top-LEFT, not center)
- Size: 120x36
- Font: 16px
- Text: "LVL 1" (not "LEVEL 1")

Prompt text must be centered (x=width/2) at a different Y (75+).

---

### ✅ CHECK 3: Pac-Man ghosts (emoji, not particle images)

**What happens:** MazeChaseScene.ts ghosts were reverted to generic `this.add.image(px, py, enemyKey)` which renders as a tiny colored dot — invisible and boring.

**How to verify:**
```bash
grep -n "spawnEnemy" src/game/scenes/MazeChaseScene.ts
```
Ghosts must use emoji text:
```typescript
const ghostEmojis = ['👻', '👹', '👺', '💀'];
const enemy = this.add.text(px, py, ghostEmoji, { fontSize: '32px' })
```
NOT:
```typescript
const enemy = this.add.image(px, py, enemyKey);  // ❌ Invisible dot
```

Also verify `updateEnemyAI` parameter type is `Phaser.GameObjects.Text`, not `Phaser.GameObjects.Image`.

---

### ✅ CHECK 4: HUD update loop crash prevention (try-catch)

**What happens:** Any uncaught error in the HUD `tick()` method (e.g., accentHex, division by zero, null reference) crashes the game loop permanently. The game freezes.

**How to verify:**
```bash
grep -A 5 "events.on.*update" src/game/BaseEngine.ts
```
Must be wrapped in try-catch:
```typescript
this.events.on('update', () => {
  if (this.isFinished) return;
  try {
    const { remainingMs } = this.hud.tick(this.score, this.streak, this.maxScore);
    this.onTick(remainingMs);
    if (remainingMs <= 0) this.finishGame(false);
  } catch (e) {
    console.error('[MiniStar] Update loop error (suppressed):', e);
  }
});
```

---

### ✅ CHECK 5: Spot It — exactly ONE matching symbol

**What happens:** Card 2's term pool only filtered out the match term, not Card 1's terms. So both cards had the same 7 terms + the match = all 8 symbols identical on both cards. Game was impossible to play (every symbol "matches").

**How to verify:**
```bash
grep -n "pool2" src/game/scenes/SpotItScene.ts
```
Must filter out BOTH matchTerm AND all card1 term IDs:
```typescript
const card1Ids = new Set(card1Terms.map(t => t.id));
const pool2 = pool.filter(t => t.id !== matchTerm.id && !card1Ids.has(t.id));
```
NOT:
```typescript
const pool2 = [...this.terms].filter(t => t.id !== matchTerm.id);  // ❌ All symbols match
```

---

### ✅ CHECK 6: Target visibility (alpha ≥ 0.7, font ≥ 16px)

**What happens:** Game objects (targets, orbs, labels) had alpha 0.2-0.4 on dark backgrounds — nearly invisible. Font sizes were 12-14px — unreadable.

**How to verify:**
```bash
# Check for low alpha on game-critical objects (not decorative shadows/glows)
grep -rn ", 0\.[0-4])" src/game/scenes/*.ts | grep -v "shadow\|glow\|aura\|shine\|floor\|tile\|stroke\|hint\|gradient"
```
Any game-critical object (targets, options, labels, prompts) must have:
- Alpha ≥ 0.7
- Font size ≥ 16px (18px+ preferred)
- Text stroke for contrast on dark backgrounds

---

### ✅ CHECK 7: Scene registration (explicit key, not "default")

**What happens:** When `scene: [SceneClass]` is passed in Phaser config, Phaser registers the scene as "default" (no static key on the class). Then `game.scene.start('QuizScene')` fails silently because no scene named "QuizScene" exists.

**How to verify:**
```bash
grep -n "scene:" src/components/ministar/GameCanvas.tsx
```
Must be:
```typescript
scene: [],  // ❌ NOT scene: [SceneClass]
```
And in the ready handler:
```typescript
if (!game.scene.getScene(sceneKey)) game.scene.add(sceneKey, SceneClass, false);
game.scene.start(sceneKey, { config: resolvedConfig });
```

---

### ✅ CHECK 8: SSR safety (serverExternalPackages, not experimental)

**What happens:** Phaser accesses `window`/`document` on import. During Vercel's SSR (Server-Side Rendering), these don't exist → crash → black screen. The old API `experimental.serverComponentsExternalPackages` was renamed in Next.js 16.

**How to verify:**
```bash
cat next.config.ts
```
Must have:
```typescript
serverExternalPackages: ["phaser"],  // ✅ Next.js 16 API
```
NOT:
```typescript
experimental: {
  serverComponentsExternalPackages: ["phaser"],  // ❌ Old API, breaks Next.js 16
},
```

---

### ✅ CHECK 9: vercel.json (no BOM, no bun, framework specified)

**What happens:**
1. BOM (Byte Order Mark) in vercel.json → Vercel can't parse JSON → "Invalid vercel.json" error
2. `bun` commands in vercel.json → Vercel can't run bun → build fails
3. Missing vercel.json → Vercel doesn't detect Next.js → "No Output Directory named dist" error

**How to verify:**
```bash
# Check vercel.json exists and has no BOM
xxd vercel.json | head -1
# First 3 bytes must NOT be ef bb bf (BOM)
# Must contain: {"framework":"nextjs"}
```

**How to write without BOM in PowerShell:**
```powershell
[System.IO.File]::WriteAllText("vercel.json", "{`n  `"framework`": `"nextjs`"`n}", [System.Text.UTF8Encoding]::new($false))
```
The `$false` parameter = no BOM. Never use `Set-Content` or `Out-File` (they add BOM).

**Also verify package.json build script:**
```bash
grep '"build"' package.json
```
Must be `"build": "next build"` — NOT `"build": "prisma generate && next build"` (prisma fails on Vercel).

And postinstall:
```bash
grep '"postinstall"' package.json
```
Must be `"postinstall": "prisma generate || true"` — the `|| true` prevents failure.

---

### ✅ CHECK 10: Speed ramping (slow start, ramp per level)

**What happens:** Action games started at full speed (280px/s for Maze Chase, 340px/s for Airplane). Level 1 was impossible for beginners.

**How to verify:**
```bash
# Maze Chase
grep "baseSpeed" src/game/scenes/MazeChaseScene.ts
# Must be: baseSpeed = 140 (was 280), ramps +20 per level

# Airplane
grep "speedMultiplier" src/game/scenes/AirplaneScene.ts
# Must start at 0.6 (was 1.0), ramps +0.2 every 4 catches

# Balloon Pop
grep "riseDuration" src/game/scenes/BalloonPopScene.ts
# Must be 12000ms at L1 (was 8000), ramps -2000 per level

# Whack-a-Mole
grep "spawnDelay\|stayTime" src/game/scenes/WhackAMoleScene.ts
# spawnDelay: 1800ms at L1 (was 1000), ramps -300 per level
# stayTime: 3000ms at L1 (was 1800), ramps -400 per level
```

---

## ADDITIONAL LESSONS LEARNED

### BOM (Byte Order Mark) contamination
**Problem:** Windows PowerShell `Set-Content` and `Out-File` add UTF-8 BOM (`EF BB BF`) to files. Vercel's JSON parser rejects BOM → "Invalid vercel.json" error.

**Solution:** Always use `[System.IO.File]::WriteAllText(path, content, [System.Text.UTF8Encoding]::new($false))` in PowerShell. The `$false` = no BOM.

**How to check for BOM:**
```bash
# Check first 3 bytes of any file
od -A x -t x1z filename | head -1
# If starts with "ef bb bf" → has BOM → will break Vercel
```

### Git not seeing file changes
**Problem:** After zip extraction, `git add .` says "nothing to commit" even though files changed. This happens when:
1. File permissions differ (chmod)
2. Line endings differ (LF vs CRLF)
3. The extraction didn't actually overwrite the files

**Solution:** Delete the directory first, then extract:
```powershell
Remove-Item -Recurse -Force C:\Users\User\ministar-lab\src
Expand-Archive -Path zip -DestinationPath C:\Users\User\ministar-lab -Force
```

If git STILL doesn't see changes, use `git rm` then re-add:
```powershell
git rm -r src/
# Re-extract
git add -A
```

### Zip extraction to wrong location
**Problem:** `Expand-Archive` sometimes extracts into a subfolder instead of the target directory.

**Solution:** Extract to a temp folder first, verify, then copy:
```powershell
Expand-Archive -Path zip -DestinationPath C:\Users\User\ministar-temp -Force
dir C:\Users\User\ministar-temp\src\app\page.tsx  # Verify
Copy-Item -Recurse C:\Users\User\ministar-temp\src C:\Users\User\ministar-lab\src
```

### Vercel production branch mismatch
**Problem:** Code was pushed to `aaa-2029-nextjs` branch, but Vercel deploys from `main`. All fixes were invisible.

**Solution:** Always push to `main`:
```powershell
git push origin main
```
Or change Vercel's Production Branch in Settings → Git.

### LoadingScreen infinite loop
**Problem:** LoadingScreen's `useEffect` had `[onReady]` as dependency. `onReady` was an inline function that changed every render → effect restarted infinitely → progress never completed → black screen.

**Solution:** Use `useRef` for the callback + empty `[]` dependency array:
```typescript
const onReadyRef = useRef(onReady);
onReadyRef.current = onReady;
useEffect(() => { ... }, []); // eslint-disable-line
```

### Phaser zoomPunch tween corruption
**Problem:** `cam.zoomTo()` creates an internal tween. Calling it twice in quick succession (streak + level-up) corrupts the camera's tween state → `this.ease is not a function` → game freezes.

**Solution:** Don't use `cam.zoomTo()`. Use a dummy object tween:
```typescript
const dummy = { zoom: 1 };
this.scene.tweens.add({
  targets: dummy,
  zoom: zoomIn,
  onUpdate: () => { cam.setZoom(dummy.zoom); },
});
```

### glowRing recursive delayedCall overload
**Problem:** `glowRing` used `this.scene.time.delayedCall(16, update)` recursively (37 timers per glow ring). When multiple glow rings fired simultaneously (streak + level-up), the timer queue overloaded → scene time froze → game stuck.

**Solution:** Use a single tween with `onUpdate` instead of recursive `delayedCall`.

### Scene time frozen (frame stuck at 0)
**Problem:** After a crash in the update loop, `scene.time.now` stops advancing even though `game.loop.time` continues. All `delayedCall` callbacks never fire.

**Solution:** Wrap the update loop in try-catch (CHECK 4). Also use `setTimeout` instead of `this.time.delayedCall` for critical transitions (round advancement).

---

## THE GOLDEN RULE

**A delivery that crashes is worse than no delivery at all.**

Before creating ANY zip:
1. Run all 10 checks above
2. Run `bash scripts/verify-aaaa-features.sh` — ALL 113 checks MUST pass
3. Verify `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` returns 200
4. Verify a game launches (QuizScene, 27+ children, canAnswer=true, zero console errors)
5. Verify NO BOM in vercel.json or package.json
6. Verify `src/app/page.tsx` exists in the zip
7. Verify `PERSISTENCE_GUARD.md` is included in the zip
8. Verify `useEffect` in page.tsx has `[]` dependency array (no infinite loop)

**If any check fails, FIX IT BEFORE ZIPPING.**

---

## ✅ CHECK 11: Hover-to-Speak Karaoke Highlight (ALL 32 games)

**What happens:** Text objects use raw `audioBus.speak()` on `pointerdown` without karaoke highlight or hover support. Child taps text → hears plain speech with no visual feedback. Hovering over text does nothing.

**How to verify:**
```bash
# All 32 games must have makeHoverSpeakable
for f in src/game/scenes/*.ts; do
  grep -q "makeHoverSpeakable" "$f" && echo "✅ $(basename $f)" || echo "❌ $(basename $f)"
done

# No raw audioBus.speak on text pointerdown (game-action buttons OK)
grep -rn "pointerdown.*audioBus.speak" src/game/scenes/
# Should return NOTHING (or only game-action buttons, not text-to-speak)
```

**Fix:** Replace `audioBus.speak()` on text with `this.speakPromptWithHighlight(textObj, speechText)` on BOTH `pointerover` AND `pointerdown`. Or use `this.makeHoverSpeakable(textObj, speechText)` which does both automatically.

**Special cases:**
- Snaking letters: Custom handlers (no stopPropagation) calling `speakPromptWithHighlight`
- SpeakIt replay: Custom handlers calling `speakPromptWithHighlight`
- Game-action buttons (whack, mic, submit): No change needed — these play sounds, not speech

---

## ✅ CHECK 12: finishGame Overlay Not Hanging

**What happens:** `finishGame()` calls `tweens.killAll()` at the start, which kills the overlay fade-in tween. Buttons stay at alpha 0 (invisible) → game appears to "hang" with no clickable buttons.

**How to verify:**
```bash
grep "tweens.killAll" src/game/BaseEngine.ts
# Should NOT appear in finishGame() — only in shutdown/destroy handlers
```

**Fix:** Do NOT call `tweens.killAll()` in `finishGame()`. The overlay fade-in tween must be allowed to run. Add a safety `delayedCall(500ms)` that forces all overlay elements to alpha 1 as a fallback.

---

## ✅ CHECK 13: Pause Total Freeze

**What happens:** Pause only pauses physics but NOT tweens/timers → banners keep falling, moles keep popping, clouds keep spawning during pause.

**How to verify:**
```bash
grep "timeScale = 0" src/game/BaseEngine.ts  # Must exist in _togglePause
grep "timeScale = 1" src/game/BaseEngine.ts  # Must exist in _togglePause resume
grep "setInteractive" src/game/BaseEngine.ts | grep "950"  # Overlay must block input
```

**Fix:** `_togglePause()` must set `this.time.timeScale = 0` on pause (freezes ALL tweens + timers) and `this.time.timeScale = 1` on resume. Overlay rectangle must have `setInteractive()` at depth 950 to block all pointer events.

---

## ✅ CHECK 14: useEffect Dependency Array (React infinite loop)

**What happens:** `useEffect` in `page.tsx` missing `[]` dependency array → runs on every render → `setState` → re-render → `useEffect` → `setState` → infinite loop → "Maximum update depth exceeded" crash.

**How to verify:**
```bash
grep -A5 "useEffect" src/app/page.tsx | grep "\[\]"
# Must find [] at the end of useEffect
```

**Fix:** Add `}, []);` at the end of the `useEffect` that loads stats/toggles.
