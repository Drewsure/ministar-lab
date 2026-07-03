# Prototype 01 — Vocab Tap Match

**Status:** ✅ Playable
**Game type:** Selection (multiple choice)
**Constraint compliance:** All 12 hard constraints satisfied

---

## How to run (standalone)

No build step. Just open the HTML file in a browser:

```bash
# From the prototypes/01-vocab-tap-match/ directory:
python3 -m http.server 8080
# Then visit http://localhost:8080/
```

Or simply open `index.html` directly in a browser.

> ⚠️ **Note:** TTS (text-to-speech) requires a user gesture before the first speech. Click anywhere on the page first to unlock audio.

---

## 1. Input JSON shape

```jsonc
{
  "tenant": {
    "id": "demo-tenant",            // optional but recommended
    "displayName": "Demo Tenant"
  },
  "terms": [
    {
      "id": "t1",                    // unique identifier
      "term": "apple",              // the vocabulary word
      "emoji": "🍎",                // optional, displayed alongside term
      "definition": "a round red or green fruit",
      "partOfSpeech": "noun",       // optional
      "audioUrl": null              // optional — if provided, played instead of TTS
    }
    // ... 8-12 terms total (constraint #7)
  ],
  "sentenceStructures": [
    {
      "id": "s1",
      "template": "I like {term}.",   // must contain {term} placeholder
      "structure": "SVO",             // optional label
      "description": "Subject + Verb + Object",
      "audioUrl": null
    },
    {
      "id": "s2",
      "template": "I see a {term} on the table.",
      "structure": "SVO + Locative",
      "description": "Subject + Verb + Object + Prepositional Phrase",
      "audioUrl": null
    }
    // EXACTLY 2 structures (constraint #8)
  ],
  "config": {
    "roundsPerGame": 8,           // optional, default 8
    "optionsPerRound": 4,         // optional, default 4
    "timePerRoundSec": null       // optional, null = untimed
  }
}
```

**Validation rules** (enforced by `LTB.InputValidator`):
- `terms` must have 8-12 items, each with `id`, `term`, `definition`
- `sentenceStructures` must have exactly 2 items, each with `id`, `template` containing `{term}`
- If `tenant` is provided, it must have `id` and `displayName`

---

## 2. Emitted events

All events are emitted via the `onEvent` callback passed to the constructor. Each event has a `type`, `timestamp` (ms since game start), and `sessionToken`.

### `game_started`
```jsonc
{
  "type": "game_started",
  "timestamp": 0,
  "sessionToken": "sess-...",
  "tenantId": "demo-tenant",
  "totalRounds": 8,
  "termCount": 10,
  "sentenceStructureIds": ["s1", "s2"]
}
```

### `round_shown`
```jsonc
{
  "type": "round_shown",
  "timestamp": 1234,
  "sessionToken": "sess-...",
  "roundIndex": 0,
  "prompt": "I like _____.",              // prompt with blank
  "sentenceStructureId": "s1",
  "termId": "t1",                         // correct answer's term ID
  "options": ["t1", "t4", "t7", "t9"]     // shuffled option term IDs
}
```

### `answer_submitted`
```jsonc
{
  "type": "answer_submitted",
  "timestamp": 4567,
  "sessionToken": "sess-...",
  "roundIndex": 0,
  "termId": "t1",            // correct answer
  "selectedTermId": "t1",    // what the student picked
  "timeMs": 3330             // time from round_shown to answer_submitted
}
```

### `answer_result`
```jsonc
{
  "type": "answer_result",
  "timestamp": 4567,
  "sessionToken": "sess-...",
  "roundIndex": 0,
  "correct": true,
  "scoreDelta": 1,           // +1 for correct, 0 for incorrect
  "newScore": 1,
  "streak": 1                // consecutive correct count
}
```

### `game_completed`
```jsonc
{
  "type": "game_completed",
  "timestamp": 45000,
  "sessionToken": "sess-...",
  "totalRounds": 8,
  "correct": 6,
  "accuracy": 0.75,
  "durationMs": 45000,
  "finalMastery": {          // per-term mastery 0.0-1.0
    "t1": 0.15,
    "t2": 0.0,
    "t3": 0.3
    // ...
  }
}
```

### `mastery_updated`
```jsonc
{
  "type": "mastery_updated",
  "timestamp": 4567,
  "sessionToken": "sess-...",
  "termId": "t1",
  "previousMastery": 0.0,
  "newMastery": 0.15,        // +0.15 on correct, -0.1 on incorrect
  "delta": 0.15
}
```

---

## 3. Scoring logic

- **Score:** +1 per correct answer. No penalties for incorrect answers.
- **Streak:** Consecutive correct count. Resets to 0 on incorrect. Displayed in UI when ≥ 2.
- **Accuracy:** `correct / totalRounds`, shown as percentage on completion.
- **Mastery (per term):**
  - Correct answer → `+0.15` (capped at `1.0`)
  - Incorrect answer → `-0.10` (floored at `0.0`)
  - If the student selects the wrong term, BOTH the correct term AND the selected term get `-0.10` (the student confused them, so both need reinforcement).
