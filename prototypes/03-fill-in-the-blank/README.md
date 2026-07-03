# Prototype 03 — Fill in the Blank

**Status:** ✅ Playable
**Game type:** Selection (multiple choice with sentence completion)
**Constraint compliance:** All 12 hard constraints satisfied
**Input schema:** `unit_meta` + `pedagogical_payload` + `audio_cues` (Schema B, same as Prototype 02)

---

## How to run (standalone)

No build step. No Python required.

**Windows (PowerShell):**
```powershell
Start-Process "C:\Users\User\ministar-lab\prototypes\03-fill-in-the-blank\index.html"
```

**Mac/Linux:**
```bash
open prototypes/03-fill-in-the-blank/index.html
# or
xdg-open prototypes/03-fill-in-the-blank/index.html
```

> ⚠️ **Note:** TTS (text-to-speech) requires a user gesture before the first speech. Click anywhere on the page first to unlock audio.

---

## 1. Input JSON shape

```jsonc
{
  "unit_meta": {
    "tenant_id": "sample",              // required — no hard-coded tenant (constraint #1)
    "level": 1,                         // required — number
    "theme": "Classroom",               // optional
    "game_mode": "fill-in-the-blank",   // required
    "engine_id": "text-spelling"        // optional
  },
  "pedagogical_payload": {
    "vocabulary_terms": [               // 8-12 strings (constraint #7)
      "book", "pencil", "teacher", "student",
      "desk", "chair", "read", "write", "listen", "speak"
    ],
    "target_sentences": [               // exactly 2 strings (constraint #8), each with {blank}
      "I {blank} a story every night.",
      "The {blank} writes on the whiteboard."
    ]
  },
  "audio_cues": [                       // optional but recommended (constraint #2)
    { "kind": "term", "text": "read", "language": "en" },
    { "kind": "sentence", "text": "I read a story every night.", "language": "en" },
    { "kind": "instruction", "text": "Choose the word that fits.", "language": "en" },
    { "kind": "feedback", "text": "That fits.", "language": "en" },
    { "kind": "feedback", "text": "Not quite. Try again.", "language": "en" }
  ]
}
```

**Critical: `{blank}` placeholder**
Each target sentence must contain exactly one `{blank}` placeholder marking the missing word. The game replaces `{blank}` with `_____` for display.

**Answer derivation:**
The correct answer is derived by comparing the `{blank}` sentence to the full sentence in `audio_cues` (kind=`"sentence"`). The game finds the sentence cue that matches the pattern `before + * + after` and extracts the substituted word.

Example:
- Target sentence: `"I {blank} a story every night."`
- Audio cue (kind=sentence): `"I read a story every night."`
- Derived answer: `"read"`

