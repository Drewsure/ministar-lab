# BUILD REVIEW — 24 Phaser Scenes (Consolidated)

**BUILD:** `6e529f7` on `main` (2026-07-03)
**SCOPE REVIEWED:** All 24 Phaser scenes in `src/game/scenes/`
**REVIEW DATE:** 2026-07-03
**PROTOCOL:** AA Engineering-Level Build Review Protocol

> **CRITICAL NOTE:** Phase 2 (Dynamic Verification) is **UNVERIFIED** for all 24 scenes. These scenes require the full Next.js + Phaser runtime + React GameCanvas wrapper to execute. I cannot run them in headless browser isolation. Static audit (Phase 1) is the basis for these findings.

---

## INHERITED ENGINE AUDIT (affects all 24 scenes)

All 24 scenes extend `BaseEngine` and use `Juice`. Bugs here propagate everywhere.

| System | Traced behavior | Verdict |
|---|---|---|
| **BaseEngine.update loop** | `events.on("update")` calls `hud.tick()`. Bails if `isFinished` (fixed prior session). | **SAFE** |
| **BaseEngine.finishGame()** | Sets `isFinished`, pauses physics, shows overlay. delayedCall callbacks from earlier rounds still fire (no global cancel). | **RISK** — mitigated by per-callback isFinished guards added this session |
| **BaseEngine.recordAnswer()** | Increments score, calls juice (try/catch wrapped), calls `checkLevelUp()`. | **SAFE** |
| **BaseEngine "Play Again"** | `scene.restart()` — Phaser clears events on shutdown. Old delayedCall timers may still fire if not completed. | **RISK** — mitigated by isFinished guards added this session |
| **Juice.hitStop()** | Pauses physics 80ms, resumes via delayedCall. If finishGame pauses during hitStop, resume fires post-game. | **RISK** — visual glitch, not crash |
| **Juice.confettiRain()** | Guarded with `sys.isActive()`. | **SAFE** (fixed prior session) |
| **Juice.zoomPunch()** | Guarded with `sys.isActive()`. | **SAFE** |
| **HUD.tick()** | Updates text, progress bar, mascot. BaseEngine bails if isFinished. | **SAFE** |

---

## INDIVIDUAL SCENE REVIEWS

### 5. MazeChaseScene

**Phase 0:**
- Win: Collect all correct targets → `checkWin()` → `finishGame(true)`
- Fail: Enemy collision → bounce back (no death). Timer 0 → `finishGame(false)`
- Exit: Completion screen → Play Again / New Game

**Phase 1:**
| System | Verdict |
|---|---|
| State machine (play → bounce → collect → win) | **SAFE** — explicit |
| Null refs (target/enemy cast to GameObject) | **SAFE** — fixed this session |
| Race condition (delayedCall advanceRound, targetHits.delete) | **SAFE** — isFinished guards added |
| Memory lifecycle (targetHits Map cleared on restart) | **SAFE** |
| Boundary (0 targets left, max score) | **SAFE** |

**Phase 2:** UNVERIFIED (requires full app)
**Phase 4:** Stability CONDITIONAL PASS | Save FAIL | Input CONDITIONAL PASS | Perf UNVERIFIED | A11y CONDITIONAL PASS | L10n FAIL | Telemetry PASS
**Phase 4B:** All UNVERIFIED except Security (CONDITIONAL PASS)
**Phase 4C:** Visual CONDITIONAL PASS | Hook CONDITIONAL PASS | Pacing PASS (difficulty ramps with level) | Juice PASS (particles, shake, hit-stop) | Retention CONDITIONAL PASS (level system)

**Verdict: CONDITIONALLY READY** — Phase 2 UNVERIFIED blocks certification

---

### 6. QuizScene

**Phase 0:**
- Win: Answer all questions → `checkWin()`
- Fail: Timer 0 → `finishGame(false)`

**Phase 1:**
| System | Verdict |
|---|---|
| State machine | **SAFE** — canInteract guard + isFinished guards added |
| Null refs | **SAFE** |
| Race condition (6 delayedCalls, all guarded) | **SAFE** — fixed this session |
| Memory lifecycle | **SAFE** |
| Boundary (0 questions, max score) | **SAFE** |

