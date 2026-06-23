#!/bin/bash
# Test all 12 games on the live Vercel site
# Usage: bash test-all-games.sh

SITE="https://ministar-lab.vercel.app/"
GAMES=(
  "Maze Chase|e16"
  "Quiz|e17"
  "Airplane|e18"
  "Gameshow|e19"
  "Memory Match|e21"
  "Match Up|e22"
  "Balloon Pop|e23"
  "Whack-a-Mole|e24"
  "Anagram|e26"
  "Word Search|e27"
  "Bridge Builder|e28"
  "Crossword|e29"
)

echo "=== MiniStar Live Game Test ==="
echo "Site: $SITE"
echo ""

for entry in "${GAMES[@]}"; do
  IFS='|' read -r name ref <<< "$entry"
  echo "▶ Testing: $name (click @$ref)"
  agent-browser console --clear > /dev/null 2>&1
  agent-browser click @$ref > /dev/null 2>&1
  sleep 4
  
  # Check for Phaser game
  result=$(agent-browser eval "(() => { const g = window.__PHASER_GAME; if (!g) return 'NO_GAME'; const s = g.scene.scenes[0]; if (!s) return 'NO_SCENE'; return 'scene=' + s.constructor.name + ' active=' + s.scene.isActive(); })()" 2>&1 | tail -1)
  
  errors=$(agent-browser errors 2>&1 | grep -c "✗" || echo "0")
  
  echo "  Result: $result"
  echo "  Errors: $errors"
  echo ""
  
  # Exit game
  agent-browser eval "(() => { const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Back to Library') || b.textContent.includes('✕')); if (btn) btn.click(); return 'exited'; })()" > /dev/null 2>&1
  sleep 2
done

echo "=== Test Complete ==="
