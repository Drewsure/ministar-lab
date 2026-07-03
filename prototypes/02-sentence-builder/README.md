# Prototype 02 — Sentence Builder

**Status:** ✅ Playable
**Game type:** Text/Spelling (syntax construction)
**Constraint compliance:** All 12 hard constraints satisfied
**Input schema:** `unit_meta` + `pedagogical_payload` + `audio_cues` (distinct from Prototype 01)

---

## How to run (standalone)

No build step. No Python required.

**Windows (PowerShell):**
```powershell
Start-Process "C:\Users\User\ministar-lab\prototypes\02-sentence-builder\index.html"
```

**Mac/Linux:**
```bash
open prototypes/02-sentence-builder/index.html
# or
xdg-open prototypes/02-sentence-builder/index.html
```

> ⚠️ **Note:** TTS (text-to-speech) requires a user gesture before the first speech. Click anywhere on the page first to unlock audio.

---

## 1. Input JSON shape

```jsonc
{
  "unit_meta": {
    "tenant_id": "sample",           // required — no hard-coded tenant (constraint #1)
    "level": 1,                      // required — number
    "theme": "Greetings",            // optional
    "game_mode": "sentence-builder", // required
    "engine_id": "text-spelling"     // optional
  },
  "pedagogical_payload": {
    "vocabulary_terms": [            // 8-12 strings (constraint #7)
      "hello",
      "goodbye",
      "teacher",
      "friend",
      "morning",
      "afternoon",
      "please",
      "thank you"
    ],
    "target_sentences": [            // exactly 2 strings (constraint #8)
      "Hello, teacher.",
      "Thank you, friend."
    ]
  },
  "audio_cues": [                    // optional but recommended (constraint #2)
    {
      "kind": "term",                // "term" | "sentence" | "instruction"
      "text": "hello",              // must match the text the game speaks
      "language": "en",             // BCP-47 language code
      "audioUrl": null              // optional — if provided, played instead of TTS
    },
    {
      "kind": "sentence",
      "text": "Hello, teacher.",
      "language": "en"
    },
    {
      "kind": "instruction",
      "text": "Tap the words in order.",
      "language": "en"
    }
  ]
}
```

**Validation rules** (enforced by `LTB.InputValidator.validateSentenceBuilder`):
- `unit_meta` is required, with `tenant_id`, `game_mode`, `level` (number)
- `pedagogical_payload.vocabulary_terms` must have 8-12 non-empty strings
- `pedagogical_payload.target_sentences` must have exactly 2 non-empty strings
- `audio_cues` (if provided) must be an array of objects with `kind`, `text`, `language`