**Phase 2:** UNVERIFIED
**Phase 4:** Stability CONDITIONAL PASS | Save FAIL | Input CONDITIONAL PASS | Perf UNVERIFIED | A11y CONDITIONAL PASS | L10n FAIL | Telemetry PASS
**Phase 4B:** All UNVERIFIED
**Phase 4C:** Visual CONDITIONAL PASS | Hook CONDITIONAL PASS | Pacing CONDITIONAL PASS | Juice CONDITIONAL PASS | Retention FAIL

**Verdict: CONDITIONALLY READY**

---

### 7. AirplaneScene

**Phase 0:**
- Win: Catch all correct banners → `checkWin()`
- Fail: Timer 0 → `finishGame(false)`

**Phase 1:**
| System | Verdict |
|---|---|
| State machine | **SAFE** — banner.hit flag + isFinished |
| Null refs (`activePrompt!` ×3) | **SAFE** — fixed this session (null guards added) |
| Race condition (spawn timer, banner fall tween) | **SAFE** |
| Memory lifecycle (banners array filtered on catch) | **SAFE** |
| Boundary (0 banners left, speed overflow) | **SAFE** — speed capped at 2.5x |

**Phase 2:** UNVERIFIED
**Phase 4:** Stability CONDITIONAL PASS | Save FAIL | Input CONDITIONAL PASS | Perf UNVERIFIED | A11y CONDITIONAL PASS | L10n FAIL | Telemetry PASS
**Phase 4B:** All UNVERIFIED
**Phase 4C:** Visual PASS | Hook PASS (cloud parallax, banner unfurl) | Pacing PASS (speed ramps) | Juice PASS (ripple, poof, zoom punch) | Retention CONDITIONAL PASS

**Verdict: CONDITIONALLY READY**

---

### 8. GameshowScene

**Phase 0:**
- Win: Answer all questions → `checkWin()`
- Fail: Timer 0 → `finishGame(false)`

**Phase 1:**
| System | Verdict |
|---|---|
| State machine | **SAFE** — canInteract guard + isFinished |
| Null refs | **SAFE** |
| Race condition (delayedCalls guarded) | **SAFE** — fixed this session |
| Memory lifecycle | **SAFE** |
| Boundary | **SAFE** |

**Phase 2:** UNVERIFIED
**Verdict: CONDITIONALLY READY**

---

### 9. MemoryMatchScene

**Phase 0:**
- Win: Match all pairs → `checkWin()`
- Fail: Timer 0 → `finishGame(false)`

**Phase 1:**
| System | Verdict |
|---|---|
| State machine (flip → check → match/unmatch) | **SAFE** — canInteract + flippedQueue length guard |
| Null refs | **SAFE** |
| Race condition (checkMatch delayedCall guarded) | **SAFE** — fixed this session |
| Memory lifecycle (matched cards destroyed) | **SAFE** |
| Boundary (0 pairs, all matched) | **SAFE** |

**Phase 2:** UNVERIFIED
**Phase 4C:** Visual PASS (3D flip) | Hook PASS | Pacing CONDITIONAL PASS | Juice PASS (glow ring, connecting line) | Retention FAIL

**Verdict: CONDITIONALLY READY**

---

### 10. MatchUpScene

**Phase 0:**
- Win: Match all pairs → `checkWin()`
- Fail: Timer 0 → `finishGame(false)`

**Phase 1:**
| System | Verdict |
|---|---|
| State machine (drag → drop → match/return) | **SAFE** — cardInfo.placed flag |
| Null refs | **SAFE** |
| Race condition | **SAFE** |
| Memory lifecycle | **SAFE** |
| Boundary | **SAFE** |

**Phase 2:** UNVERIFIED
**Verdict: CONDITIONALLY READY**

---

### 11. BalloonPopScene

**Phase 0:**
- Win: Pop all correct balloons → `checkWin()`
- Fail: Timer 0 → `finishGame(false)`

**Phase 1:**
| System | Verdict |
|---|---|
| State machine | **SAFE** — b.hit flag + isFinished |
| Null refs (`activePrompt!` ×2) | **SAFE** — fixed this session |
| Race condition | **SAFE** |
| Memory lifecycle | **SAFE** |
| Boundary | **SAFE** |

**Phase 2:** UNVERIFIED
**Phase 4C:** Visual PASS (glossy 3D balloons) | Hook PASS | Pacing PASS (combo system) | Juice PASS (burst, combo popups) | Retention CONDITIONAL PASS

