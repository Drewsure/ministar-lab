# BUILD REVIEW — Prototype 01: Vocab Tap Match

**BUILD:** `6e529f7` on `main` (2026-07-03)
**SCOPE REVIEWED:** `prototypes/01-vocab-tap-match/` (index.html, game.js, sample-data.js, README.md)
**REVIEW DATE:** 2026-07-03
**PROTOCOL:** AA Engineering-Level Build Review Protocol

---

## PHASE 0 — SCOPE LOCK

### Win/Fail/Exit/Save conditions

| Condition | Definition | Located in code? |
|---|---|---|
| **Win** | All 8 rounds answered (correct or incorrect — round advances regardless) | ✅ `game.js:166` — `if (this.currentRoundIndex >= this.rounds.length)` → `_renderCompletion()` |
| **Fail** | N/A — no fail state. Incorrect answers advance the round anyway | ✅ Confirmed: no fail path |
| **Exit** | Completion screen → "Play Again" button → restarts game | ✅ `game.js:311` — restart button |
| **Save/Checkpoint** | None — in-memory only | ⚠ MISSING — documented as out of scope in `SAVE_SYSTEM_SPEC.md` |

### Systems touching level transitions

| System | Located? | Notes |
|---|---|---|
| Round loader (`_renderRound`) | ✅ `game.js:166` | Builds 8 rounds from shuffled terms |
| Event emitter (`EventLogger`) | ✅ `_shared/prototype-framework.js` | Emits 6 standard events |
| Audio bus (`AudioBus`) | ✅ `_shared/prototype-framework.js` | TTS only — does NOT use `speakWithCues` |
| Mastery tracker | ✅ `_shared/prototype-framework.js` | In-memory, keyed by term ID |
| UI renderer | ✅ `game.js:183` | DOM-based, `innerHTML` rebuild |
| Save system | ❌ MISSING | Documented as out of scope |

### Missing systems flagged
- **No save system** — documented as out of scope per hard constraints. Not a Sev-1 for prototype.
- **No retry on incorrect** — round advances regardless of correctness. This is a design choice, not a missing system, but contradicts Prototypes 02-04 which allow retry.

---

## PHASE 1 — STATIC / PROCEDURAL CODE AUDIT

### State machine

```
start() → _emitGameStarted() → _renderRound()
  ↓
_renderRound() → [round < maxRounds?]
  YES → render prompt + 4 options → wait for tap
  NO  → _renderCompletion() → _emitGameCompleted() → [Play Again?]
    YES → reset state → _renderRound()
    NO  → dead-end (page stays on completion screen)

tap option → _handleAnswer()
  ↓
_emitAnswerSubmitted() → _emitAnswerResult()
  ↓
[correct?]
  YES → mastery.recordCorrect() → _showFeedback(correct=true)
  NO  → mastery.recordIncorrect() (×2: correct term + selected term) → _showFeedback(correct=false)
  ↓
_showFeedback() → setTimeout(1500ms | 2500ms) → currentRoundIndex++ → _renderRound()
```

**Implicit/unhandled transitions flagged:**
- ⚠ The `setTimeout` in `_showFeedback` (line 380) is NOT cancelled if user clicks "Play Again" during the delay. If user restarts during feedback, the old timeout fires and calls `_renderRound()` on the new game state → **double-render risk**.

### Audit list

| System | Traced behavior | Verdict |
|---|---|---|
| **Round advancement** | `currentRoundIndex++` in setTimeout callback. No guard against double-advance if setTimeout fires after restart. | **RISK** |
| **Option button click** | `btn.addEventListener('click', ...)` — buttons disabled after first click via `btn.disabled = true` in `_showFeedback`. | **SAFE** |
| **Mastery recordCorrect** | Called once per correct answer. `recordIncorrect` called twice on incorrect (correct term + selected term). | **SAFE** (by design) |
| **Event emission** | `game_started` once, `round_shown` per round, `answer_submitted` + `answer_result` per answer, `mastery_updated` per mastery change, `game_completed` once. All fire exactly once. | **SAFE** |
| **AudioBus.speak** | Uses `setTimeout(50ms)` before `speechSynthesis.speak()`. Rapid calls can race — utter1's onend nulls `currentUtterance` even after utter2 started. | **RISK** (framework-level) |
| **DOM rebuild** | `this.root.innerHTML = ''` in `_renderRound` — old DOM elements + listeners GC'd by browser. | **SAFE** |
| **setTimeout lifecycle** | `_showFeedback` setTimeout is NOT tracked or cancelled. If game restarts during feedback window, stale timeout fires. | **RISK** |
| **Null refs** | No non-null assertions (`!`). All object access guarded. | **SAFE** |
| **Schema A vs B** | Uses Schema A (`tenant` + `terms[]` + `sentenceStructures[]`). Different from Prototypes 02-04 which use Schema B. | **RISK** (fragmentation) |
| **audioUrl support** | Sample data has `audioUrl: null` fields but game.js never calls `speakWithCues` — always TTS. Dead field. | **RISK** (dead data) |