**Key difference from Prototype 01:** This schema uses plain strings for vocabulary and sentences (not objects with `id`/`term`/`definition`). This matches the "Greetings" unit format where the focus is sentence construction, not term-definition matching.

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
  "gameMode": "sentence-builder",
  "engineId": "text-spelling",
  "level": 1,
  "theme": "Greetings",
  "totalRounds": 2,
  "vocabularyCount": 8,
  "targetSentences": ["Hello, teacher.", "Thank you, friend."]
}
```

### `round_shown`
```jsonc
{
  "type": "round_shown",
  "timestamp": 1,
  "sessionToken": "sess-...",
  "roundIndex": 0,
  "targetSentence": "Hello, teacher.",
  "wordCount": 2,
  "availableWords": ["Hello,", "goodbye", "hello", "teacher", "teacher."]
  // shuffled, includes distractors
}
```

### `answer_submitted`
```jsonc
{
  "type": "answer_submitted",
  "timestamp": 2396,
  "sessionToken": "sess-...",
  "roundIndex": 0,
  "targetSentence": "Hello, teacher.",
  "submitted": "Hello, teacher.",   // space-joined student build
  "isCorrect": true,
  "attemptNumber": 1,               // 1-indexed attempt within this round
  "timeMs": 2395                    // time from round_shown to submit
}
```

### `answer_result`
```jsonc
{
  "type": "answer_result",
  "timestamp": 2396,
  "sessionToken": "sess-...",
  "roundIndex": 0,
  "correct": true,
  "scoreDelta": 1,                  // +1 for correct, 0 for incorrect
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
  "totalAttempts": 2,               // may be > totalRounds if student retried
  "accuracy": 1.0,                  // correct / totalAttempts
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
  "timestamp": 2397,
  "sessionToken": "sess-...",
  "termId": "sentence-0",           // keyed by sentence index
  "previousMastery": 0.0,
  "newMastery": 0.15,               // +0.15 on correct, -0.10 on incorrect
  "delta": 0.15
}
```

---

## 3. Scoring logic

**Deterministic. No random rewards.** (constraint #11)

- **Score:** +1 per correct answer (per round, first correct attempt only).
- **Attempts:** Incremented on every submit (correct or incorrect). A student can retry a round until they get it correct — the round only advances on a correct answer.
- **Accuracy:** `correctRounds / totalAttempts` (shown as percentage on completion).
- **Mastery (per sentence):**
  - Correct answer → `+0.15` (capped at `1.0`)
  - Incorrect answer → `-0.10` (floored at `0.0`)
  - Keyed by `"sentence-<roundIndex>"` since this schema doesn't have term IDs.
- **No gambling mechanics:** No loot boxes, no random rewards, no currency, no streaks. The score is purely a function of correctness.

**Retry behavior:** If the student submits an incorrect answer, the build area clears and they can try again. The round only advances when they submit the correct sentence. Each attempt (correct or incorrect) is counted in `totalAttempts`.

---

## 4. Audio behavior

All learner-facing text has audio support (constraint #2). The game uses `audio_cues` for lookup, falling back to TTS.

| Element | How to hear it | Method |
|---|---|---|
| Instruction ("Tap the words in order.") | Tap the text | `speakWithCues('instruction')` → TTS or audioUrl |
| Target sentence ("Hello, teacher.") | Tap the text **or** tap 🔊 | `speakWithCues('sentence')` → TTS or audioUrl |
| Each word tile | Tap 🔊 on the tile | `speakWithCues('term')` → TTS or audioUrl |
| Word added to build area | Auto-spoken on add | TTS the word |
| Submit button | Tap 🔊 next to it | TTS "Check your answer." |
| Feedback (correct) | Auto-spoken on correct | `speakWithCues('sentence')` — speaks the correct sentence |
| Feedback (incorrect) | Auto-spoken on wrong | `speakWithCues('instruction')` — speaks "The correct sentence is: X" |
| Completion screen | Tap any text | TTS reads the score, accuracy, mastery |

**Constraint #4 compliance:** Word tiles are action buttons (tap to add/remove). Each tile has a **separate 🔊 listen button** so students can hear the word without triggering the add/remove action. The submit button also has a separate 🔊 listen button.

**Audio cue lookup:** The game calls `audio.speakWithCues(text, kind, audioCues)`. If a cue with matching `text` and `kind` exists and has an `audioUrl`, that URL is played. Otherwise, TTS is used with the cue's `language`.

**Mute:** Call `game.audio.setMuted(true)` to mute all audio.

---

## 5. Mobile layout assumptions

- **Target devices:** iPhone SE (375px) to iPad Pro (1024px)
- **Container:** `max-width: 480px`, centered, `padding: 16px`
- **Tap targets:** All word tiles and buttons are `min-height: 44px` (iOS minimum)
- **Font sizes:** Body 16px, prompt 18px, title 24px
- **No horizontal scroll:** Word tiles wrap with `flex-wrap: wrap`
- **No hover-dependent UI:** All interactions work via tap
- **Viewport meta:** `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no`
- **Word tile layout:** `display: inline-flex` with `gap: 8px`, wraps on narrow screens
- **Build area:** `min-height: 60px`, dashed border, wraps placed tiles

**Tested layout breakpoints:**
- 375px (iPhone SE): Word tiles wrap to multiple rows, build area expands vertically
- 480px (iPhone 12+): Comfortable spacing, 4-5 tiles per row
- 768px+ (iPad): Centered card, max-width 480px, gray background fills remaining space

---

## 6. Known limitations

1. **No persistence:** Mastery scores reset when the page reloads. A future integration should persist to the Living Textbook backend.
2. **No timed mode:** No countdown timer. Students can take as long as they need.
3. **Distractors are deterministic:** The first N distractors from the vocab (not in the target sentence) are used. This is intentional to keep scoring deterministic (constraint #11). Future versions could add shuffled distractors without affecting scoring.
4. **Punctuation is part of the word:** "Hello," and "teacher." are treated as single tokens (punctuation attached). The student must place the comma and period correctly. This is pedagogically intentional.
5. **TTS voice quality:** Depends on the browser/OS. On Chrome desktop, Google US English is used. On Safari, Samantha. On mobile, system default.
6. **No image support:** Text-only. A future integration could add image cues.
7. **No keyboard navigation:** Prototype is touch/click only.
8. **Mastery keyed by sentence index:** Since the schema uses plain strings (not term IDs), mastery is tracked per-sentence (`sentence-0`, `sentence-1`), not per-vocabulary-word. Future versions with term IDs could track per-word mastery.

---

## 7. Integration notes for future LivingTextbook migration

### Embedding in the Living Textbook app

The prototype is a standalone HTML file. To embed it in a React/Next.js app:

```tsx
import { useEffect, useRef } from 'react';