**Verdict: CONDITIONALLY READY**

---

### 12. WhackAMoleScene

**Phase 0:**
- Win: Bonk all correct moles → `checkWin()`
- Fail: Timer 0 → `finishGame(false)`

**Phase 1:**
| System | Verdict |
|---|---|
| State machine | **SAFE** — mole.active flag + isFinished |
| Null refs (`activePrompt!` ×3) | **SAFE** — fixed this session |
| Race condition (stayTime delayedCall guarded) | **SAFE** — fixed this session |
| Memory lifecycle | **SAFE** |
| Boundary | **SAFE** |

**Phase 2:** UNVERIFIED
**Phase 4C:** Visual PASS | Hook PASS | Pacing PASS (stay time decreases per level) | Juice PASS (squash, combo) | Retention CONDITIONAL PASS

**Verdict: CONDITIONALLY READY**

---

### 13. AnagramScene

**Phase 0:**
- Win: Unscramble all words → `checkWin()`
- Fail: Timer 0 → `finishGame(false)`

**Phase 1:**
| System | Verdict |
|---|---|
| State machine (tap tile → place → check → next/shuffle back) | **SAFE** — canInteract + tile.placed + answer.includes guards |
| Null refs | **SAFE** |
| Race condition (checkAnswer delayedCall, round-advance delayedCall guarded) | **SAFE** — fixed this session |
| Memory lifecycle | **SAFE** |
| Boundary (0 letters, all placed) | **SAFE** |

**Phase 2:** UNVERIFIED
**Phase 4C:** Visual PASS (glossy tiles) | Hook PASS | Pacing CONDITIONAL PASS | Juice PASS (spin, glow, confetti) | Retention FAIL

**Verdict: CONDITIONALLY READY**

---

### 14. WordsearchScene

**Phase 0:**
- Win: Find all words → `checkWin()`
- Fail: Timer 0 → `finishGame(false)`

**Phase 1:**
| System | Verdict |
|---|---|
| State machine (select → check → mark found) | **SAFE** — selecting flag + foundWords Set |
| Null refs | **SAFE** — fixed duplicate `selectionLine` declaration this session |
| Race condition | **SAFE** |
| Memory lifecycle | **SAFE** |
| Boundary (0 words, all found) | **SAFE** |

**Phase 2:** UNVERIFIED
**Verdict: CONDITIONALLY READY**

---

### 15. BridgeBuilderScene

**Phase 0:**
- Win: Complete all words → `checkWin()` (4 calls)
- Fail: Timer 0 → `finishGame(false)`

**Phase 1:**
| System | Verdict |
|---|---|
| State machine | **SAFE** — canInteract guard |
| Null refs | **SAFE** |
| Race condition (delayedCalls guarded) | **SAFE** — fixed this session |
| Memory lifecycle | **SAFE** |
| Boundary | **SAFE** |

**Phase 2:** UNVERIFIED
**Verdict: CONDITIONALLY READY**

---

### 16. CrosswordScene

**Phase 0:**
- Win: Complete grid → `checkWin()` (3 calls)
- Fail: Timer 0 → `finishGame(false)`

**Phase 1:**
| System | Verdict |
|---|---|
| State machine (tap cell → type → check word complete) | **SAFE** — activeEntry null check |
| Null refs | **SAFE** — CellPos.letter fixed this session |
| Race condition | **SAFE** |
| Memory lifecycle | **SAFE** |
| Boundary | **SAFE** |

**Phase 2:** UNVERIFIED
**Verdict: CONDITIONALLY READY**

---

### 17. FlashCardsScene

**Phase 0:**
- Win: Swipe through all cards → `checkWin()`
- Fail: Timer 0 → `finishGame(false)`

**Phase 1:**
| System | Verdict |
|---|---|
| State machine (flip → next/prev → mark known/review) | **SAFE** — isFlipping flag |
| Null refs | **SAFE** |
| Race condition (delayedCall guarded) | **SAFE** — fixed this session |
| Memory lifecycle | **SAFE** |
| Boundary (0 cards, last card) | **SAFE** |

**Phase 2:** UNVERIFIED
**Verdict: CONDITIONALLY READY**

---

### 18. SpinWheelScene