### Boundary/edge cases

| Case | Behavior | Verdict |
|---|---|---|
| Rapid tap on option | Button disabled after first click → second tap ignored | **SAFE** |
| Rapid tap during feedback (1.5s/2.5s window) | setTimeout not cancelled → if user clicks Play Again, stale timeout fires on new state | **RISK** |
| 0 terms in input | Validator rejects (requires 8-12) → error shown | **SAFE** |
| 13 terms in input | Validator rejects (max 12) → error shown | **SAFE** |
| All 8 rounds incorrect | Game completes with score 0, accuracy 0% | **SAFE** |
| User closes browser mid-game | No save → progress lost | **RISK** (no save) |

---

## PHASE 2 — DYNAMIC / RUNTIME VERIFICATION

### Full playthrough (headless browser)

| Step | Result |
|---|---|
| Load page | ✅ `game_started` emitted, round 1 rendered |
| Round 1: tap correct answer | ✅ `answer_submitted` + `answer_result` (correct) + `mastery_updated` emitted |
| Round 1 → 2 transition | ✅ `round_shown` for round 2 |
| Rounds 2-8 | ✅ All events fire correctly |
| Round 8 → completion | ✅ `game_completed` emitted |
| Completion screen | ✅ Score, accuracy, mastery displayed |
| Play Again | ✅ Game restarts, `game_started` emitted again |

**Full sequential playthrough: COMPLETED CLEAN** (verified in prior session)

### Edge cases tested

| Test | Result |
|---|---|
| Rapid tap (5 clicks in <100ms) on option | ✅ Only 1 `answer_submitted` emitted (button disabled) |
| Rapid tap during feedback window | ❌ NOT TESTED — stale setTimeout risk identified |
| Mid-game browser close | ❌ NOT TESTED — no save system |

---

## PHASE 3 — CRASH FORENSICS

No crashes observed during headless browser testing.

**Known risk (not yet crashed):** setTimeout in `_showFeedback` not cancelled on restart. If user clicks "Play Again" during the 1.5s-2.5s feedback window, the stale timeout fires `_renderRound()` on the new game state. This could cause a double-render or round-skip.

**Reproduction (predicted):**
1. Answer a question → feedback shows
2. Within 1.5s, click "Play Again" (if on completion screen — but completion screen only appears after round 8, so this specific scenario requires reaching round 8 first)
3. Stale setTimeout fires → calls `currentRoundIndex++` and `_renderRound()` on restarted state

**Severity:** LOW — only reachable from completion screen, which requires full game completion first.

---

## PHASE 4 — AA STANDARDS COMPLIANCE CHECK

| Category | Verdict | Notes |
|---|---|---|
| **Stability** | **CONDITIONAL PASS** | No crashes in happy path. Stale setTimeout risk on restart (LOW severity). |
| **Save integrity** | **FAIL** | No save system. Documented as out of scope. |
| **Input robustness** | **CONDITIONAL PASS** | No dead-end screens (Play Again always available). No pause button. No quit-to-menu. |
| **Performance floor** | **PASS** | DOM-based, lightweight. No performance issues observed. |
| **Accessibility/UX baseline** | **CONDITIONAL PASS** | ARIA labels + keyboard nav added (makeSpeakable adds role/tabindex/keydown). No screen reader testing done. |
| **Localization safety** | **FAIL** | All text hardcoded English. No i18n. 30% expansion untested. |
| **Telemetry hooks** | **PASS** | 6 events fire once, fire correctly. Mastery fires once per answer. |

---

## PHASE 4B — PRODUCTION / WEB DEPLOYMENT READINESS

| Item | Verdict | Notes |
|---|---|---|
| **Accessibility (WCAG 2.1 AA)** | **UNVERIFIED** | ARIA labels + keyboard nav added but NOT tested with screen readers. Contrast ratios untested. No captions. |
| **Cross-browser (real browsers)** | **UNVERIFIED** | Only tested in headless Chromium. Not tested on Firefox, Safari, Edge. Web Speech API behavior varies significantly on Safari. |
| **Performance under real load** | **UNVERIFIED** | Not profiled on mid-tier device. No long-session memory test (30+ min). |
| **Security (XSS/CSRF/injection)** | **CONDITIONAL PASS** | Uses `textContent` (not `innerHTML`) for all user-facing text → XSS-safe. No backend calls → CSRF N/A. No user input rendering → injection-safe. |
| **Production error handling** | **FAIL** | No error handling for TTS failures, AudioContext failures, or invalid runtime state. Errors silently swallowed. |
| **Real backend connectivity** | **N/A** | No backend dependency. |
| **Real (beyond-schema) validation** | **CONDITIONAL PASS** | Schema validation present. Out-of-range values (e.g., negative mastery) handled by Math.max/min. |
| **Multi-tenant / concurrency** | **N/A** | No backend, no shared state. |

