#!/bin/bash
# ============================================================================
# verify-aaaa-features.sh — Pre-Deployment Verification Script
# ============================================================================
# Checks that ALL AAAA features are present on disk before deploying.
# If ANY check fails, the deployment is BLOCKED.
#
# Usage: bash scripts/verify-aaaa-features.sh
# Exit code: 0 = all pass, 1 = at least one failure
# ============================================================================

set -e
cd /home/z/my-project

PASS=0
FAIL=0
FAILURES=""

check() {
  local name="$1"
  local pattern="$2"
  local file="$3"
  local min_count="$4"
  local count

  if [ ! -f "$file" ]; then
    echo "❌ FAIL: $name — file missing: $file"
    FAIL=$((FAIL + 1))
    FAILURES="$FAILURES\n  - $name (file missing: $file)"
    return
  fi

  count=$(grep -cE "$pattern" "$file" 2>/dev/null || true)
  [ -z "$count" ] && count=0

  if [ "$count" -ge "$min_count" ]; then
    echo "✅ PASS: $name ($count matches in $file)"
    PASS=$((PASS + 1))
  else
    echo "❌ FAIL: $name — expected $min_count+, got $count (in $file)"
    FAIL=$((FAIL + 1))
    FAILURES="$FAILURES\n  - $name (expected $min_count+, got $count in $file)"
  fi
}

check_absent() {
  local name="$1"
  local pattern="$2"
  local file="$3"

  if [ ! -f "$file" ]; then
    echo "❌ FAIL: $name — file missing: $file"
    FAIL=$((FAIL + 1))
    FAILURES="$FAILURES\n  - $name (file missing: $file)"
    return
  fi

  local count
  count=$(grep -cE "$pattern" "$file" 2>/dev/null || true)
  [ -z "$count" ] && count=0

  if [ "$count" -eq 0 ]; then
    echo "✅ PASS: $name (absent as expected in $file)"
    PASS=$((PASS + 1))
  else
    echo "❌ FAIL: $name — should NOT exist, found $count matches (in $file)"
    FAIL=$((FAIL + 1))
    FAILURES="$FAILURES\n  - $name (should not exist, found $count in $file)"
  fi
}

echo "=========================================="
echo "AAAA Feature Verification — Pre-Deployment"
echo "=========================================="
echo ""

# ---- BaseEngine.ts ----
echo "--- BaseEngine.ts ---"
check "Auto-celebrate flag" "_skipAutoCelebrate" "src/game/BaseEngine.ts" 2
check "Auto-mascot flag" "_skipAutoMascot" "src/game/BaseEngine.ts" 2
check "Sticker book flag" "_skipAutoStickerBook" "src/game/BaseEngine.ts" 2
check "Auto-mascot creation" "_createAutoMascot" "src/game/BaseEngine.ts" 2
check "Mascot celebrate" "_mascotCelebrate" "src/game/BaseEngine.ts" 2
check "Sticker badge creation" "_createStickerBadge" "src/game/BaseEngine.ts" 2
check "Sticker award" "_awardSticker" "src/game/BaseEngine.ts" 2
check "Slow mode API" "isSlowMode" "src/game/BaseEngine.ts" 2
check "Extended time API" "isExtendedTime" "src/game/BaseEngine.ts" 2
check "timeMultiplier" "timeMultiplier" "src/game/BaseEngine.ts" 1
check "questionMultiplier" "questionMultiplier" "src/game/BaseEngine.ts" 2
check "speakPromptWithHighlight" "speakPromptWithHighlight" "src/game/BaseEngine.ts" 1
check "makeHoverSpeakable" "makeHoverSpeakable" "src/game/BaseEngine.ts" 1
check "_togglePause centralized" "_togglePause" "src/game/BaseEngine.ts" 3
check "timeScale=0 on pause" "timeScale = 0" "src/game/BaseEngine.ts" 1
check "timeScale=1 on resume" "timeScale = 1" "src/game/BaseEngine.ts" 1
check "physics.world.pause" "physics.world.pause" "src/game/BaseEngine.ts" 1
check "physics.world.resume" "physics.world.resume" "src/game/BaseEngine.ts" 1
check "Overlay depth 950" "setDepth\(950\)" "src/game/BaseEngine.ts" 2
check "KidsJuice import" "import { KidsJuice }" "src/game/BaseEngine.ts" 1
check "KidsJuice.celebrateCorrect call" "KidsJuice.celebrateCorrect" "src/game/BaseEngine.ts" 1
check "KidsJuice.clearHighlights on shutdown" "KidsJuice.clearHighlights" "src/game/BaseEngine.ts" 2
check "Mascot emoji map" "_MASCOT_EMOJIS" "src/game/BaseEngine.ts" 1
check "setupGlobalPointer _isPaused guard" "this._isPaused" "src/game/BaseEngine.ts" 3
echo ""

