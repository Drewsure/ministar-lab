#!/bin/bash
# verify-aaaa-features.sh — Pre-Deployment Verification
# Exit 0 = safe to deploy, 1 = BLOCKED
set -e
# Auto-detect script directory (works on any machine — Windows Git Bash, Linux, Mac)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

PASS=0; FAIL=0; FAILURES=""

check() {
  local name="$1" pattern="$2" file="$3" min="$4" count
  if [ ! -f "$file" ]; then
    echo "❌ FAIL: $name — file missing: $file"; FAIL=$((FAIL+1)); FAILURES="$FAILURES\n  - $name (file missing)"; return
  fi
  count=$(grep -cE "$pattern" "$file" 2>/dev/null || true)
  [ -z "$count" ] && count=0
  if [ "$count" -ge "$min" ]; then
    echo "✅ PASS: $name ($count in $(basename $file))"; PASS=$((PASS+1))
  else
    echo "❌ FAIL: $name — expected $min+, got $count"; FAIL=$((FAIL+1)); FAILURES="$FAILURES\n  - $name (expected $min+, got $count in $file)"
  fi
}

check_absent() {
  local name="$1" pattern="$2" file="$3" count
  count=$(grep -cE "$pattern" "$file" 2>/dev/null || true)
  [ -z "$count" ] && count=0
  if [ "$count" -eq 0 ]; then
    echo "✅ PASS: $name (absent as expected)"; PASS=$((PASS+1))
  else
    echo "❌ FAIL: $name — should NOT exist, found $count"; FAIL=$((FAIL+1)); FAILURES="$FAILURES\n  - $name (found $count, should be 0)"
  fi
}

echo "=========================================="
echo "AAAA Feature Verification"
echo "=========================================="

echo "--- BaseEngine.ts ---"
check "Auto-celebrate" "_skipAutoCelebrate" "src/game/BaseEngine.ts" 2
check "Auto-mascot" "_skipAutoMascot" "src/game/BaseEngine.ts" 2
check "Sticker book" "_skipAutoStickerBook" "src/game/BaseEngine.ts" 2
check "Mascot creation" "_createAutoMascot" "src/game/BaseEngine.ts" 2
check "Mascot celebrate" "_mascotCelebrate" "src/game/BaseEngine.ts" 2
check "Sticker badge" "_createStickerBadge" "src/game/BaseEngine.ts" 2
check "Sticker award" "_awardSticker" "src/game/BaseEngine.ts" 2
check "Slow mode" "isSlowMode" "src/game/BaseEngine.ts" 2
check "Extended time" "isExtendedTime" "src/game/BaseEngine.ts" 2
check "timeMultiplier" "timeMultiplier" "src/game/BaseEngine.ts" 1
check "questionMultiplier" "questionMultiplier" "src/game/BaseEngine.ts" 2
check "speakPromptWithHighlight" "speakPromptWithHighlight" "src/game/BaseEngine.ts" 1
check "makeHoverSpeakable" "makeHoverSpeakable" "src/game/BaseEngine.ts" 1
check "_togglePause" "_togglePause" "src/game/BaseEngine.ts" 3
check "timeScale=0" "timeScale = 0" "src/game/BaseEngine.ts" 1
check "timeScale=1" "timeScale = 1" "src/game/BaseEngine.ts" 1
check "physics pause" "physics.world.pause" "src/game/BaseEngine.ts" 1
check "physics resume" "physics.world.resume" "src/game/BaseEngine.ts" 1
check "Overlay depth 950" "setDepth.950." "src/game/BaseEngine.ts" 2
check "KidsJuice import" "import { KidsJuice }" "src/game/BaseEngine.ts" 1
check "celebrateCorrect call" "KidsJuice.celebrateCorrect" "src/game/BaseEngine.ts" 1
check "clearHighlights" "KidsJuice.clearHighlights" "src/game/BaseEngine.ts" 2
check "Mascot emoji map" "_MASCOT_EMOJIS" "src/game/BaseEngine.ts" 1
check "_isPaused guards" "this._isPaused" "src/game/BaseEngine.ts" 3

