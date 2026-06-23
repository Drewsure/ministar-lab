#!/bin/bash
# Quick audit: launch each game, check for errors, report status
SITE="http://localhost:3000/"
GAMES=(maze-chase quiz airplane gameshow memory-match match-up balloon-pop whack-a-mole anagram wordsearch bridge-builder crossword)

echo "=== MiniStar Game Audit ==="
agent-browser open "$SITE" > /dev/null 2>&1
sleep 4

for mode in "${GAMES[@]}"; do
  # Find the button for this game
  ref=$(agent-browser snapshot -i 2>&1 | grep -iE "$(echo $mode | sed 's/-/ /g')" | head -1 | grep -oE '@e[0-9]+' | head -1)
  if [ -z "$ref" ]; then
    echo "❌ $mode: button not found"
    continue
  fi
  agent-browser console --clear > /dev/null 2>&1
  agent-browser click $ref > /dev/null 2>&1
  sleep 4
  state=$(agent-browser eval "(() => { const g = window.__PHASER_GAME; if (!g) return 'NO_GAME'; const s = g.scene.scenes[0]; if (!s) return 'NO_SCENE'; return 'OK_' + s.constructor.name; })()" 2>&1 | tail -1)
  echo "$(echo $mode | upper): $state"
  # Exit
  agent-browser eval "(() => { const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Back to Library')); if (btn) btn.click(); return 'exit'; })()" > /dev/null 2>&1
  sleep 2
done
