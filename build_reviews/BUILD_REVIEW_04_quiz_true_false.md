# BUILD REVIEW — Prototype 04: Quiz / True-False

**BUILD:** `6e529f7` on `main` (2026-07-03)
**SCOPE REVIEWED:** `prototypes/04-quiz-true-false/` (index.html, game.js, questions.js, sample-data.js, README.md)
**REVIEW DATE:** 2026-07-03
**PROTOCOL:** AA Engineering-Level Build Review Protocol

---

## PHASE 0 — SCOPE LOCK

| Condition | Definition | Located? |
|---|---|---|
| **Win** | All questions answered correctly (retry until correct) | ✅ `game.js:264` — `currentQuestionIndex >= questions.length` → `_renderCompletion()` |
| **Fail** | N/A — retry until correct | ✅ |
| **Exit** | Start screen → mode select; Completion → Play Again / Change Mode | ✅ |
| **Save** | None — in-memory only | ⚠ Out of scope |

---

## PHASE 1 — STATIC / PROCEDURAL CODE AUDIT

### State machine

```
start() → _renderStartScreen()
  ↓
tap MC mode → _startGame("multiple-choice") → _emitGameStarted() → _renderQuestion()
tap TF mode → _startGame("true-false") → _emitGameStarted() → _renderQuestion()
  ↓
_renderQuestion() → [question < questions.length?]
  YES → render question + choices (MC: 4 buttons, TF: 2 buttons)
  NO  → _renderCompletion() → _emitGameCompleted()
  ↓
tap answer → _handleAnswer()
  ↓
_emitAnswerSubmitted() → _emitAnswerResult()
  ↓
[correct?]
  YES → mastery.recordCorrect() → _showFeedback(correct=true) → setTimeout(1800ms) → next question
  NO  → mastery.recordIncorrect() → _showFeedback(correct=false) → setTimeout(1500ms) → re-enable
  ↓
Completion → [Play Again (same mode)] or [Choose Different Mode → _renderStartScreen()]
```

### Audit list

| System | Traced behavior | Verdict |
|---|---|---|
| **Question generation** | `questions.js` generates MC (1 per sentence) + TF (2 per sentence: true + false). MC: extracts subject from sentence, builds "Which word goes with: [predicate]?". TF: swaps subject with first different vocab word. | **RISK** — naive |
| **MC answer derivation** | Finds first vocab word in sentence → subject. Extracts predicate. | **RISK** — fails on complex sentences |
| **TF false-statement** | Swaps subject with first different vocab word. Can produce nonsensical statements. | **RISK** |
| **Question override** | README claims host app can provide explicit `questions` array, but code doesn't check for it. | **CRITICAL** (documentation bug) |
| **Round advancement** | `currentQuestionIndex++` in setTimeout(1800ms). No isFinished guard. | **RISK** |
| **Choice double-fire** | Buttons disabled after click. | **SAFE** |
| **setTimeout lifecycle** | Two setTimeouts (1800ms, 1500ms). NOT cancelled on restart/mode-switch. | **RISK** |
| **DOM rebuild** | `innerHTML = ''` — GC'd. | **SAFE** |
| **Null refs** | No non-null assertions. | **SAFE** |
| **Mastery keying** | Keyed by generated question ID (`mc-0`, `tf-true-0`). Not stable across regenerations. | **RISK** |
| **Duplicated shuffle** | `questions.js` has its own `shuffle()` instead of using `LTB.UI.shuffle()`. | **RISK** (code duplication) |
| **Start screen back button** | No back button on start screen — but start screen IS the top-level, so no dead-end. | **SAFE** |
| **Mode switch during game** | Can't switch mode mid-game — must finish or reach completion screen. | **SAFE** (by design) |

### Boundary cases

| Case | Behavior | Verdict |
|---|---|---|
| Rapid answer tap | Button disabled → 1 event | **SAFE** |
| Restart during feedback | Stale setTimeout fires | **RISK** |
| TF false-statement nonsensical | "A dog says meow." → grammatically fine but semantically odd. Pedagogically acceptable. | **SAFE** |
| MC with no vocab word in sentence | Falls back to "Which word is in this sentence: [sentence]?" | **SAFE** (graceful) |
| Mode switch from completion | "Choose Different Mode" → `_renderStartScreen()` — clean transition | **SAFE** |
| TF question with only 1 vocab word | `makeFalseStatement` returns null → TF false question not generated → fewer questions | **SAFE** (graceful) |

---

## PHASE 2 — DYNAMIC / RUNTIME VERIFICATION

### Full playthrough (headless browser — both modes verified)

**Multiple Choice mode:**

| Step | Result |
|---|---|
| Load page → start screen | ✅ Two mode buttons rendered with 🔊 listen buttons |
| Tap MC mode | ✅ `game_started` with `mode: "multiple-choice"` |
| Q1: "Which word goes with: 'says meow'?" | ✅ 4 choices (bird, cat, dog, fish) |
| Tap "cat" (correct) | ✅ All events fire, advances to Q2 |
| Q2: "Which word goes with: 'says woof'?" | ✅ Correct events fire |
| Completion | ✅ `game_completed` with mode + mastery |