echo "--- KidsJuice.ts ---"
check "exists" "speakWithHighlight" "src/game/KidsJuice.ts" 1
check "celebrateCorrect" "static celebrateCorrect" "src/game/KidsJuice.ts" 1
check "vfxExplosion" "static vfxExplosion" "src/game/KidsJuice.ts" 1
check "confettiRain" "static confettiRain" "src/game/KidsJuice.ts" 1
check "HIGHLIGHT_COLORS" "export const HIGHLIGHT_COLORS" "src/game/KidsJuice.ts" 1
check "CELEBRATION_PHRASES" "export const CELEBRATION_PHRASES" "src/game/KidsJuice.ts" 1
check "C4 523Hz" "freq: 523" "src/game/KidsJuice.ts" 1
check "E4 659Hz" "freq: 659" "src/game/KidsJuice.ts" 1
check "G4 784Hz" "freq: 784" "src/game/KidsJuice.ts" 1
check "C5 1046Hz" "freq: 1046" "src/game/KidsJuice.ts" 1

echo "--- audio.ts ---"
check "onStart" "onStart" "src/lib/audio.ts" 3
check "onEnd" "onEnd" "src/lib/audio.ts" 3

echo "--- page.tsx ---"
check "slowMode" "slowMode" "src/app/page.tsx" 2
check "extendedTime" "extendedTime" "src/app/page.tsx" 2
check "🐢 Slow" "Slow" "src/app/page.tsx" 1
check "⏱️ Time" "Time" "src/app/page.tsx" 1