**Phase 0:**
- Win: Answer all prompts → `checkWin()`
- Fail: Timer 0 → `finishGame(false)`

**Phase 1:**
| System | Verdict |
|---|---|
| State machine (spin → land → show options → select → next) | **SAFE** — isSpinning flag + isFinished |
| Null refs (`landedTerm!` ×2) | **SAFE** — fixed this session |
| Race condition (delayedCall guarded) | **SAFE** — fixed this session |
| Memory lifecycle | **SAFE** |
| Boundary | **SAFE** |

**Phase 2:** UNVERIFIED
**Verdict: CONDITIONALLY READY**

---

### 19. GroupSortScene

**Phase 0:**
- Win: Sort all terms → `checkWin()`
- Fail: Timer 0 → `finishGame(false)`

**Phase 1:**
| System | Verdict |
|---|---|
| State machine (drag → drop → correct/wrong) | **SAFE** — sortTerm.placed flag |
| Null refs | **SAFE** — Category type fixed this session |
| Race condition (delayedCalls guarded) | **SAFE** — fixed this session |
| Memory lifecycle | **SAFE** |
| Boundary | **SAFE** |

**Phase 2:** UNVERIFIED
**Verdict: CONDITIONALLY READY**

---

### 20. TypeAnswerScene

**Phase 0:**
- Win: Type all answers → `checkWin()`
- Fail: Timer 0 → `finishGame(false)`

**Phase 1:**
| System | Verdict |
|---|---|
| State machine (type → submit → check → next) | **SAFE** — canSubmit flag |
| Null refs | **SAFE** |
| Race condition (delayedCalls guarded) | **SAFE** — fixed this session |
| Memory lifecycle | **SAFE** |
| Boundary | **SAFE** |

**Phase 2:** UNVERIFIED
**Verdict: CONDITIONALLY READY**

---

### 21. SpotItScene

**Phase 0:**
- Win: Match all rounds → `checkWin()`
- Fail: Timer 0 → `finishGame(false)`

**Phase 1:**
| System | Verdict |
|---|---|
| State machine (tap symbol → match/wrong → next round) | **SAFE** — canInteract + sym.hit flags |
| Null refs | **SAFE** |
| Race condition (delayedCalls guarded) | **SAFE** — fixed this session |
| Memory lifecycle | **SAFE** |
| Boundary | **SAFE** |

**Phase 2:** UNVERIFIED
**Phase 4C:** Visual PASS (Dobble-style cards) | Hook PASS | Pacing PASS (speed bonus) | Juice PASS (glow rings, bursts) | Retention CONDITIONAL PASS

**Verdict: CONDITIONALLY READY**

---

### 22. EndlessRunnerScene

**Phase 0:**
- Win: Answer 15 prompts → `checkWin()`
- Fail: 3 strikes → `finishGame(false)`

**Phase 1:**
| System | Verdict |
|---|---|
| State machine (lane switch → banner scroll → check answer) | **SAFE** — isFinished + currentPrompt null check |
| Null refs (`currentPrompt!` ×2) | **SAFE** — fixed this session |
| Race condition (delayedCall guarded) | **SAFE** — fixed this session |
| Memory lifecycle | **SAFE** |
| Boundary (0 strikes, 15 correct, max speed) | **SAFE** — speed capped at 200 |

**Phase 2:** UNVERIFIED
**Phase 4C:** Visual PASS | Hook PASS | Pacing PASS (speed ramps with distance) | Juice CONDITIONAL PASS | Retention PASS (distance + strikes)

**Verdict: CONDITIONALLY READY**

---

### 23. PhysicsPuzzlerScene

**Phase 0:**
- Win: Hit all correct blocks → `checkWin()`
- Fail: Out of ammo (15) → `finishGame(score >= 50%)`

**Phase 1:**
| System | Verdict |
|---|---|
| State machine (aim → fire → hit/miss → next/continue) | **SAFE** — canFire + isFinished |
| Null refs (`currentPrompt!` ×2) | **SAFE** — fixed this session (promptTerm capture) |
| Race condition | **SAFE** — requestAnimationFrame REMOVED this session, now uses onTick |
| Memory lifecycle (projectiles array cleaned up) | **SAFE** — fixed this session |
| Boundary (0 ammo, 0 blocks, all hit) | **SAFE** |