export function SentenceBuilderGame({ data, onEvent }: { data: SentenceBuilderInput; onEvent: (e: GameEvent) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<any>(null);

  useEffect(() => {
    // Load the framework + game script dynamically
    const frameworkScript = document.createElement('script');
    frameworkScript.src = '/prototypes/_shared/prototype-framework.js';
    frameworkScript.onload = () => {
      const gameScript = document.createElement('script');
      gameScript.src = '/prototypes/02-sentence-builder/game.js';
      gameScript.onload = () => {
        if (containerRef.current && window.SentenceBuilder) {
          gameRef.current = new window.SentenceBuilder(containerRef.current, data, { onEvent });
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

In production, the input would come from the Living Textbook's content API, filtered by:
- Tenant ID (`unit_meta.tenant_id`)
- Level (`unit_meta.level`)
- Theme/unit (`unit_meta.theme`)
- Game mode (`unit_meta.game_mode`)

### Event routing

All 6 events should be forwarded to the Living Textbook's xAPI telemetry endpoint:

```ts
function handleGameEvent(event: GameEvent) {
  // Convert to xAPI statement
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
- Pre-loading: the host app should preload audio for all cues in the current unit before the game starts
- The game looks up cues by `text` + `kind` — if a cue has an `audioUrl`, that URL is played; otherwise TTS is used
- Language is passed to TTS via `utter.lang` so multi-language units work correctly

### Mastery persistence

The prototype tracks mastery in-memory (keyed by `"sentence-<roundIndex>"`). In production:
- On `mastery_updated`: PATCH `/api/sentences/{sentenceId}/mastery` with the new value
- On `game_completed`: POST `/api/game-sessions` with the full event log
- Future schema enhancement: add `id` to each target sentence so mastery can be keyed by stable ID instead of round index

### Theme / branding

The prototype uses a neutral gray/blue theme. In the Living Textbook integration:
- Replace the hardcoded colors in `prototype-framework.js` (`UI.applyBaseStyles`) with CSS variables from the tenant's `ThemeConfig`
- The prototype does NOT hard-code any brand identity

### Multi-tenant safety

- No tenant ID is hard-coded
- All tenant context comes from `unit_meta.tenant_id` in the input JSON
- Event payloads include `tenantId` for downstream routing
- No localStorage / sessionStorage usage (no cross-tenant data leakage risk)

### Schema evolution

This prototype uses a new schema (`unit_meta` + `pedagogical_payload` + `audio_cues`) that differs from Prototype 01's schema (`tenant` + `terms[]` + `sentenceStructures[]`). The shared framework supports both schemas via two validators:
- `LTB.InputValidator.validate(data)` — for Prototype 01 schema
- `LTB.InputValidator.validateSentenceBuilder(data)` — for Prototype 02 schema

Future prototypes should add their own validators as needed. The shared framework's `EventLogger`, `AudioBus`, `MasteryTracker`, and `UI` helpers work with both schemas.
