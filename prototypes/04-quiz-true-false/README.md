# Prototype 04 — Quiz / True-False

**Status:** ✅ Playable
**Game type:** Selection (review and assessment)
**Constraint compliance:** All 12 hard constraints satisfied
**Input schema:** `unit_meta` + `pedagogical_payload` + `audio_cues` (Schema B)
**Modes:** Multiple Choice + True/False (selectable from start screen)

---

## How to run (standalone)

No build step. No Python required.

**Windows (PowerShell):**
```powershell
Start-Process "C:\Users\User\ministar-lab\prototypes\04-quiz-true-false\index.html"
```

**Mac/Linux:**
```bash
open prototypes/04-quiz-true-false/index.html
```

> ⚠️ **Note:** TTS requires a user gesture before the first speech. Click anywhere on the page first to unlock audio.

---

## 1. Input JSON shape

```jsonc
{
  "unit_meta": {
    "tenant_id": "sample",              // required — no hard-coded tenant (constraint #1)
    "level": 1,                         // required — number
    "theme": "Animals",                 // optional
    "game_mode": "quiz-true-false",     // required
    "engine_id": "selection"            // optional — maps to LivingTextbook selection engine
  },
  "pedagogical_payload": {
    "vocabulary_terms": [               // 8-12 strings (constraint #7)
      "cat", "dog", "bird", "fish", "rabbit", "mouse", "horse", "cow", "duck", "frog"
    ],
    "target_sentences": [               // exactly 2 strings (constraint #8)
      "A cat says meow.",
      "A dog says woof."
    ]
  },
  "audio_cues": [                       // optional but recommended (constraint #2)
    { "kind": "term", "text": "cat", "language": "en" },
    { "kind": "sentence", "text": "A cat says meow.", "language": "en" },
    { "kind": "instruction", "text": "Choose a mode to begin.", "language": "en" },
    { "kind": "instruction", "text": "Multiple Choice. Tap the correct answer.", "language": "en" },
    { "kind": "instruction", "text": "True or False. Tap True or False.", "language": "en" },
    { "kind": "instruction", "text": "Read each question. Tap to hear it. Then choose your answer.", "language": "en" },
    { "kind": "instruction", "text": "Not quite. Try again.", "language": "en" },
    { "kind": "feedback", "text": "That is right.", "language": "en" },
    { "kind": "feedback", "text": "Not quite. Try again.", "language": "en" }
  ]
}
```

**Question generation:** Questions are generated from the payload by `questions.js`:
- **Multiple Choice:** One question per target sentence. "A cat says meow." → "Which word goes with: 'says meow'?" → answer: "cat" + 3 distractors
- **True/False:** Two questions per target sentence (one true, one false with a swapped word). "A cat says meow." → True version (correct) + "A dog says meow." (false version)

The host app can override generation by providing an explicit `questions` array in the input JSON (future enhancement — not in the current sample).

**Validation rules** (enforced by `LTB.InputValidator.validateSentenceBuilder`):
- `unit_meta` is required, with `tenant_id`, `game_mode`, `level`
- `pedagogical_payload.vocabulary_terms` must have 8-12 non-empty strings
- `pedagogical_payload.target_sentences` must have exactly 2 non-empty strings
- `audio_cues` (if provided) must be an array with `kind`, `text`, `language`

---

## 2. Emitted events

All events via the `onEvent` callback. Each has `type`, `timestamp`, `sessionToken`, plus type-specific fields.

### `game_started`
```jsonc
{
  "type": "game_started",
  "timestamp": 0,
  "sessionToken": "sess-...",
  "tenantId": "sample",
  "gameMode": "quiz-true-false",
  "engineId": "selection",
  "level": 1,
  "theme": "Animals",
  "mode": "multiple-choice",            // or "true-false"
  "totalQuestions": 2,                  // MC: 2 questions (1 per sentence); TF: 4 questions (2 per sentence)
  "vocabularyCount": 10,
  "targetSentences": ["A cat says meow.", "A dog says woof."]
}
```

