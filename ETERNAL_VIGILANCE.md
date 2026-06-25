# ⚠️ ETERNAL VIGILANCE PROMPT — READ BEFORE EVERY DELIVERY ⚠️

## THIS FILE EXISTS BECAUSE THE SAME BUGS KEEP RECURRING

## THE #1 PROBLEM: User's local repo ≠ My sandbox

The user extracts my zip, but their git repo may have OLDER files.
When they run `git add . && git commit`, git says "nothing to commit"
because the extraction didn't overwrite the files properly, OR the
files were already at an older version and git sees no change.

### PREVENTION:
Before creating ANY delivery zip, you MUST:

1. **VERIFY ALL FILES EXIST** in the sandbox:
```bash
ls src/components/ministar/*.tsx | wc -l   # Must be ≥ 13
ls src/game/scenes/*.ts | wc -l             # Must be 24
ls src/lib/*.ts | wc -l                     # Must be ≥ 10
```

2. **VERIFY NO MISSING IMPORTS**:
```bash
# Every import in page.tsx must point to a file that EXISTS
grep "^import.*from '@/components" src/app/page.tsx
# Check each imported file exists:
for f in BrandHeader GameLibrary TeacherDashboard GameCanvas StarGarden OnboardingFlow ParentGate LaunchCard ErrorBoundary AIAuthStudio LiveMultiplayer useBrand; do
  ls src/components/ministar/$f.tsx 2>/dev/null || ls src/components/ministar/$f.ts 2>/dev/null || echo "MISSING: $f"
done
```

3. **VERIFY HTTP 200**:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
# Must return 200. If 500, FIX BEFORE ZIPPING.
```

4. **VERIFY GAME LAUNCHES**:
```bash
# Launch Quiz, check sceneKey = "QuizScene", children > 0, canAnswer = true
```

5. **GAMECANVAS MUST BE SELF-CONTAINED**:
- GameCanvas.tsx must NOT import LoadingScreen or any component that could be missing
- GameCanvas must work with ZERO external component dependencies
- The only imports allowed: Phaser, types, themes, gameModes, audio

6. **ZIP MUST INCLUDE ALL FILES**:
```bash
zip -r download/ministar-src-clean.zip \
  src/ public/ prisma/ scripts/ \
  package.json package-lock.json bun.lock tsconfig.json next.config.ts next-env.d.ts \
  tailwind.config.ts postcss.config.mjs components.json eslint.config.mjs \
  Caddyfile vercel.json .gitignore ETERNAL_VIGILANCE.md \
  -x "node_modules/*" ".*"
```

7. **TELL THE USER TO FORCE OVERWRITE**:
The user must use `Expand-Archive -Force` to overwrite ALL files.
If git says "nothing to commit", the files didn't change → extraction failed.
Tell the user to delete the src/ folder first, then extract:
```powershell
Remove-Item -Recurse -Force C:\Users\User\ministar-lab\src
Expand-Archive -Path "$env:USERPROFILE\Downloads\ministar-src-clean.zip" -DestinationPath C:\Users\User\ministar-lab -Force
```

## THE #2 PROBLEM: Black screens

### Causes:
1. GameCanvas imports a component that doesn't exist → build error → black screen
2. LoadingScreen's onReady callback never fires → stuck at 0% opacity → black screen
3. Scene files missing → Module not found → HTTP 500 → black screen
4. Scene registered as "default" instead of correct key → game.state inaccessible

### Prevention:
- GameCanvas has ZERO external component dependencies (self-contained)
- No LoadingScreen dependency in GameCanvas
- All 24 scene files must exist before zipping
- Scene must be added with explicit key: game.scene.add(sceneKey, SceneClass, false)

## THE #3 PROBLEM: Missing feature components

These files get LOST during zip extraction or session restarts.
If the user reports missing features, check if these exist:

### Components (src/components/ministar/):
- LoadingScreen.tsx
- OnboardingFlow.tsx
- ParentGate.tsx
- LaunchCard.tsx
- StarGarden.tsx
- AIAuthStudio.tsx
- LiveMultiplayer.tsx
- LiveArena.tsx
- ActivityOptions.tsx
- ErrorBoundary.tsx
- PWAInstallPrompt.tsx

### Lib files (src/lib/):
- stardust.ts
- adaptive.ts
- multiplayer/store.ts
- multiplayer/arena.ts

### Game engine files (src/game/):
- WorldEffects.ts
- AAAAnimation.ts

## THE GOLDEN RULE
**A delivery that crashes is worse than no delivery at all.**
Always verify HTTP 200 + game launch BEFORE creating the zip.
If anything fails, FIX IT FIRST. Never ship a broken zip.

## THE NUCLEAR OPTION
If the user keeps getting black screens after extraction, tell them:
```powershell
# Delete everything and start fresh
Remove-Item -Recurse -Force C:\Users\User\ministar-lab\src
Remove-Item -Recurse -Force C:\Users\User\ministar-lab\public
Expand-Archive -Path "$env:USERPROFILE\Downloads\ministar-src-clean.zip" -DestinationPath C:\Users\User\ministar-lab -Force
cd C:\Users\User\ministar-lab
git add .
git commit -m "Force update — all files replaced"
git push
```
This ensures ALL files are replaced, not just "merged".
