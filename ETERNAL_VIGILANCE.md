# ⚠️ ETERNAL VIGILANCE PROMPT — READ BEFORE EVERY DELIVERY ⚠️

## THIS FILE EXISTS BECAUSE THE SAME BUGS KEEP RECURRING

Before creating ANY delivery zip, you MUST verify:

### 1. ALL FILES EXIST
Run this check:
```bash
ls src/components/ministar/*.tsx | wc -l  # Must be ≥ 4 (minimum: BrandHeader, GameCanvas, GameLibrary, TeacherDashboard)
ls src/game/scenes/*.ts | wc -l          # Must be 24
ls src/lib/*.ts | wc -l                   # Must be ≥ 8
```

### 2. NO MISSING IMPORTS
Run this check:
```bash
# Check page.tsx imports — every import must resolve
grep "^import" src/app/page.tsx | grep -v "from 'react'" | grep -v "from 'next/"
# Each imported file MUST exist on disk
```

### 3. LOADING SCREEN
GameCanvas.tsx MUST NOT import LoadingScreen unless the file exists.
If LoadingScreen.tsx is missing, GameCanvas must work WITHOUT it (no loading overlay).
The current GameCanvas has NO LoadingScreen dependency — KEEP IT THAT WAY.

### 4. BLACK SCREEN PREVENTION
The #1 cause of black screens is:
- GameCanvas imports a component that doesn't exist → build error → black screen
- LoadingScreen's onReady callback never fires → stuck at 0% opacity → black screen
- Scene files missing → Module not found → HTTP 500 → black screen

PREVENT by:
- GameCanvas has ZERO external component dependencies (self-contained)
- No LoadingScreen — the game just boots directly
- All 24 scene files must exist before zipping

### 5. ZIP CONTENTS
The zip MUST include:
- src/ (ALL files, not just some)
- public/
- prisma/
- scripts/
- package.json + package-lock.json
- All config files

### 6. ETERNAL REMINDER
Every time you create a zip, VERIFY the files exist in the sandbox FIRST.
Files get lost due to context limits, session restarts, and git issues.
NEVER assume a file exists — ALWAYS check with `ls` before zipping.

### 7. FEATURES THAT MAY BE MISSING (recreate if needed)
If the user reports missing features, these files may need recreation:
- LoadingScreen.tsx — cinematic loading animation
- OnboardingFlow.tsx — kindergarten onboarding (Cloud Dog companion)
- ParentGate.tsx — math problem gate for teacher access
- LaunchCard.tsx — QR code classroom launch
- StarGarden.tsx — Star Dust + plant growing dashboard
- AIAuthStudio.tsx — AI lesson generation
- ActivityOptions.tsx — Wordwall-style options panel
- LiveMultiplayer.tsx — classroom multiplayer mode
- LiveArena.tsx — 1v1 duel mode
- ErrorBoundary.tsx — crash protection
- PWAInstallPrompt.tsx — PWA install banner
- src/lib/stardust.ts — Star Dust currency system
- src/lib/adaptive.ts — adaptive difficulty + boss battles
- src/lib/multiplayer/store.ts — classroom room store
- src/lib/multiplayer/arena.ts — duel room store
- src/game/WorldEffects.ts — world-specific gameplay effects
- src/game/AAAAnimation.ts — AAA animation system

### 8. THE GOLDEN RULE
**A delivery that crashes is worse than no delivery at all.**
Always test `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` returns 200
BEFORE creating the zip. If it returns 500, FIX IT FIRST.