**True/False mode:**

| Step | Result |
|---|---|
| Tap TF mode | ✅ `game_started` with `mode: "true-false"` |
| Q1: "True or False: A cat says meow." | ✅ True/False buttons rendered |
| Tap True (correct) | ✅ Events fire |
| Subsequent TF questions | ✅ Alternate true/false versions |

**Full sequential playthrough: COMPLETED CLEAN (both modes)**

---

## PHASE 3 — CRASH FORENSICS

No crashes observed. **Documentation bug:** README claims explicit `questions` array override exists but code doesn't check for it. This is not a crash but is a trust-breaking defect — the README lies about a feature.

---

## PHASE 4 — AA STANDARDS COMPLIANCE

| Category | Verdict | Notes |
|---|---|---|
| **Stability** | **CONDITIONAL PASS** | No crashes. Stale setTimeout risk. |
| **Save integrity** | **FAIL** | No save system. |
| **Input robustness** | **PASS** | Start screen, mode selection, Play Again, Change Mode — no dead-ends. |
| **Performance** | **PASS** | Lightweight DOM. |
| **Accessibility** | **CONDITIONAL PASS** | ARIA + keyboard nav on all buttons. Not screen-reader tested. |
| **Localization** | **FAIL** | Hardcoded English. |
| **Telemetry** | **PASS** | All 6 events fire once. Mode included in events. |

---

## PHASE 4B — PRODUCTION READINESS

| Item | Verdict |
|---|---|
| Accessibility | **UNVERIFIED** |
| Cross-browser | **UNVERIFIED** |
| Performance | **UNVERIFIED** |
| Security | **CONDITIONAL PASS** (textContent, no backend) |
| Error handling | **FAIL** (documentation bug: claims feature that doesn't exist) |
| Backend | **N/A** |
| Validation | **CONDITIONAL PASS** |
| Multi-tenant | **N/A** |

---

## PHASE 4C — ENGAGEMENT & POLISH

| Item | Verdict | Reasoning |
|---|---|---|
| **Visual currency** | **CONDITIONAL PASS** | Start screen with mode selection is a step up from 01-03. Still intentionally minimal. |
| **First-90s hook** | **PASS** | Mode selection gives agency. Immediate gameplay. Child-safe feedback. |
| **Dramatic pacing** | **CONDITIONAL PASS** | MC has 2 questions (flat). TF has 4 questions (slightly more variety). Still no difficulty ramp. |
| **Feedback/juice** | **CONDITIONAL PASS** | Child-safe: "That is right!" / "Not quite. Try again." No particles. |
| **Retention hooks** | **CONDITIONAL PASS** | Mode selection adds replayability. "Change Mode" on completion. But no progression, no unlocks. |
| **Friction** | **PASS** | No unskippable content. Retry is immediate. Mode switch from completion is frictionless. |

---

## PHASE 5 — FINAL VERDICT

```
BUILD: 6e529f7
SCOPE: Prototype 04 — Quiz / True-False (5 files, 1226 lines)

CRITICAL DEFECTS:
  - [ ] README claims explicit questions override exists but code doesn't check for it (documentation bug — trust-breaking)
MAJOR DEFECTS:
  - [ ] Question generation is naive (MC subject extraction + TF false-statement swap)
  - [ ] setTimeout not cancelled on restart/mode-switch
  - [ ] Mastery keyed by generated question ID (not stable)
  - [ ] Duplicated shuffle() in questions.js (should use LTB.UI.shuffle)
MINOR DEFECTS:
  - [ ] No localization
  - [ ] No mixed mode exposed in UI (generator supports it)
  - [ ] TF false-statement can be nonsensical on complex sentences
  - [ ] No retention hooks beyond mode selection

FULL SEQUENTIAL PLAYTHROUGH: COMPLETED CLEAN (both MC and TF modes)
CRASH-FREE CONFIRMATION: YES, 2 runs (1 MC + 1 TF)

PRODUCTION READINESS (4B):
  Accessibility:     UNVERIFIED
  Cross-browser:     UNVERIFIED
  Performance:       UNVERIFIED
  Security:          CONDITIONAL PASS
  Error handling:    FAIL (documentation bug)
  Backend:           N/A
  Validation:        CONDITIONAL PASS
  Multi-tenant:      N/A

ENGAGEMENT (4C):
  Visual:            CONDITIONAL PASS
  First-90s hook:    PASS
  Pacing:            CONDITIONAL PASS
  Juice:             CONDITIONAL PASS
  Retention:         CONDITIONAL PASS

VERDICT: NOT READY — Critical defect (documentation bug: README claims feature that doesn't exist). Fix the documentation or implement the feature. Then CONDITIONALLY READY pending Phase 4B verification.
```