If no matching audio cue is found, the game falls back to the first vocabulary term (shouldn't happen with valid data).

**Validation rules** (enforced by `LTB.InputValidator.validateSentenceBuilder`):
- `unit_meta` is required, with `tenant_id`, `game_mode`, `level` (number)
- `pedagogical_payload.vocabulary_terms` must have 8-12 non-empty strings
- `pedagogical_payload.target_sentences` must have exactly 2 non-empty strings
- `audio_cues` (if provided) must be an array of objects with `kind`, `text`, `language`

---

## 2. Emitted events

All events are emitted via the `onEvent` callback. Each event has `type`, `timestamp` (ms since game start), `sessionToken`, plus type-specific fields.

### `game_started`
```jsonc
{
  "type": "game_started",
  "timestamp": 0,
  "sessionToken": "sess-...",
  "tenantId": "sample",
  "gameMode": "fill-in-the-blank",
  "engineId": "text-spelling",
  "level": 1,
  "theme": "Classroom",
  "totalRounds": 2,
  "vocabularyCount": 10,
  "targetSentences": [
    "I {blank} a story every night.",
    "The {blank} writes on the whiteboard."
  ]
}
```

### `round_shown`
```jsonc
{
  "type": "round_shown",
  "timestamp": 1,
  "sessionToken": "sess-...",
  "roundIndex": 0,
  "targetSentence": "I {blank} a story every night.",   // raw with {blank}
  "displaySentence": "I _____ a story every night.",    // rendered for display
  "answer": "read",                                     // the correct word
  "choices": ["book", "pencil", "teacher", "read"]     // shuffled
}
```

### `answer_submitted`
```jsonc
{
  "type": "answer_submitted",
  "timestamp": 1701,
  "sessionToken": "sess-...",
  "roundIndex": 0,
  "targetSentence": "I {blank} a story every night.",
  "selected": "read",
  "isCorrect": true,
  "attemptNumber": 1,           // 1-indexed attempt within this round
  "timeMs": 1700                // time from round_shown to submit
}
```

### `answer_result`
```jsonc
{
  "type": "answer_result",
  "timestamp": 1701,
  "sessionToken": "sess-...",
  "roundIndex": 0,
  "correct": true,
  "scoreDelta": 1,              // +1 for correct, 0 for incorrect
  "newScore": 1,
  "attemptsThisRound": 1
}
```

### `game_completed`
```jsonc
{
  "type": "game_completed",
  "timestamp": 15000,
  "sessionToken": "sess-...",
  "totalRounds": 2,
  "correct": 2,
  "totalAttempts": 2,           // may be > totalRounds if student retried
  "accuracy": 1.0,              // correct / totalAttempts
  "durationMs": 15000,
  "finalMastery": {
    "sentence-0": 0.15,
    "sentence-1": 0.15
  }
}
```

### `mastery_updated`
```jsonc
{
  "type": "mastery_updated",
  "timestamp": 1701,
  "sessionToken": "sess-...",
  "termId": "sentence-0",       // keyed by sentence index
  "previousMastery": 0.0,
  "newMastery": 0.15,           // +0.15 on correct, -0.10 on incorrect
  "delta": 0.15
}
```

---

## 3. Scoring logic

**Deterministic. No random rewards.** (constraint #11)

- **Score:** +1 per correct answer (per round, first correct attempt only).
- **Attempts:** Incremented on every choice (correct or incorrect). A student can retry a round until they get it correct — the round only advances on a correct answer.
- **Accuracy:** `correctRounds / totalAttempts` (shown as percentage on completion).
- **Mastery (per sentence):**
  - Correct answer → `+0.15` (capped at `1.0`)
  - Incorrect answer → `-0.10` (floored at `0.0`)
  - Keyed by `"sentence-<roundIndex>"` since this schema doesn't have term IDs.
- **No gambling mechanics:** No loot boxes, no random rewards, no currency, no streaks.

**Retry without shame (per requirement):**
- Incorrect answers do NOT use "wrong", "fail", or "incorrect" in the UI text.
- The UI shows: "Not quite. Try again." (shame-free, encouraging)
- The student can immediately retry — choices re-enable after 1.8 seconds.
- The event payload uses neutral field names (`isCorrect: false`) for telemetry — the shame-free language is purely a UI concern.

---

## 4. Audio behavior

All learner-facing text has audio support (constraint #2). The game uses `audio_cues` for lookup, falling back to TTS.

| Element | How to hear it | Audio cue kind | Method |
|---|---|---|---|
| Instruction ("Choose the word that fits.") | Tap the text | `instruction` | `speakWithCues` → TTS or audioUrl |
| Sentence (with blank) | Tap the text **or** tap 🔊 | `sentence` | Speaks the FULL sentence (answer filled in) |
| Each choice button | Tap 🔊 on the button | `term` | `speakWithCues` → TTS or audioUrl |
| Feedback (correct) | Auto-spoken on correct | `feedback` | Speaks "That fits. [full sentence]" |
| Feedback (incorrect) | Auto-spoken on wrong | `feedback` | Speaks "Not quite. Try again." |
| Completion screen | Tap any text | mixed | TTS reads the score, accuracy, mastery |

**Constraint #4 compliance:** Choice buttons are action buttons (tap to submit answer). Each choice has a **separate 🔊 listen button** so students can hear the word without submitting. The sentence also has a separate 🔊 listen button.

**Audio cue lookup:** The game calls `audio.speakWithCues(text, kind, audioCues)`. If a cue with matching `text` and `kind` exists and has an `audioUrl`, that URL is played. Otherwise, TTS is used with the cue's `language`.

**Shame-free feedback audio:** The feedback for incorrect answers speaks "Not quite. Try again." — never "wrong" or "incorrect". This is both in the visible text and the spoken audio.

**Mute:** Call `game.audio.setMuted(true)` to mute all audio.

---

## 5. Mobile layout assumptions

- **Target devices:** iPhone SE (375px) to iPad Pro (1024px)
- **Container:** `max-width: 480px`, centered, `padding: 16px`
- **Tap targets:** All choice buttons and listen buttons are `min-height: 48px` (exceeds 44px iOS minimum)
- **Font sizes:** Body 16px, sentence 18px, title 24px
- **No horizontal scroll:** Choice buttons are full-width, stack vertically
- **No hover-dependent UI:** All interactions work via tap
- **Viewport meta:** `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no`
- **Choice button layout:** Full-width, stacked vertically, with word text on left and 🔊 on right

**Tested layout breakpoints:**
- 375px (iPhone SE): Full-width buttons, comfortable spacing
- 480px (iPhone 12+): Same layout, slightly more padding
- 768px+ (iPad): Centered card, max-width 480px, gray background fills remaining space

---

## 6. Known limitations

1. **No persistence:** Mastery scores reset when the page reloads. A future integration should persist to the Living Textbook backend.
2. **No timed mode:** No countdown timer. Students can take as long as they need.
3. **Answer derivation depends on audio_cues:** The correct answer is derived by matching the `{blank}` sentence to a full sentence in `audio_cues` (kind=`"sentence"`). If no matching cue exists, the game falls back to the first vocabulary term. The host app should always provide matching sentence cues.
4. **Distractors are deterministic:** The first 3 vocabulary terms (that aren't the answer) are used as distractors, then shuffled. This is intentional to keep scoring deterministic (constraint #11).
5. **Only one blank per sentence:** The schema supports exactly one `{blank}` per sentence. Multiple blanks are not supported.
6. **TTS voice quality:** Depends on the browser/OS. On Chrome desktop, Google US English is used. On Safari, Samantha. On mobile, system default.
7. **No image support:** Text-only. A future integration could add image cues.
8. **No keyboard navigation:** Prototype is touch/click only.
9. **Mastery keyed by sentence index:** Since the schema uses plain strings (not term IDs), mastery is tracked per-sentence (`sentence-0`, `sentence-1`), not per-vocabulary-word.
10. **No typed input:** The requirement mentioned "choosing or typing" — this prototype implements only the choosing (multiple choice) variant. A future variant could add a text input mode where students type the word instead of selecting it.

---

## 7. Integration notes for future LivingTextbook migration

### Embedding in the Living Textbook app

The prototype is a standalone HTML file. To embed it in a React/Next.js app:

```tsx
import { useEffect, useRef } from 'react';

export function FillInTheBlankGame({ data, onEvent }: { data: FillInTheBlankInput; onEvent: (e: GameEvent) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<any>(null);

  useEffect(() => {
    const frameworkScript = document.createElement('script');
    frameworkScript.src = '/prototypes/_shared/prototype-framework.js';
    frameworkScript.onload = () => {
      const gameScript = document.createElement('script');
      gameScript.src = '/prototypes/03-fill-in-the-blank/game.js';
      gameScript.onload = () => {
        if (containerRef.current && window.FillInTheBlank) {
          gameRef.current = new window.FillInTheBlank(containerRef.current, data, { onEvent });
          gameRef.current.start();
        }
      };
      document.body.appendChild(gameScript);
    };
    document.body.appendChild(frameworkScript);
    return () => { if (gameRef.current) gameRef.current.destroy?.(); };
  }, [data, onEvent]);

  return <div ref={containerRef} />;
}
```

### Tenant isolation (constraint #1)

The prototype accepts `unit_meta.tenant_id` in the input. The game does NOT hard-code any tenant identity. The `tenantId` is passed through to every emitted event so the host app can route telemetry correctly.

### Data source

In production, the input would come from the Living Textbook's content API. The host app must ensure:
- Each target sentence contains exactly one `{blank}` placeholder
- A matching full sentence (with the blank filled in) is provided in `audio_cues` with `kind: "sentence"` — this is how the game derives the correct answer
- Vocabulary terms include the correct answer plus enough distractors (at least 3)

### Event routing

All 6 events should be forwarded to the Living Textbook's xAPI telemetry endpoint:

```ts
function handleGameEvent(event: GameEvent) {
  const xapiStatement = convertToXapi(event);
  await fetch('/api/telemetry', {
    method: 'POST',
    body: JSON.stringify({ statement: xapiStatement, tenantId: event.tenantId }),
  });
}
```

### Audio cues integration

The `audio_cues` array allows pre-recorded audio files to override TTS. In production:
- Audio files should be served from a CDN with proper caching headers
- Pre-loading: the host app should preload audio for all cues in the current unit
- The game looks up cues by `text` + `kind` — if a cue has an `audioUrl`, that URL is played; otherwise TTS is used
- The `feedback` kind is used for shame-free feedback audio ("That fits." / "Not quite. Try again.")

### Shame-free retry (pedagogical requirement)

This prototype implements shame-free retry language:
- UI text: "Not quite. Try again." (never "wrong", "fail", "incorrect")
- Spoken audio: "Not quite. Try again."
- Event payload: `isCorrect: false` (neutral field name for telemetry)
- The student can retry immediately — no penalty, no shame, just encouragement

This aligns with growth-mindset pedagogy and is suitable for young learners.

### Mastery persistence

The prototype tracks mastery in-memory (keyed by `"sentence-<roundIndex>"`). In production:
- On `mastery_updated`: PATCH `/api/sentences/{sentenceId}/mastery` with the new value
- On `game_completed`: POST `/api/game-sessions` with the full event log
- Future schema enhancement: add `id` to each target sentence so mastery can be keyed by stable ID

### Theme / branding

The prototype uses a neutral gray/blue theme. In the Living Textbook integration:
- Replace the hardcoded colors in `prototype-framework.js` (`UI.applyBaseStyles`) with CSS variables from the tenant's `ThemeConfig`
- The prototype does NOT hard-code any brand identity

### Multi-tenant safety

- No tenant ID is hard-coded
- All tenant context comes from `unit_meta.tenant_id` in the input JSON
- Event payloads include `tenantId` for downstream routing
- No localStorage / sessionStorage usage (no cross-tenant data leakage risk)

### Schema compatibility

This prototype uses Schema B (same as Prototype 02): `unit_meta` + `pedagogical_payload` + `audio_cues`. The shared framework's `LTB.InputValidator.validateSentenceBuilder()` validates this schema. The only addition is the `{blank}` placeholder requirement in `target_sentences`.