---

## PHASE 4C — ENGAGEMENT, POLISH & "FEEL" BAR

| Item | Verdict | Reasoning |
|---|---|---|
| **Visual currency/polish** | **CONDITIONAL PASS** | Clean, structural UI. Not dated, but not polished — intentionally per constraint #10. Reads as prototype, not shipping product. |
| **First-90-seconds hook** | **CONDITIONAL PASS** | Immediate gameplay (no tutorial). Tap-to-speak on all text is engaging for ESL learners. But no escalating challenge in first 90s. |
| **Dramatic pacing curve** | **FAIL** | Flat curve. All 8 rounds are identical difficulty. No tension peaks, no relief. Sentence structures alternate deterministically. |
| **Feedback/juice on core actions** | **CONDITIONAL PASS** | Correct answer: green highlight + spoken sentence. Incorrect: red highlight + spoken correction. No particles, no animation, no screen shake. Flat but functional. |
| **Retention hooks beyond level 1** | **FAIL** | No progression, no unlocks, no score chasing (score resets on restart), no social hooks. "Just more of the same" for 8 rounds. |
| **Friction audit** | **CONDITIONAL PASS** | No unskippable content. No forced waits except 1.5-2.5s feedback delay (mild friction). No re-do friction. |

---

## PHASE 5 — FINAL VERDICT

```
BUILD: 6e529f7 on main (2026-07-03)
SCOPE REVIEWED: Prototype 01 — Vocab Tap Match (4 files, 800 lines)

CRITICAL DEFECTS (blocks certification):
  - [ ] None

MAJOR DEFECTS (must fix before final):
  - [ ] setTimeout in _showFeedback not cancelled on restart — stale timeout risk (LOW severity, only reachable from completion screen)
  - [ ] Does not use speakWithCues — ignores audioUrl fields in sample data (dead data)
  - [ ] Uses Schema A while Prototypes 02-04 use Schema B — schema fragmentation
  - [ ] No retry on incorrect — contradicts Prototypes 02-04 retry pattern

MINOR DEFECTS (polish backlog):
  - [ ] Sentence structures alternate deterministically (no randomization)
  - [ ] timePerRoundSec in config is accepted but not implemented
  - [ ] No pause button
  - [ ] No localization framework
  - [ ] Flat dramatic pacing — no difficulty ramp, no tension peaks
  - [ ] No retention hooks (score resets on restart, no unlocks)

FULL SEQUENTIAL PLAYTHROUGH: COMPLETED CLEAN (8 rounds, headless browser)
CRASH-FREE CONFIRMATION: YES, 1 run (happy path). Rapid-input edge case tested (5 clicks → 1 event). Stale setTimeout NOT crash-tested.

PRODUCTION READINESS (Phase 4B):
  Accessibility (WCAG 2.1 AA):     UNVERIFIED (ARIA added but not screen-reader tested)
  Cross-browser (real browsers):   UNVERIFIED (only headless Chromium)
  Performance under real load:     UNVERIFIED (not profiled on mid-tier device)
  Security (XSS/CSRF/injection):   CONDITIONAL PASS (textContent used, no backend)
  Production error handling:       FAIL (errors silently swallowed)
  Real backend connectivity:       N/A (no backend)
  Real (beyond-schema) validation: CONDITIONAL PASS (Math.max/min guards present)
  Multi-tenant / concurrency:      N/A (no backend)

ENGAGEMENT & POLISH (Phase 4C):
  Visual currency/polish:          CONDITIONAL PASS (intentionally minimal per constraint #10)
  First-90-seconds hook:           CONDITIONAL PASS (immediate gameplay, no escalating challenge)
  Dramatic pacing curve:           FAIL (flat — 8 identical-difficulty rounds)
  Feedback/juice on core actions:  CONDITIONAL PASS (functional but flat — no particles/animation)
  Retention hooks beyond level 1:  FAIL (no progression, no unlocks, score resets)

VERDICT: CONDITIONALLY READY — conditions:
  1. Fix stale setTimeout on restart (Major defect)
  2. Add speakWithCues support (Major defect)
  3. Migrate to Schema B for consistency (Major defect)
  4. Phase 4B UNVERIFIED items must be resolved before production release
  5. Dramatic pacing and retention hooks must be addressed before AA certification
```