echo "--- All 32 Games ---"
HG=0; SG=0; TG=0
for f in src/game/scenes/*.ts; do
  TG=$((TG+1))
  grep -q "speakPromptWithHighlight" "$f" 2>/dev/null && SG=$((SG+1))
  grep -q "makeHoverSpeakable" "$f" 2>/dev/null && HG=$((HG+1))
done
echo "speakPromptWithHighlight: $SG/$TG  makeHoverSpeakable: $HG/$TG"
if [ "$SG" -lt 32 ]; then echo "❌ FAIL: speakPromptWithHighlight $SG/32"; FAIL=$((FAIL+1)); else echo "✅ PASS: speakPromptWithHighlight $SG/32"; PASS=$((PASS+1)); fi
if [ "$HG" -lt 32 ]; then echo "❌ FAIL: makeHoverSpeakable $HG/32"; FAIL=$((FAIL+1)); else echo "✅ PASS: makeHoverSpeakable $HG/32"; PASS=$((PASS+1)); fi

echo "--- Quiz AAAA ---"
check "Storybook mascot" "_createStoryMascot|storyMascot" "src/game/scenes/QuizScene.ts" 2
check "Squishy hover" "_squishyHover" "src/game/scenes/QuizScene.ts" 1
check "Squishy tap" "_squishyTap" "src/game/scenes/QuizScene.ts" 1
check "Ripple ring" "_rippleRing" "src/game/scenes/QuizScene.ts" 1
check "Bouncy bg" "_createBouncyBackground|_bouncyDecos" "src/game/scenes/QuizScene.ts" 2
check "Mascot bounce" "_mascotHappyBounce" "src/game/scenes/QuizScene.ts" 1
check "Mascot nod" "_mascotGentleNod" "src/game/scenes/QuizScene.ts" 1
check "Georgia serif" "Georgia" "src/game/scenes/QuizScene.ts" 2
check "Opt out mascot" "_skipAutoMascot = true" "src/game/scenes/QuizScene.ts" 1

echo "--- Gameshow AAAA ---"
check "Host" "_createHost|hostCharacter" "src/game/scenes/GameshowScene.ts" 2
check "Neon borders" "_createNeonBorders|neonBorders" "src/game/scenes/GameshowScene.ts" 2
check "Arcade buzzer" "_arcadeBuzzerSink" "src/game/scenes/GameshowScene.ts" 1
check "Camera zoom" "_cameraZoom|zoomTo" "src/game/scenes/GameshowScene.ts" 2
check "Coin cascade" "_coinCascade" "src/game/scenes/GameshowScene.ts" 1
check "Pie-in-face" "_pieInFace" "src/game/scenes/GameshowScene.ts" 1
check "Dark navy" "0x0a0a1a" "src/game/scenes/GameshowScene.ts" 1
check "Arial Black" "Arial Black" "src/game/scenes/GameshowScene.ts" 2
check_absent "NO camera.pan" "cameras.main.pan" "src/game/scenes/GameshowScene.ts"

echo "--- Airplane Storm ---"
check "StormCloud" "interface StormCloud" "src/game/scenes/AirplaneScene.ts" 1
check "_spawnStormCloud" "_spawnStormCloud" "src/game/scenes/AirplaneScene.ts" 2
check "_handleStormHit" "_handleStormHit" "src/game/scenes/AirplaneScene.ts" 2
check "Rocket 4-dir WASD" "W,A,S,D" "src/game/scenes/AirplaneScene.ts" 1
check "Rocket D-pad up" "upBtn" "src/game/scenes/AirplaneScene.ts" 1
check "Rocket D-pad down" "downBtn" "src/game/scenes/AirplaneScene.ts" 1
check "Rocket vy movement" "setVelocityY" "src/game/scenes/AirplaneScene.ts" 3
check "Rocket _togglePause override" "super._togglePause" "src/game/scenes/AirplaneScene.ts" 1
check_absent "Snaking no dog emoji" "🐶" "src/game/scenes/SnakingScene.ts"
check "slowedUntil" "slowedUntil" "src/game/scenes/AirplaneScene.ts" 3
check "Storm 12%" "Math.random.. < 0.12" "src/game/scenes/AirplaneScene.ts" 1
check "Speed cap 1.5" "Math.min.1.5" "src/game/scenes/AirplaneScene.ts" 1

echo "--- Snaking AAAA ---"
check "LetterBubble" "interface LetterBubble" "src/game/scenes/SnakingScene.ts" 1
check "Letter spelling" "lettersCollected" "src/game/scenes/SnakingScene.ts" 3
check "Soft bounce" "_softBounce" "src/game/scenes/SnakingScene.ts" 2
check "Expressive eyes" "_updateEyes|snakeEyes" "src/game/scenes/SnakingScene.ts" 3
check "Hit-stop" "hitStopUntil" "src/game/scenes/SnakingScene.ts" 3
check "Progress slots" "progressSlots" "src/game/scenes/SnakingScene.ts" 3
check "Word complete" "_wordComplete" "src/game/scenes/SnakingScene.ts" 2
check "Magnetic pull" "1.25" "src/game/scenes/SnakingScene.ts" 1
check "D-pad" "_createDPad" "src/game/scenes/SnakingScene.ts" 1
check_absent "NO finishGame(false)" "finishGame.false." "src/game/scenes/SnakingScene.ts"

echo "--- Pacing ---"
check "ER speed 30" "private speed = 30" "src/game/scenes/EndlessRunnerScene.ts" 1
check "ER cap 70" "70.*this.level.*8" "src/game/scenes/EndlessRunnerScene.ts" 1
check "WM spawn 1000" "Math.max.1000, 2000" "src/game/scenes/WhackAMoleScene.ts" 1
check "WM stay 1800" "Math.max.1800, 3500" "src/game/scenes/WhackAMoleScene.ts" 1
check "BP rise 8000" "Math.max.8000, 14000" "src/game/scenes/BalloonPopScene.ts" 1
check "RT speed" "1.0 . Math.min.1.2" "src/game/scenes/RhythmTapScene.ts" 1
check "TD wave" "0.003 . this.currentWave . 0.0015" "src/game/scenes/TowerDefenseScene.ts" 1

echo "--- Hyper-Focus 150s ---"
check "HUD 150s" "initialTimeMs = 150" "src/game/Juice.ts" 1
for game in Airplane:15 Anagram:7 BalloonPop:15 BridgeBuilder:7 Crossword:7 EndlessRunner:15 FarmLife:15 FlashCards:15 Gameshow:8 GroupSort:10 LabelIt:10 MatchUp:10 MazeChase:10 MemoryMatch:8 PhysicsPuzzler:7 Quiz:8 RhythmTap:15 Snaking:6 SpaceExplorer:10 SpeakIt:10 SpinWheel:8 SpotIt:15 StarFarm:10 TowerDefense:7 TrainingAcademy:10 TreasureHunt:8 TypeAnswer:8 WhackAMole:15 Wordsearch:6; do
  name="${game%%:*}"; cap="${game##*:}"
  if [ "$name" = "EndlessRunner" ] || [ "$name" = "StarFarm" ] || [ "$name" = "TrainingAcademy" ]; then
    check "$name maxQ=$cap" "return $cap" "src/game/scenes/${name}Scene.ts" 1
  else
    check "$name maxQ=$cap" "terms.length, $cap" "src/game/scenes/${name}Scene.ts" 1
  fi
done

echo "=========================================="
echo "SUMMARY: Passed=$PASS Failed=$FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo "❌ DEPLOYMENT BLOCKED — $FAIL feature(s) missing:"
  echo -e "$FAILURES"
  exit 1
else
  echo "✅ ALL CHECKS PASSED — safe to deploy."
  exit 0
fi