**Phase 2:** UNVERIFIED
**Phase 4C:** Visual PASS | Hook PASS | Pacing PASS (limited ammo creates tension) | Juice PASS (trails, bursts) | Retention PASS (ammo conservation)

**Verdict: CONDITIONALLY READY** — was CRITICAL before rAF removal

---

### 24. SnakingScene

**Phase 0:**
- Win: Eat all correct words → `checkWin()`
- Fail: Wall/self collision → `finishGame(false)`

**Phase 1:**
| System | Verdict |
|---|---|
| State machine (move → eat → grow/shrink → next/wall) | **SAFE** — isMoving + isFinished |
| Null refs (`currentPrompt!` ×2) | **SAFE** — fixed this session |
| Race condition (delayedCall guarded) | **SAFE** — fixed this session |
| Memory lifecycle (snake segments destroyed on move) | **SAFE** |
| Boundary (0 foods, wall, self) | **SAFE** |

**Phase 2:** UNVERIFIED
**Phase 4C:** Visual CONDITIONAL PASS | Hook PASS | Pacing PASS (speed increases) | Juice CONDITIONAL PASS | Retention PASS (length tracking)

**Verdict: CONDITIONALLY READY**

---

### 25. TrainingAcademyScene

**Phase 0:**
- Win: Complete all commands → `checkWin()`
- Fail: N/A — retry

**Phase 1:**
| System | Verdict |
|---|---|
| State machine (speak command → mascot performs action → next) | **SAFE** — canAnswer + isFinished |
| Null refs | **SAFE** — Command type fixed this session |
| Race condition | **SAFE** |
| Memory lifecycle | **SAFE** |
| Boundary | **SAFE** |

**Phase 2:** UNVERIFIED
**Verdict: CONDITIONALLY READY**

---

### 26. RescueQuestScene

**Phase 0:**
- Win: Clear all obstacles → `completeRescue()` → `finishGame(true)`
- Fail: N/A — retry

**Phase 1:**
| System | Verdict |
|---|---|
| State machine (speak verb → clear obstacle → advance) | **SAFE** — canAnswer + isFinished |
| Null refs | **SAFE** |
| Race condition | **SAFE** |
| Memory lifecycle | **SAFE** |
| Boundary | **SAFE** |

**Phase 2:** UNVERIFIED
**Phase 4C:** Visual PASS (mascot + friend + obstacles) | Hook PASS | Pacing PASS (obstacle sequence) | Juice PASS (confetti on rescue) | Retention PASS (rescue narrative)

**Verdict: CONDITIONALLY READY**

---

### 27. LabelItScene (REWRITTEN this session)

**Phase 0:**
- Win: Answer all rounds correctly → `checkWin()` (was MISSING — Sev-1 — fixed this session)
- Fail: Timer 0 → `finishGame(false)`

**Phase 1:**
| System | Verdict |
|---|---|
| State machine (prompt → tap correct → advance → next round) | **SAFE** — canAnswer + isFinished (rewritten this session) |
| Null refs | **SAFE** |
| Race condition (delayedCalls guarded) | **SAFE** — rewritten this session |
| Memory lifecycle | **SAFE** |
| Boundary | **SAFE** |

**Phase 2:** UNVERIFIED (rewritten — needs runtime verification)
**Verdict: CONDITIONALLY READY** — was CRITICAL (no win condition) before rewrite

---

### 28. SpeakItScene (REWRITTEN this session)

**Phase 0:**
- Win: Answer all rounds correctly → `checkWin()` (was MISSING — Sev-1 — fixed this session)
- Fail: Timer 0 → `finishGame(false)`

**Phase 1:**
| System | Verdict |
|---|---|
| State state (speak word → tap matching → advance → next round) | **SAFE** — canAnswer + isFinished (rewritten this session) |
| Null refs | **SAFE** |
| Race condition (delayedCalls guarded) | **SAFE** — rewritten this session |
| Memory lifecycle | **SAFE** |
| Boundary | **SAFE** |

**Phase 2:** UNVERIFIED (rewritten — needs runtime verification)
**Verdict: CONDITIONALLY READY** — was CRITICAL (no win condition) before rewrite

---

## CONSOLIDATED PHASE 5 — FINAL VERDICT

