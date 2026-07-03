# BUILD REVIEW — Prototype 02: Sentence Builder

**BUILD:** `6e529f7` on `main` (2026-07-03)
**SCOPE REVIEWED:** `prototypes/02-sentence-builder/` (index.html, game.js, sample-data.js, README.md)
**REVIEW DATE:** 2026-07-03
**PROTOCOL:** AA Engineering-Level Build Review Protocol

---

## PHASE 0 — SCOPE LOCK

| Condition | Definition | Located? |
|---|---|---|
| **Win** | Both target sentences built correctly (retry until correct) | ✅ `game.js:181` — `currentRoundIndex >= targetSentences.length` → `_renderCompletion()` |
| **Fail** | N/A — retry until correct, no fail state | ✅ |
| **Exit** | Completion screen → "Play Again" | ✅ `game.js` restart button |
| **Save** | None — in-memory only | ⚠ Out of scope |

### Systems touching level transitions
- ✅ Round loader (`_renderRound`) — builds word pool per sentence
- ✅ Event emitter — all 6 events
- ✅ Audio bus — uses `speakWithCues` (audio_cues support)
- ✅ Mastery tracker — keyed by `"sentence-<roundIndex>"`
- ✅ UI renderer — DOM-based
- ❌ Save system — out of scope

---

## PHASE 1 — STATIC / PROCEDURAL CODE AUDIT

### State machine

```
start() → _emitGameStarted() → _renderRound()
  ↓
_renderRound() → [round < 2?]
  YES → build word pool → render tiles + build area + submit/clear buttons
  NO  → _renderCompletion() → _emitGameCompleted() → [Play Again?]

tap word tile → _handleAddTile() → word moves to build area
tap placed tile → _handleRemoveTile() → word returns to pool
tap Clear → _handleClear() → all words return to pool
tap Submit → _handleSubmit()
  ↓
_emitAnswerSubmitted() → _emitAnswerResult()
  ↓
[correct?]
  YES → mastery.recordCorrect() → _showFeedback(correct=true) → setTimeout(2000ms) → next round
  NO  → mastery.recordIncorrect() → _showFeedback(correct=false) → setTimeout(3000ms) → clear build area, re-enable
```

### Audit list

| System | Traced behavior | Verdict |
|---|---|---|
| **Round advancement** | `currentRoundIndex++` in setTimeout(2000ms). Guarded by `isFinished` check? NO — no isFinished property exists. | **RISK** |
| **Submit double-fire** | Submit button disabled after click via `b.disabled = true` in `_showFeedback`. | **SAFE** |
| **Tile add/remove** | `tile.used` flag prevents double-add. Placed tiles removed by index. | **SAFE** |
| **Clear button** | No confirm — one tap wipes build area. Mild friction but not a defect. | **SAFE** |
| **setTimeout lifecycle** | Two setTimeouts in `_showFeedback` (2000ms correct, 3000ms incorrect). NOT cancelled on restart. | **RISK** |
| **DOM rebuild** | `this.root.innerHTML = ''` — old listeners GC'd. | **SAFE** |
| **Null refs** | No non-null assertions. | **SAFE** |
| **Mastery keying** | Keyed by `"sentence-<roundIndex>"` — not stable across unit versions. | **RISK** |
| **Distractor selection** | Deterministic — first 3 vocab words not in sentence. | **SAFE** (by design) |
| **self2 = this aliasing** | Lines 197, 222 use `self2 = this` instead of `self` — code smell, not a bug. | **RISK** (maintainability) |

### Boundary cases

| Case | Behavior | Verdict |
|---|---|---|
| Submit with empty build area | Submitted = "" → isCorrect = false → retry | **SAFE** |
| Submit with partial sentence | Submitted = partial → isCorrect = false → retry | **SAFE** |
| Rapid tile tap (add/remove) | `tile.used` flag + index-based removal → no double-add | **SAFE** |
| Rapid submit (2 clicks) | Button disabled after first → second ignored | **SAFE** |
| Restart during feedback setTimeout | Stale timeout fires on new state → **double-render risk** | **RISK** |
| Punctuation in sentence | "Hello," treated as single token — pedagogically intentional | **SAFE** |

---

## PHASE 2 — DYNAMIC / RUNTIME VERIFICATION

### Full playthrough (headless browser — verified prior session)

| Step | Result |
|---|---|
| Load page | ✅ `game_started` with `gameMode: "sentence-builder"` |
| Round 1: build "Hello, teacher." | ✅ Tiles tap in order, build area fills |
| Submit correct | ✅ `answer_submitted` + `answer_result` (correct) + `mastery_updated` for `sentence-0` |
| Round 1 → 2 transition | ✅ `round_shown` for round 2 with `targetSentence: "Thank you, friend."` |
| Round 2: build "Thank you, friend." | ✅ Correct events fire |
| Completion | ✅ `game_completed` with `finalMastery` |