- **No gambling mechanics** (constraint #11): No loot boxes, no random rewards, no currency. Mastery is purely a function of correctness.

---

## 4. Audio behavior

All learner-facing text has audio support (constraint #2).

| Element | How to hear it | Method |
|---|---|---|
| Sentence structure label | Tap the text | TTS (Web Speech API) |
| Prompt sentence (with blank) | Tap the text **or** tap 🔊 button | TTS speaks the full sentence (without blank) |
| Hint (definition) | Tap the text | TTS |
| Each option button | Tap 🔊 on the right | TTS speaks just the term |
| Feedback (correct/incorrect) | Auto-spoken on answer | TTS speaks full correct sentence |
| Completion screen | Tap any text | TTS |
| Completion score | Tap the score | TTS reads "X out of Y correct" |

**Constraint #4 compliance:** The prompt text is also an action target (tapping an option submits an answer). Therefore the prompt has a **separate 🔊 listen button** so students can hear the sentence without accidentally selecting an answer.

**Audio URL support:** If `term.audioUrl` or `sentenceStructure.audioUrl` is provided, those files are played instead of TTS. In the prototype sample data, all `audioUrl` fields are `null`, so TTS is used everywhere.

**Mute:** Call `game.audio.setMuted(true)` to mute all audio.

---

## 5. Mobile layout assumptions

- **Target devices:** iPhone SE (375px) to iPad Pro (1024px)
- **Container:** `max-width: 480px`, centered, `padding: 16px`
- **Tap targets:** All buttons are `min-height: 48px` (exceeds 44px iOS minimum)
- **Font sizes:** Body 16px, prompt 18px, title 24px (no tiny text)
- **No horizontal scroll:** All content fits within 480px
- **No hover-dependent UI:** All interactions work via tap
- **Viewport meta:** `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no` (prevents accidental zoom on double-tap)
- **Touch-friendly:** `-webkit-tap-highlight-color` set, `touch-action: manipulation` implied by button elements

**Tested layout breakpoints:**
- 375px (iPhone SE): Single column, full-width buttons
- 480px (iPhone 12+): Single column, slight padding increase
- 768px+ (iPad): Centered card, max-width 480px, gray background fills remaining space

---

## 6. Known limitations

1. **No persistence:** Mastery scores reset when the page reloads. A future integration should persist to the Living Textbook backend.
2. **No timed mode:** `timePerRoundSec` is in the config but not yet implemented (would require a countdown timer UI).
3. **TTS voice quality:** Depends on the browser/OS. On Chrome desktop, Google US English is used. On Safari, Samantha. On mobile, system default.
4. **No image support:** Only emoji + text. A future integration should support `imageUrl` on terms for richer visual cues.
5. **No keyboard navigation:** Prototype is touch/click only. Accessibility (tab-index, screen reader labels) would be added in a production version.
6. **No progress persistence between rounds:** If the page reloads mid-game, the game restarts from round 1.
7. **Sentence structures alternate deterministically:** Round 0 uses structure 0, round 1 uses structure 1, round 2 uses structure 0, etc. No randomization.

---

## 7. Integration notes for future LivingTextbook migration

### Embedding in the Living Textbook app

The prototype is a standalone HTML file. To embed it in the Living Textbook React app:

```tsx
// In a React component:
import { useEffect, useRef } from 'react';

export function VocabTapMatchGame({ data, onEvent }: { data: GameInput; onEvent: (e: GameEvent) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<any>(null);

  useEffect(() => {
    // Load the framework + game script dynamically
    const script = document.createElement('script');
    script.src = '/prototypes/01-vocab-tap-match/game.js';
    script.onload = () => {
      if (containerRef.current) {
        gameRef.current = new window.VocabTapMatch(containerRef.current, data, { onEvent });
        gameRef.current.start();
      }
    };
    document.body.appendChild(script);
    return () => { if (gameRef.current) gameRef.current.destroy?.(); };
  }, [data, onEvent]);

  return <div ref={containerRef} />;
}
```

### Tenant isolation

The prototype accepts a `tenant` object in the input. The game does NOT hard-code any tenant identity (constraint #1). The `tenantId` is passed through to every emitted event so the host app can route telemetry correctly.

### Data source

In production, the `terms` and `sentenceStructures` arrays would come from the Living Textbook's content API, filtered by:
- Tenant ID
- Unit / lesson
- Student's current mastery level (adaptive)

### Event routing

All 6 events should be forwarded to the Living Textbook's xAPI telemetry endpoint:

```ts
// Host app event handler
function handleGameEvent(event: GameEvent) {
  // Convert to xAPI statement
  const xapiStatement = convertToXapi(event);
  await fetch('/api/telemetry', { method: 'POST', body: JSON.stringify(xapiStatement) });
}
```

### Mastery persistence

The prototype tracks mastery in-memory. In production:
- On `mastery_updated`: PATCH `/api/terms/{termId}/mastery` with the new value
- On `game_completed`: POST `/api/game-sessions` with the full event log

### Audio files

If `term.audioUrl` is provided, the game plays that URL instead of TTS. In production:
- Audio files should be served from a CDN with proper caching headers
- Pre-loading: the host app should preload audio for all terms in the current unit before the game starts
- Fallback: if an audio URL fails to load, the game falls back to TTS automatically

### Theme / branding

The prototype uses a neutral gray/blue theme. In the Living Textbook integration:
- Replace the hardcoded colors in `prototype-framework.js` (`UI.applyBaseStyles`) with CSS variables from the tenant's `ThemeConfig`
- The prototype does NOT hard-code any brand identity — it's a blank slate for any tenant

### Multi-tenant safety

The prototype is safe for multi-tenant use:
- No tenant ID is hard-coded
- All tenant context comes from the input JSON
- Event payloads include `tenantId` for downstream routing
- No localStorage / sessionStorage usage (no cross-tenant data leakage risk)
