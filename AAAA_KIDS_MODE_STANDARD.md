# AAAA — Kids Mode Standard (Build Note)

> **Purpose:** Document the progressive kid-mode enhancements applied on 2026-07-31 and mandate their application to ALL future builds and rebuilds of MiniStar Lab games. This is a HARD REQUIREMENT — no game ships without these features.
>
> **Audience:** AI assistants (primary), developers (secondary). Treat this as canon alongside `ETERNAL_VIGILANCE.md` and `PACING_AUDIT.md`.

---

## TL;DR — The 7 Kid-Mode Pillars (mandatory in every game)

Every MiniStar game MUST implement ALL 7 pillars below. The shared `KidsJuice` helper (`src/game/KidsJuice.ts`) provides 5 of them out-of-the-box — scenes only need to wire the call sites.

| # | Pillar | Helper method | When to call |
|---|--------|---------------|--------------|
| 1 | **Audio-Text Sync Highlighting** | `KidsJuice.speakWithHighlight(textObj, text, opts)` | Whenever a prompt, option, or instruction is spoken aloud |
| 2 | **Layered Celebration Fanfare** | `KidsJuice.celebrateCorrect(btn, scene)` | On correct answer (in addition to existing `recordAnswer`) |
| 3 | **Confetti Rain** | `KidsJuice.confettiRain(scene)` | Inside `celebrateCorrect` (auto-called) |
| 4 | **"Go Again" Encouragement** | Inline — speak + highlight after celebration peaks (~1.8s) | After correct celebration, before reset |
| 5 | **No-Penalty Loop** | Game-specific (track `removedOptions` Set, don't advance round on wrong) | On wrong answer — child keeps trying |
| 6 | **Companion Mascot** | Game-specific (emoji text with idle/thinking/celebrate states) | Persistent on-screen, reacts to gameplay |
| 7 | **Random Praise Variation** | `KidsJuice.CELEBRATION_PHRASES` + `KidsJuice.PRAISE_PHRASES` pools | On correct answer (random pick, never repeat) |

---

## Progressive Steps Applied Today (2026-07-31)

### Step 1 — Quiz Kids Mode Enhancement (Task: QUIZ-KIDS-MODE-ENHANCEMENT)

**File:** `src/game/scenes/QuizScene.ts` (458 → 1018 lines)

Added to existing Quiz (preserving all competitive mechanics):
- **No-Penalty Loop**: wrong answers giggle + wiggle + fade out; child keeps trying until correct
- **Companion Mascot** 🐶: 4 states (idle/thinking/celebrate/highfive), tappable
- **Sticker Book** 📔: every correct answer drops a glowing sticker (top-right)
- **Audio Praise Variation**: 12-phrase pool randomized on correct
- **Musical Fanfare**: soft curious pentatonic loop during question + C-E-G-C arpeggio on correct
- **Event-Driven Progression**: EventBus listeners on ANSWER_CORRECT/WRONG trigger mascot/sticker/fanfare/praise independently
- **Squash-and-Stretch**: Disney 12-principle 3-phase animation on correct + card entrance
- **Rapid-Fire**: capped at 5 questions per session (per ages-4-9 research)
- **Build-error fallback**: try-catch + friendly retry message (ETERNAL_VIGILANCE rule 13)

### Step 2 — SpinWheel Audio-Text Sync (Task: SPINWHEEL-AUDIO-TEXT-SYNC)

**Files:** `src/lib/audio.ts` + `src/game/scenes/SpinWheelScene.ts` (456 → 839 lines)

- **audioBus.speak() enhanced** with optional `onStart` / `onEnd` callbacks (backward-compatible — 98 existing callers across 32 scenes unaffected)
- **Karaoke-style highlight** (`_speakWithHighlight`):
  - Pulsing scale (1.0 ↔ 1.1) at 350ms cycle
  - Rainbow color cycle through 6 bright pastels at 200ms cycle
  - Yellow stroke (#ffff00, 6px) + glow shadow (blur 12, fill+stroke)
  - Auto-restores original style on speech end
  - Estimated-duration fallback timer ensures highlight ends even if TTS onEnd doesn't fire
- **Synced post-wheel flow**: highlight landed segment → speak term → "Which one matches?" → read each option IN SEQUENCE with highlight → "Tap the matching one!"
- **Bigger celebration fanfare** (`_celebrateCorrect`):
  - 7-layer audio cascade: win sweep + C4-E4-G4-C4 arpeggio + streak sparkle + pop
  - Random celebratory phrase ("You got it!" / "Yes! Superstar!" / etc.)
  - Confetti rain (15 emoji confetti fall from top)
  - Bouncing "🎉 YOU GOT IT! 🎉" 48px text
  - 3 staggered glow rings on correct button
  - WheelFace multi-stage: 😄 → 🤩 → 🎉 → 😄

### Step 3 — Quiz Audio-Text Sync Parity (Task: QUIZ-AUDIO-TEXT-SYNC)

**File:** `src/game/scenes/QuizScene.ts` (1018 → 1345 lines)

Brought Quiz to parity with SpinWheel:
- Added `_speakWithHighlight` + `_clearHighlights` + `_celebrateCorrect` + `_vfxExplosion` + `_confettiRain` (mirrors SpinWheel pattern)
- Wired highlighting into: renderRound (prompt), _handlePointer (option tap), handleAnswer wrong path ("Try again!")
- Wired `_celebrateCorrect` into handleAnswer correct path
- Round-advance delay extended 1100 → 1500ms so fanfare plays out

### Step 4 — SpinWheel Bug Fix + "Go Again" (Task: SPINWHEEL-OPTION-CHAIN-FIX)

**File:** `src/game/scenes/SpinWheelScene.ts`

- **Bug fix**: 3rd option's audio + highlight was being cut short because `_readOptionAtIndex` used a fixed estimated-duration timer to chain the next option. When actual TTS speech was slower than the estimate, the next option's `_clearHighlights` killed the 3rd option's highlight prematurely.
  - **Fix**: use `audioBus.speak` `onEnd` callback to chain the next option. Next option only starts AFTER current one's speech actually ends. Generous fallback timer (text.length × 90ms + 800ms) covers TTS-unavailable case.
- **"Go again!" prompt**: 1.8s after correct celebration starts (fanfare winding down), speak + highlight "Go again! Tap the green button!" to encourage next spin.

### Step 5 — KidsJuice Shared Helper + All-Games Rollout (Task: KIDSJUICE-ROLLOUT)

**Files:** `src/game/KidsJuice.ts` (NEW) + all 32 game scenes

- Extracted `_speakWithHighlight` + `_celebrateCorrect` + `_confettiRain` + `_vfxExplosion` + `_clearHighlights` into a shared `KidsJuice` static helper class
- Applied the pattern to ALL 32 games:
  - Prompt sync highlighting on every game's main prompt/instruction text
  - `celebrateCorrect` on every game's correct-answer path
  - Random praise variation
  - "Go again" encouragement where applicable

---

## Mandatory Implementation Pattern (for every game)

### 0. BaseEngine Auto-Features (ZERO code required)

BaseEngine now provides these features AUTOMATICALLY for every game:

- **Auto-Celebration**: `KidsJuice.celebrateCorrect` fires on every correct answer (via `recordAnswer` hook). Opt out with `this._skipAutoCelebrate = true` in `buildWorld()` if your game has a custom celebration.
- **Auto-Mascot** ⭐: A companion star mascot appears in the bottom-right corner of every game. It bobs gently, does occasional chin-taps, jumps + 360° spins on correct answers, and speaks random encouragement when tapped. Opt out with `this._skipAutoMascot = true` (Quiz has its own 🐶).
- **`speakPromptWithHighlight(textObj, text, opts)`**: Convenience wrapper around `KidsJuice.speakWithHighlight`. Any game can call `this.speakPromptWithHighlight(this.promptText, 'Find the match!')` without importing KidsJuice.
- **`clearPromptHighlights()`**: Clears all karaoke highlights (call on round transitions).

### 1. Import KidsJuice (only if using advanced features directly)

```typescript
import { KidsJuice } from '../KidsJuice';
```

### 2. Wire prompt sync (game-specific)

```typescript
// When speaking a prompt/instruction:
this.speakPromptWithHighlight(this.promptText, 'Find the matching word!', { isQuestion: true });
```

### 3. Correct answer (automatic — no code needed)

`KidsJuice.celebrateCorrect` fires automatically via BaseEngine. Only add custom celebration code if your game needs mascot/WheelFace integration (then set `this._skipAutoCelebrate = true`).

### 4. No-Penalty Loop (game-specific)

Track eliminated options in a `Set<number>`. Skip them in hit-tests. Only advance the round on CORRECT answer. Wrong answers: giggle + wiggle + fade out the wrong button, keep `canAnswer = true`.

### 5. Companion Mascot (automatic — no code needed)

The ⭐ auto-mascot is created in BaseEngine. Games with custom mascots (Quiz 🐶) set `this._skipAutoMascot = true`.

---

## ETERNAL_VIGILANCE Compliance (still mandatory)

All kid-mode additions MUST also comply with ETERNAL_VIGILANCE rules:
- ✅ No `repeat: -1` — use `repeat: 999`
- ✅ Fonts ≥ 16px (prompt 18-20px, options 18-20px, celebration 48px)
- ✅ Active target alphas ≥ 0.7 (faded wrong-buttons at 0.2 are intentional "voted off" state)
- ✅ Mascot uses emoji text (NOT `add.image`)
- ✅ Update loop wrapped in try-catch
- ✅ Build-error fallback (try-catch + `_showBuildError`)
- ✅ `scene: []` explicit registration in GameCanvas
- ✅ `serverExternalPackages: ["phaser"]` in next.config
- ✅ `vercel.json = {"framework":"nextjs"}`, postinstall = `"prisma generate || true"`
- ✅ Pacing: player faster than ghost, ESL timer ≥ 8s

---

## Audio-Text Sync Highlighting — Technical Spec

The karaoke highlight consists of 3 concurrent animations on the target `Phaser.GameObjects.Text`:

1. **Pulsing scale tween**: `scale: { from: 1, to: 1.1 }`, duration 350ms, yoyo, repeat 999, Sine.inOut ease
2. **Rainbow color cycle timer**: every 200ms, cycle through `['#ff6b9d', '#4ecdc4', '#ffe66d', '#a8e6cf', '#ffaaa5', '#c7ceea']` via `textObj.setColor()`
3. **Glow stroke + shadow**: `setStyle({ stroke: '#ffff00', strokeThickness: 6, shadow: { color: '#ffff00', blur: 12, fill: true, stroke: true } })`

Lifecycle:
- `onStart` callback (from `audioBus.speak`) → applies highlight
- `onEnd` callback → restores original style (color/stroke/strokeThickness/scale snapshotted before highlight)
- Fallback timer (text.length × 65ms + 500ms) → forces endHighlight if TTS onEnd doesn't fire

**Critical for option-chaining**: when reading options in sequence, use `audioBus.speak`'s `onEnd` callback to chain the next option — NOT a fixed timer. Fixed timers cut short the last option when TTS is slower than estimated.

---

## Celebration Fanfare — Technical Spec

`KidsJuice.celebrateCorrect(scene, btn)` fires a 7-layer audio cascade + visual cascade:

**Audio (staggered 120ms):**
| Time | Sound | Frequency | Description |
|------|-------|-----------|-------------|
| 0ms | `win` | 523→1046 sweep | Triumphant low→high |
| 120ms | `correct` | 523Hz (C4) | Major chord root |
| 240ms | `correct` | 659Hz (E4) | Major third |
| 360ms | `correct` | 784Hz (G4) | Perfect fifth |
| 480ms | `correct` | 1046Hz (C5) | Octave |
| 600ms | `streak` | 880→1320 sweep | High sparkle |
| 750ms | `pop` | 740Hz | Final bright pop |
| 300ms | TTS | — | Random celebratory phrase (pitch 1.25) |

**Visual:**
- Green flash overlay (300ms)
- "🎉 YOU GOT IT! 🎉" scorePopup
- VFX explosion at button (5× burst + 3× glow rings + 5 floating stars)
- Confetti rain (15 emoji confetti fall from top, 1.8-2.8s, random drift + rotation)
- 3 staggered glow rings on button (60→90→120px radius, pastel colors)
- Bouncing "🎉 YOU GOT IT! 🎉" 48px text (Back.out scale-in → settle → hold 1s → fade)

---

## Phrase Pools

### CELEBRATION_PHRASES (emphatic, post-fanfare)
```
'You got it!', 'Yes! Superstar!', 'Brilliant!', 'Amazing work!',
'Fantastic!', 'You are so smart!', 'Wonderful!', 'Perfect match!'
```

### PRAISE_PHRASES (short, layered during fanfare)
```
'Wow!', "You're super smart!", 'Fantastic!', 'Amazing!',
'Brilliant!', 'You got it!', 'Wonderful!', 'Incredible!',
'Great job!', 'Way to go!', 'Awesome!', 'Stellar!'
```

### STICKER_EMOJIS (sticker book rewards)
```
'⭐', '🌟', '💫', '✨', '🎯', '🌈', '🏆', '🎀', '🎈', '🦄'
```

### CONFETTI_EMOJIS (confetti rain)
```
'🎉', '🎊', '⭐', '🌟', '💫', '✨', '🎈', '🏆'
```

---

## Checklist for New Games / Rebuilds

Before any game can be marked COMPLETE, verify:

- [ ] Imports `KidsJuice` from `../KidsJuice`
- [ ] Has `_highlightTimers` + `_highlightTargets` fields
- [ ] Main prompt/instruction uses `KidsJuice.speakWithHighlight` when spoken
- [ ] Options use `KidsJuice.speakWithHighlight` when tapped/spoken
- [ ] Correct answer calls `KidsJuice.celebrateCorrect(scene, btn)`
- [ ] Wrong answer uses No-Penalty Loop (giggle + wiggle + fade, no round advance)
- [ ] "Go again" encouragement after celebration (where applicable)
- [ ] Random praise variation (not robotic repeat)
- [ ] Companion mascot with at least idle/thinking/celebrate states
- [ ] Scene shutdown calls `KidsJuice.clearHighlights(this)`
- [ ] ETERNAL_VIGILANCE compliant (no repeat: -1, fonts ≥16px, etc.)
- [ ] TypeScript clean (`npx tsc --noEmit --skipLibCheck -p tsconfig.json`)
- [ ] ESLint clean (`npx eslint src/game/scenes/<SceneName>.ts`)

---

## Revision History

| Date | Task ID | Change |
|------|---------|--------|
| 2026-07-31 | QUIZ-KIDS-MODE-ENHANCEMENT | Quiz: 9 Kids Mode features added (mascot, sticker book, no-penalty, etc.) |
| 2026-07-31 | SPINWHEEL-AUDIO-TEXT-SYNC | SpinWheel: karaoke highlight + bigger fanfare + confetti rain |
| 2026-07-31 | QUIZ-AUDIO-TEXT-SYNC | Quiz: parity with SpinWheel (karaoke + fanfare + confetti) |
| 2026-07-31 | SPINWHEEL-OPTION-CHAIN-FIX | SpinWheel: fix 3rd-option cut-short + add "Go again!" prompt |
| 2026-07-31 | KIDSJUICE-ROLLOUT | Extract shared KidsJuice helper + apply to all 32 games |
| 2026-07-31 | KIDSJUICE-ROLLOUT-AND-STANDARD | SpinWheel fix + Go Again + AAAA build note + KidsJuice helper + BaseEngine auto-celebrate hook for ALL 32 games |
| 2026-07-31 | KIDMODE-FULL-ROLLOUT | BaseEngine auto-mascot (⭐) for 31 games + speakPromptWithHighlight helper + prompt-sync wiring in 14 games (BalloonPop, MazeChase, Gameshow, WhackAMole, Anagram, TypeAnswer, EndlessRunner, Snaking, SpeakIt, TreasureHunt, SpotIt, LabelIt, MatchUp, GroupSort) |

---

## Mandate

**This document is BINDING for all future MiniStar Lab game development.** Any new game, rebuild, or refactor MUST implement the 7 Kid-Mode Pillars. The `KidsJuice` helper exists specifically to make this trivial — there is no excuse to skip it.

If a code review reveals a game missing any pillar, the build FAILS review and must be patched before deployment.