# ---- KidsJuice.ts ----
echo "--- KidsJuice.ts ---"
check "KidsJuice.ts exists" "speakWithHighlight" "src/game/KidsJuice.ts" 1
check "celebrateCorrect" "static celebrateCorrect" "src/game/KidsJuice.ts" 1
check "vfxExplosion" "static vfxExplosion" "src/game/KidsJuice.ts" 1
check "confettiRain" "static confettiRain" "src/game/KidsJuice.ts" 1
check "HIGHLIGHT_COLORS" "export const HIGHLIGHT_COLORS" "src/game/KidsJuice.ts" 1
check "CELEBRATION_PHRASES" "export const CELEBRATION_PHRASES" "src/game/KidsJuice.ts" 1
check "7-layer fanfare (C4 523Hz)" "freq: 523" "src/game/KidsJuice.ts" 1
check "7-layer fanfare (E4 659Hz)" "freq: 659" "src/game/KidsJuice.ts" 1
check "7-layer fanfare (G4 784Hz)" "freq: 784" "src/game/KidsJuice.ts" 1
check "7-layer fanfare (C5 1046Hz)" "freq: 1046" "src/game/KidsJuice.ts" 1
check "YOU GOT IT text" "🎉 YOU GOT IT! 🎉" "src/game/KidsJuice.ts" 2
echo ""

# ---- audio.ts ----
echo "--- audio.ts ---"
check "onStart callback" "onStart" "src/lib/audio.ts" 3
check "onEnd callback" "onEnd" "src/lib/audio.ts" 3
echo ""

# ---- page.tsx ----
echo "--- page.tsx ---"
check "slowMode state" "slowMode" "src/app/page.tsx" 2
check "extendedTime state" "extendedTime" "src/app/page.tsx" 2
check "🐢 Slow button" "🐢 Slow" "src/app/page.tsx" 1
check "⏱️ Time+ button" "⏱️ Time" "src/app/page.tsx" 1
echo ""