**Full sequential playthrough: COMPLETED CLEAN**

### Edge cases tested

| Test | Result |
|---|---|
| Rapid tile tap | ✅ No double-add (tile.used flag) |
| Submit incorrect (partial sentence) | ✅ Retry allowed, no crash |
| Rapid submit | ✅ Button disabled, 1 event |

---

## PHASE 3 — CRASH FORENSICS

No crashes observed. **Known risk:** setTimeout in `_showFeedback` not cancelled on restart. Same class as Prototype 01. If user clicks "Play Again" during 2-3s feedback window, stale timeout fires on new state.

---

## PHASE 4 — AA STANDARDS COMPLIANCE

| Category | Verdict | Notes |
|---|---|---|
| **Stability** | **CONDITIONAL PASS** | No crashes in happy path. Stale setTimeout risk on restart. |
| **Save integrity** | **FAIL** | No save system. |
| **Input robustness** | **CONDITIONAL PASS** | No dead-ends. Clear button has no confirm (mild risk of accidental wipe). |
| **Performance floor** | **PASS** | DOM-based, lightweight. |
| **Accessibility/UX** | **CONDITIONAL PASS** | ARIA + keyboard nav via makeSpeakable. Not screen-reader tested. |
| **Localization safety** | **FAIL** | Hardcoded English. |
| **Telemetry hooks** | **PASS** | All 6 events fire once, correctly. |

---

## PHASE 4B — PRODUCTION READINESS

| Item | Verdict |
|---|---|
| Accessibility (WCAG 2.1 AA) | **UNVERIFIED** |
| Cross-browser | **UNVERIFIED** (Safari Web Speech API divergent) |
| Performance under real load | **UNVERIFIED** |
| Security | **CONDITIONAL PASS** (textContent, no backend) |
| Production error handling | **FAIL** (silent error swallowing) |
| Real backend connectivity | **N/A** |
| Real validation | **CONDITIONAL PASS** |
| Multi-tenant | **N/A** |

---

## PHASE 4C — ENGAGEMENT & POLISH

| Item | Verdict | Reasoning |
|---|---|---|
| **Visual currency** | **CONDITIONAL PASS** | Clean, structural. Intentionally minimal. |
| **First-90-seconds hook** | **CONDITIONAL PASS** | Immediate gameplay. Tile-tapping is tactile. But no escalating challenge. |
| **Dramatic pacing** | **FAIL** | 2 rounds, identical difficulty. No tension curve. |
| **Feedback/juice** | **CONDITIONAL PASS** | Correct: green + spoken sentence. Incorrect: red + "Try again." No particles/animation. |
| **Retention hooks** | **FAIL** | 2 rounds only. No progression, no unlocks. Score resets on restart. |
| **Friction** | **CONDITIONAL PASS** | 2-3s feedback delay is mild friction. Clear button no-confirm is mild risk. |

---

## PHASE 5 — FINAL VERDICT

```
BUILD: 6e529f7
SCOPE: Prototype 02 — Sentence Builder (4 files, 1053 lines)

CRITICAL DEFECTS: None
MAJOR DEFECTS:
  - [ ] setTimeout in _showFeedback not cancelled on restart
  - [ ] Mastery keyed by sentence index (not stable ID)
  - [ ] self2 = this aliasing (code smell)
MINOR DEFECTS:
  - [ ] Clear button has no confirm
  - [ ] No localization
  - [ ] Flat pacing (2 identical rounds)
  - [ ] No retention hooks

FULL SEQUENTIAL PLAYTHROUGH: COMPLETED CLEAN (2 rounds)
CRASH-FREE CONFIRMATION: YES, 1 run

PRODUCTION READINESS (4B):
  Accessibility:     UNVERIFIED
  Cross-browser:     UNVERIFIED
  Performance:       UNVERIFIED
  Security:          CONDITIONAL PASS
  Error handling:    FAIL
  Backend:           N/A
  Validation:        CONDITIONAL PASS
  Multi-tenant:      N/A

ENGAGEMENT (4C):
  Visual:            CONDITIONAL PASS
  First-90s hook:    CONDITIONAL PASS
  Pacing:            FAIL
  Juice:             CONDITIONAL PASS
  Retention:         FAIL

VERDICT: CONDITIONALLY READY — conditions:
  1. Fix stale setTimeout on restart
  2. Phase 4B UNVERIFIED items must be resolved
  3. Pacing and retention must be addressed for AA
```