```
BUILD: 6e529f7 on main (2026-07-03)
SCOPE REVIEWED: 24 Phaser scenes + inherited BaseEngine/Juice

CRITICAL DEFECTS (blocks certification):
  - [ ] NONE REMAINING — LabelIt and SpeakIt win conditions fixed this session
  - [ ] PhysicsPuzzler requestAnimationFrame removed this session

MAJOR DEFECTS (must fix before final):
  - [ ] Phase 2 (Dynamic Verification) UNVERIFIED for all 24 scenes — cannot run without full Next.js app
  - [ ] No save system on any scene (documented as out of scope)
  - [ ] Juice.hitStop() can resume physics after finishGame (visual glitch)
  - [ ] No localization on any scene
  - [ ] No accessibility beyond canvas ARIA label

MINOR DEFECTS (polish backlog):
  - [ ] Flat pacing on Quiz, MemoryMatch, MatchUp, GroupSort, TypeAnswer, Wordsearch, FlashCards, Crossword, BridgeBuilder, Anagram, Gameshow, SpinWheel, TrainingAcademy
  - [ ] No retention hooks on most scenes (score resets on restart)
  - [ ] No pause button on most scenes (only P key on BaseEngine)

FULL SEQUENTIAL PLAYTHROUGH: UNVERIFIED for all 24 scenes
  - Cannot execute without full Next.js + Phaser runtime
  - Static audit (Phase 1) completed clean after this session's fixes
  - User must run full playthrough in live app to verify

CRASH-FREE CONFIRMATION: UNVERIFIED for 24 scenes
  - Root cause of prior user-reported crashes identified and fixed:
    1. Orphaned delayedCall callbacks (isFinished guards added to all 24 scenes)
    2. Non-null assertion on activePrompt/currentPrompt/landedTerm (null guards added to 7 scenes)
    3. PhysicsPuzzler requestAnimationFrame escaping lifecycle (removed, uses onTick)
    4. LabelIt/SpeakIt no win condition (rewritten with checkWin)

PRODUCTION READINESS (Phase 4B):
  Accessibility (WCAG 2.1 AA):     UNVERIFIED (canvas ARIA label added, no screen-reader test)
  Cross-browser (real browsers):   UNVERIFIED (only headless Chromium for prototypes)
  Performance under real load:     UNVERIFIED (not profiled on mid-tier device)
  Security (XSS/CSRF/injection):   CONDITIONAL PASS (no user input rendering, no backend in scenes)
  Production error handling:       FAIL (errors silently swallowed in try/catch)
  Real backend connectivity:       UNVERIFIED (telemetry API exists but not tested with real backend)
  Real (beyond-schema) validation: CONDITIONAL PASS (InputValidator validates shape)
  Multi-tenant / concurrency:      UNVERIFIED (not load-tested)

ENGAGEMENT & POLISH (Phase 4C):
  Visual currency/polish:          CONDITIONAL PASS (varies by scene — MazeChase, Airplane, BalloonPop, SpotIt, RescueQuest are PASS)
  First-90-seconds hook:           CONDITIONAL PASS (most scenes have immediate gameplay)
  Dramatic pacing curve:           CONDITIONAL PASS (MazeChase, Airplane, EndlessRunner, Snaking, PhysicsPuzzler have ramps; others flat)
  Feedback/juice on core actions:  PASS (Juice class provides particles, shake, flash, glow, confetti)
  Retention hooks beyond level 1:  CONDITIONAL PASS (level system on BaseEngine; score resets on restart)

VERDICT: CONDITIONALLY READY — conditions:
  1. Phase 2 (full sequential playthrough) MUST be completed in live app for all 24 scenes
  2. Phase 4B UNVERIFIED items must be resolved before production release
  3. User must verify the prior crash root causes are resolved by playing each scene for 30+ seconds
  4. No scene can be declared READY FOR INSPECTION until Phase 2 is completed clean

  The static audit is clean. All identified Critical and Major defects from the prior review have been fixed:
  - LabelIt/SpeakIt: win conditions added (rewritten)
  - PhysicsPuzzler: requestAnimationFrame removed
  - All 24 scenes: isFinished guards on delayedCalls
  - 7 scenes: null guards replacing non-null assertions
  - 2 TypeScript errors fixed (WordsearchScene, lod.ts)
  - Build passes clean
  - TypeScript passes clean (0 errors)

  BUT: static clean ≠ runtime clean. The user MUST run the full app and play each scene to verify.
```