### `round_shown`
```jsonc
// Multiple Choice
{
  "type": "round_shown",
  "timestamp": 1,
  "sessionToken": "sess-...",
  "questionIndex": 0,
  "questionId": "mc-0",
  "questionType": "multiple-choice",
  "prompt": "Which word goes with: \"says meow\"?",
  "answer": "cat",
  "choices": ["bird", "cat", "dog", "fish"]
}

// True/False
{
  "type": "round_shown",
  "timestamp": 1,
  "sessionToken": "sess-...",
  "questionIndex": 0,
  "questionId": "tf-true-0",
  "questionType": "true-false",
  "prompt": "True or False: A cat says meow.",
  "answer": true
}
```

### `answer_submitted`
```jsonc
{
  "type": "answer_submitted",
  "timestamp": 1200,
  "sessionToken": "sess-...",
  "questionIndex": 0,
  "questionId": "mc-0",
  "selected": "cat",            // string for MC, boolean for TF
  "isCorrect": true,
  "attemptNumber": 1,
  "timeMs": 1199
}
```

### `answer_result`
```jsonc
{
  "type": "answer_result",
  "timestamp": 1200,
  "sessionToken": "sess-...",
  "questionIndex": 0,
  "correct": true,
  "scoreDelta": 1,
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
  "mode": "multiple-choice",
  "totalQuestions": 2,
  "correct": 2,
  "totalAttempts": 2,
  "accuracy": 1.0,
  "durationMs": 15000,
  "finalMastery": {
    "mc-0": 0.15,
    "mc-1": 0.15
  }
}
```

### `mastery_updated`
```jsonc
{
  "type": "mastery_updated",
  "timestamp": 1200,
  "sessionToken": "sess-...",
  "termId": "mc-0",             // keyed by question ID
  "previousMastery": 0.0,
  "newMastery": 0.15,
  "delta": 0.15
}
```

---

## 3. Scoring logic

