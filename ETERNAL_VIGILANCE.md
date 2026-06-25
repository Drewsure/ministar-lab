# ⚠️ ETERNAL VIGILANCE — STANDARD CHECKS FOR EVERY DELIVERY ⚠️

## BEFORE EVERY DELIVERY — RUN THESE CHECKS:

### 1. accentHex check (CRITICAL — causes black screen freeze)
```bash
grep -rn "accentHex" src/game/Juice.ts
```
If line ~1260 says `this.streakText.setColor(accentHex)` — FIX IT to:
`this.streakText.setColor('#' + this.theme.accent.toString(16).padStart(6, '0'))`
This bug crashes the game loop EVERY FRAME. All games freeze within seconds.

### 2. Level badge overlap check
Level badge (BaseEngine.ts) must be top-LEFT (x=80), NOT center.
Prompt text must be center (x=width/2). They must NOT overlap.
Badge: 120x36, 16px font, "LVL 1"
Prompt: 20px font, centered, with stroke

### 3. Pac-Man ghosts check (MazeChaseScene.ts)
Ghosts must be emoji text (👻👹👺💀), NOT generic particle images.
spawnEnemy() must create `this.add.text(px, py, ghostEmoji, {fontSize:'32px'})`
NOT `this.add.image(px, py, enemyKey)`

### 4. HUD update loop crash prevention (BaseEngine.ts)
The update loop MUST be wrapped in try-catch:
```typescript
this.events.on('update', () => {
  if (this.isFinished) return;
  try { ... } catch (e) { console.error('...', e); }
});
```

### 5. Spot It — exactly ONE match
Card 2 must NOT share terms with Card 1 (except the match term).
Filter out BOTH matchTerm AND all card1 term IDs from pool2.

### 6. Target visibility (all games)
All game objects that the player must see/interact with must have:
- Alpha ≥ 0.7 (not 0.3 or 0.4)
- Font size ≥ 16px (not 12-14px)
- Text with stroke for contrast on dark backgrounds

### 7. Scene registration (GameCanvas.tsx)
Scene must be added with explicit key:
`game.scene.add(sceneKey, SceneClass, false)`
NOT `scene: [SceneClass]` in config (registers as "default")

### 8. SSR safety (next.config.ts)
Must have `serverExternalPackages: ["phaser"]` (Next.js 16 API).
NOT `experimental.serverComponentsExternalPackages` (old API, breaks build).

### 9. vercel.json
Must NOT have BOM. Must NOT reference "bun". Simplest: `{"framework":"nextjs"}`

### 10. Speed ramping
Action games (Maze Chase, Airplane, Balloon Pop, Whack-a-Mole) must start SLOW
at Level 1 and ramp up per level. See GAME_RULES.md for speed tables.

## THE GOLDEN RULE
**A delivery that crashes is worse than no delivery at all.**
Verify HTTP 200 + game launch + no console errors BEFORE zipping.
