#!/bin/bash
# Quick smoke test: launch each game, wait 6s, check if loop is advancing
# Usage: bash scripts/smoke-test-games.sh

GAMES=(
  "maze-chase:🧭 Maze Chase"
  "quiz:❓ Quiz"
  "airplane:✈️ Airplane"
  "gameshow:🎯 Gameshow"
  "memory-match:🃏 Memory Match"
  "match-up:🔗 Match Up"
  "balloon-pop:🎈 Balloon Pop"
  "whack-a-mole:🔨 Whack-a-Mole"
  "anagram:🔤 Anagram"
  "wordsearch:🔍 Word Search"
  "bridge-builder:🚀 Bridge Builder"
  "crossword:🔤 Crossword"
  "flash-cards:📇 Flash Cards"
  "spin-wheel:🎡 Spin Wheel"
  "group-sort:🗃️ Group Sort"
  "type-answer:⌨️ Type Answer"
  "spot-it:👁️ Spot It!"
)

PASS=0
FREEZE=0
FAIL=0

for entry in "${GAMES[@]}"; do
  id="${entry%%:*}"
  label="${entry##*:}"
  
  # Go home
  agent-browser open http://localhost:3000/ > /dev/null 2>&1
  agent-browser wait 2000 > /dev/null 2>&1
  
  # Find the button ref
  ref=$(agent-browser snapshot -i 2>&1 | grep "$label" | head -1 | sed -E 's/.*\[ref=([a-z0-9]+)\].*/\1/')
  if [ -z "$ref" ]; then
    echo "[FAIL]  $id — button not found"
    FAIL=$((FAIL + 1))
    continue
  fi
  
  # Click and wait for load
  agent-browser click "@$ref" > /dev/null 2>&1
  agent-browser wait 3500 > /dev/null 2>&1
  
  # Get initial frame count
  frame1=$(agent-browser eval "
(() => {
  const g = window.__PHASER_GAME;
  return g ? g.loop.frame : -1;
})()
" 2>&1 | tail -1 | tr -d '"')
  
  # Wait 4 seconds
  agent-browser wait 4000 > /dev/null 2>&1
  
  # Get final frame count
  frame2=$(agent-browser eval "
(() => {
  const g = window.__PHASER_GAME;
  return g ? g.loop.frame : -1;
})()
" 2>&1 | tail -1 | tr -d '"')
  
  delta=$((frame2 - frame1))
  if [ "$delta" -gt 60 ]; then
    echo "[PASS]  $id — frames $frame1 → $frame2 (delta $delta)"
    PASS=$((PASS + 1))
  elif [ "$delta" -gt 0 ]; then
    echo "[WARN]  $id — frames $frame1 → $frame2 (delta $delta, slow)"
    PASS=$((PASS + 1))
  else
    echo "[FREEZE] $id — frames $frame1 → $frame2 (delta $delta)"
    FREEZE=$((FREEZE + 1))
  fi
done

echo ""
echo "=== SUMMARY ==="
echo "PASS: $PASS  FREEZE: $FREEZE  FAIL: $FAIL  Total: ${#GAMES[@]}"