**Deterministic. No random rewards.** (constraint #11)

- **Score:** +1 per correct answer (per question, first correct attempt only).
- **Attempts:** Incremented on every answer (correct or incorrect). Retry allowed on incorrect.
- **Accuracy:** `correctQuestions / totalAttempts` (shown as percentage on completion).
- **Mastery (per question):**
  - Correct → `+0.15` (capped at `1.0`)
  - Incorrect → `-0.10` (floored at `0.0`)
  - Keyed by question ID (`mc-0`, `tf-true-0`, etc.)
- **No gambling mechanics:** No loot boxes, no random rewards, no currency.

**Child-safe feedback (per requirement):**
- Correct: "✓ That is right!" + encouraging tone
- Incorrect: "Not quite. Try again." — no shame language, retry allowed
- Event payload uses neutral `isCorrect: false` for telemetry

---

## 4. Audio behavior

All learner-facing text has audio support (constraint #2). Uses `audio_cues` for lookup, falls back to TTS.

| Element | How to hear it | Audio cue kind | Method |
|---|---|---|---|
| Start screen title | Tap the text | (TTS) | `speak()` |
| Start screen instruction | Tap the text | `instruction` | `speakWithCues` |
| Mode buttons (MC / TF) | Tap 🔊 on button | `instruction` | `speakWithCues` |
| Question text | Tap the text **or** tap 🔊 | `instruction` | `speakWithCues` |
| Multiple-choice answers | Tap 🔊 on button | `term` | `speakWithCues` |
| True/False buttons | Tap 🔊 on button | `term` | `speakWithCues` |
| Feedback (correct) | Auto-spoken | `feedback` | "That is right." |
| Feedback (incorrect) | Auto-spoken | `feedback` | "Not quite. Try again." |
| Completion screen | Tap any text | mixed | TTS reads score, accuracy |

**Constraint #4 compliance:** Answer buttons are action buttons (tap to submit). Each has a **separate 🔊 listen button**. Question text has a separate 🔊 listen button. Mode buttons on start screen also have separate 🔊 listen buttons.

**Mute:** Call `game.audio.setMuted(true)` to mute all audio.

---

## 5. Mobile layout assumptions

- **Target devices:** iPhone SE (375px) to iPad Pro (1024px)
- **Container:** `max-width: 480px`, centered, `padding: 16px`
- **Tap targets:** All buttons are `min-height: 48px` (exceeds 44px iOS minimum)
- **Font sizes:** Body 16px, question 18px, title 28px
- **No horizontal scroll:** All content fits within 480px
- **No hover-dependent UI:** All interactions work via tap
- **Viewport meta:** `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no`

**Tested layout breakpoints:**
- 375px (iPhone SE): Single column, full-width buttons
- 480px (iPhone 12+): Comfortable spacing
- 768px+ (iPad): Centered card, max-width 480px

---

## 6. Known limitations

1. **No persistence:** Mastery scores reset on page reload. Future integration should persist to backend.
2. **No timed mode:** No countdown timer. Students take as long as they need.
3. **Question generation is simple:** MC questions ask "Which word goes with: [predicate]?" derived from target sentences. TF questions swap the subject with another vocab word. The host app can override with explicit questions (future enhancement).
4. **Distractors are deterministic:** First 3 vocab words that aren't the answer (then shuffled). Keeps scoring deterministic per constraint #11.
5. **No mixed mode:** The start screen offers MC OR TF, not a mixed quiz. Could be added easily (the generator supports `mode: "mixed"`).
6. **TTS voice quality:** Depends on browser/OS.
7. **No image support:** Text-only.
8. **No keyboard navigation:** Touch/click only.
9. **Mastery keyed by question ID:** Since questions are generated, mastery is tracked per generated question (`mc-0`, `tf-true-0`). Future versions with explicit question IDs from the host app could track per-question mastery more meaningfully.
10. **TF false-statement generation is naive:** Swaps the subject with the first different vocab word. May produce nonsensical statements for some sentence structures. Host app should provide explicit TF questions for production use.

---

## 7. Integration notes for LivingTextbook migration

### Mapping to the LivingTextbook Selection Parent Engine

This prototype is a **selection-engine** game — it belongs to the same family as Prototype 01 (Vocab Tap Match) and Prototype 03 (Fill in the Blank). In the LivingTextbook architecture, the **Selection parent engine** is the base class for all games where the student selects an answer from a set of choices.

**Selection engine family:**

| Prototype | Mechanic | Selection type |
|---|---|---|
| 01 — Vocab Tap Match | Tap the word that completes the sentence | 4-way multiple choice |
| 03 — Fill in the Blank | Tap the word that fills the `{blank}` | 4-way multiple choice |
| **04 — Quiz / True-False** | **MC quiz + True/False quiz** | **4-way MC + 2-way TF** |

**How this prototype maps to the parent engine:**

```
LivingTextbook Selection Engine (parent)
├── Input: pedagogical_payload (vocab + sentences)
├── Question Generator (overrideable)
│   ├── MC generator (this prototype's questions.js)
│   ├── TF generator (this prototype's questions.js)
│   └── Custom (host app provides explicit questions)
├── Renderer (overrideable)
│   ├── Start screen renderer (this prototype)
│   ├── MC question renderer (this prototype)
│   └── TF question renderer (this prototype)
├── Event Emitter (shared framework — LTB.EventLogger)
├── Audio Bus (shared framework — LTB.AudioBus)
└── Mastery Tracker (shared framework — LTB.MasteryTracker)
```

**To migrate this prototype into the LivingTextbook Selection engine:**

1. **Extract the question generator** (`questions.js`) into a shared module that the parent engine can call. The host app passes `pedagogical_payload` + `mode`, gets back a list of `Question` objects.

2. **Extract the renderers** (start screen, MC question, TF question) into overrideable methods on the parent engine. Subclasses (like this prototype) can override specific renderers without rewriting the whole engine.

3. **Use the shared framework** (`LTB.EventLogger`, `LTB.AudioBus`, `LTB.MasteryTracker`) as the foundation. These already emit the 6 standard events and handle audio cues.

4. **The `engine_id` field** in `unit_meta` (`"selection"`) tells the host app which parent engine to instantiate. This prototype's `game_mode` is `"quiz-true-false"` — the host app routes to this specific subclass.

### Embedding in the Living Textbook app

```tsx
import { useEffect, useRef } from 'react';

export function QuizTrueFalseGame({ data, onEvent }: { data: QuizInput; onEvent: (e: GameEvent) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<any>(null);

  useEffect(() => {
    const frameworkScript = document.createElement('script');
    frameworkScript.src = '/prototypes/_shared/prototype-framework.js';
    frameworkScript.onload = () => {
      const questionsScript = document.createElement('script');
      questionsScript.src = '/prototypes/04-quiz-true-false/questions.js';
      questionsScript.onload = () => {
        const gameScript = document.createElement('script');
        gameScript.src = '/prototypes/04-quiz-true-false/game.js';
        gameScript.onload = () => {
          if (containerRef.current && window.QuizTrueFalse) {
            gameRef.current = new window.QuizTrueFalse(containerRef.current, data, { onEvent });
            gameRef.current.start();
          }
        };
        document.body.appendChild(gameScript);
      };
      document.body.appendChild(questionsScript);
    };
    document.body.appendChild(frameworkScript);
    return () => { if (gameRef.current) gameRef.current.destroy?.(); };
  }, [data, onEvent]);

  return <div ref={containerRef} />;
}
```

### Tenant isolation (constraint #1)

- No tenant ID is hard-coded
- `tenantId` comes from `unit_meta.tenant_id` and is passed to every event
- No localStorage / sessionStorage usage

### Data source

In production, the host app provides:
- `pedagogical_payload` from the content API (filtered by tenant, level, theme)
- `audio_cues` from the audio asset service (filtered by language)
- Optionally, an explicit `questions` array to override generation

### Event routing

All 6 events forward to the LivingTextbook xAPI telemetry endpoint:

```ts
function handleGameEvent(event: GameEvent) {
  const xapiStatement = convertToXapi(event);
  await fetch('/api/telemetry', {
    method: 'POST',
    body: JSON.stringify({ statement: xapiStatement, tenantId: event.tenantId }),
  });
}
```

### Child-safe feedback (pedagogical requirement)

This prototype implements child-safe feedback:
- Correct: "✓ That is right!" (encouraging, never condescending)
- Incorrect: "Not quite. Try again." (shame-free, growth-mindset)
- No "wrong", "fail", "incorrect", "X" in UI text
- Event payload uses neutral `isCorrect: false` for telemetry
- Retry is always allowed — no penalty, no lockout

This aligns with child-safe design principles and is suitable for young learners.

### Theme / branding

The prototype uses a neutral gray/blue/green theme. In the LivingTextbook integration, replace hardcoded colors with CSS variables from the tenant's `ThemeConfig`. The prototype does NOT hard-code any brand identity.

### Multi-tenant safety

- No tenant ID is hard-coded
- All tenant context comes from `unit_meta.tenant_id`
- Event payloads include `tenantId` for downstream routing
- No localStorage / sessionStorage usage

### Schema compatibility

This prototype uses Schema B (same as Prototypes 02 and 03): `unit_meta` + `pedagogical_payload` + `audio_cues`. The shared framework's `LTB.InputValidator.validateSentenceBuilder()` validates this schema. The `engine_id: "selection"` field in `unit_meta` signals that this game belongs to the Selection parent engine family.