# ---- ALL 32 Games: speakPromptWithHighlight + makeHoverSpeakable ----
echo "--- All 32 Games: Highlight + Hover-Speak ---"
TOTAL_GAMES=0
HIGHLIGHT_GAMES=0
HOVER_GAMES=0
for f in src/game/scenes/*.ts; do
  TOTAL_GAMES=$((TOTAL_GAMES + 1))
  name=$(basename "$f" .ts)
  hc=$(grep -c "speakPromptWithHighlight" "$f" 2>/dev/null || echo 0)
  mc=$(grep -c "makeHoverSpeakable" "$f" 2>/dev/null || echo 0)
  if [ "$hc" -ge 1 ]; then HIGHLIGHT_GAMES=$((HIGHLIGHT_GAMES + 1)); fi
  if [ "$mc" -ge 1 ]; then HOVER_GAMES=$((HOVER_GAMES + 1)); fi
done
echo "Games with speakPromptWithHighlight: $HIGHLIGHT_GAMES / $TOTAL_GAMES"
echo "Games with makeHoverSpeakable: $HOVER_GAMES / $TOTAL_GAMES"
if [ "$HIGHLIGHT_GAMES" -lt 32 ]; then
  echo "❌ FAIL: Not all games have speakPromptWithHighlight ($HIGHLIGHT_GAMES/32)"
  FAIL=$((FAIL + 1))
  FAILURES="$FAILURES\n  - speakPromptWithHighlight coverage ($HIGHLIGHT_GAMES/32)"
else
  echo "✅ PASS: All 32 games have speakPromptWithHighlight"
  PASS=$((PASS + 1))
fi
if [ "$HOVER_GAMES" -lt 32 ]; then
  echo "❌ FAIL: Not all games have makeHoverSpeakable ($HOVER_GAMES/32)"
  FAIL=$((FAIL + 1))
  FAILURES="$FAILURES\n  - makeHoverSpeakable coverage ($HOVER_GAMES/32)"
else
  echo "✅ PASS: All 32 games have makeHoverSpeakable"
  PASS=$((PASS + 1))
fi
echo ""

# ---- QuizScene.ts AAAA ----
echo "--- QuizScene.ts (Living Storybook) ---"
check "Storybook mascot" "_createStoryMascot|storyMascot" "src/game/scenes/QuizScene.ts" 2
check "Squishy hover" "_squishyHover" "src/game/scenes/QuizScene.ts" 1
check "Squishy tap" "_squishyTap" "src/game/scenes/QuizScene.ts" 1
check "Ripple ring" "_rippleRing" "src/game/scenes/QuizScene.ts" 1
check "Bouncy background" "_createBouncyBackground|_bouncyDecos" "src/game/scenes/QuizScene.ts" 2
check "Mascot happy bounce" "_mascotHappyBounce" "src/game/scenes/QuizScene.ts" 1
check "Mascot gentle nod" "_mascotGentleNod" "src/game/scenes/QuizScene.ts" 1
check "Serif font (storybook)" "Georgia" "src/game/scenes/QuizScene.ts" 2
check "Opt out auto-mascot" "_skipAutoMascot = true" "src/game/scenes/QuizScene.ts" 1
check "Opt out auto-celebrate" "_skipAutoCelebrate = true" "src/game/scenes/QuizScene.ts" 1
echo ""

# ---- GameshowScene.ts AAAA ----
echo "--- GameshowScene.ts (Supercharged Spectacle) ---"
check "Host showman" "_createHost|hostCharacter" "src/game/scenes/GameshowScene.ts" 2
check "Neon borders" "_createNeonBorders|neonBorders" "src/game/scenes/GameshowScene.ts" 2
check "Arcade buzzer sink" "_arcadeBuzzerSink" "src/game/scenes/GameshowScene.ts" 1
check "Camera zoom" "_cameraZoom|zoomTo" "src/game/scenes/GameshowScene.ts" 2
check "Coin cascade" "_coinCascade" "src/game/scenes/GameshowScene.ts" 1
check "Pie-in-face" "_pieInFace" "src/game/scenes/GameshowScene.ts" 1
check "Host cheer" "_hostCheer" "src/game/scenes/GameshowScene.ts" 1
check "Dark navy bg" "0x0a0a1a" "src/game/scenes/GameshowScene.ts" 1
check "Arial Black font" "Arial Black" "src/game/scenes/GameshowScene.ts" 2
check_absent "NO camera.pan" "cameras.main.pan" "src/game/scenes/GameshowScene.ts"
echo ""

# ---- AirplaneScene.ts Storm Clouds ----
echo "--- AirplaneScene.ts (Storm Clouds) ---"
check "StormCloud interface" "interface StormCloud" "src/game/scenes/AirplaneScene.ts" 1
check "_spawnStormCloud" "_spawnStormCloud" "src/game/scenes/AirplaneScene.ts" 2
check "_handleStormHit" "_handleStormHit" "src/game/scenes/AirplaneScene.ts" 2
check "slowedUntil" "slowedUntil" "src/game/scenes/AirplaneScene.ts" 3
check "Storm spawn rate 12%" "Math.random\(\) < 0.12" "src/game/scenes/AirplaneScene.ts" 1
check "Speed cap 1.5" "Math.min\(1.5" "src/game/scenes/AirplaneScene.ts" 1
echo ""

# ---- SnakingScene.ts AAAA ----
echo "--- SnakingScene.ts (AAAA Letter Snake) ---"
check "LetterBubble interface" "interface LetterBubble" "src/game/scenes/SnakingScene.ts" 1
check "Letter spelling" "lettersCollected" "src/game/scenes/SnakingScene.ts" 3
check "Soft bounce" "_softBounce" "src/game/scenes/SnakingScene.ts" 2
check "Expressive eyes" "_updateEyes|snakeEyes" "src/game/scenes/SnakingScene.ts" 3
check "Hit-stop" "hitStopUntil" "src/game/scenes/SnakingScene.ts" 3
check "Progress slots" "progressSlots" "src/game/scenes/SnakingScene.ts" 3
check "Word complete" "_wordComplete" "src/game/scenes/SnakingScene.ts" 2
check "Magnetic pull" "speedBoost = 1.25|speedBoost.*1.25" "src/game/scenes/SnakingScene.ts" 1
check "D-pad" "_createDPad" "src/game/scenes/SnakingScene.ts" 1
check_absent "NO game over on wall hit" "finishGame\(false\)" "src/game/scenes/SnakingScene.ts"
echo ""

# ---- Pacing Fixes ----
echo "--- Pacing Fixes ---"
check "EndlessRunner start 30" "private speed = 30" "src/game/scenes/EndlessRunnerScene.ts" 1
check "EndlessRunner cap 70" "70 \+ \(this.level - 1\) \* 8" "src/game/scenes/EndlessRunnerScene.ts" 1
check "WhackAMole spawn floor 1000" "Math.max\(1000, 2000" "src/game/scenes/WhackAMoleScene.ts" 1
check "WhackAMole stay floor 1800" "Math.max\(1800, 3500" "src/game/scenes/WhackAMoleScene.ts" 1
check "BalloonPop rise floor 8000" "Math.max\(8000, 14000" "src/game/scenes/BalloonPopScene.ts" 1
check "RhythmTap note speed" "1.0 \+ Math.min\(1.2" "src/game/scenes/RhythmTapScene.ts" 1
check "TowerDefense wave speed" "0.003 \+ this.currentWave \* 0.0015" "src/game/scenes/TowerDefenseScene.ts" 1
echo ""

# ---- SUMMARY ----
echo "=========================================="
echo "SUMMARY"
echo "=========================================="
echo "Passed: $PASS"
echo "Failed: $FAIL"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "❌ DEPLOYMENT BLOCKED — $FAIL feature(s) missing:"
  echo -e "$FAILURES"
  echo ""
  echo "Fix the missing features per PERSISTENCE_GUARD.md before deploying."
  exit 1
else
  echo "✅ ALL CHECKS PASSED — safe to deploy."
  exit 0
fi
