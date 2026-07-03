# Living Textbook — Prototype Game Modules

This directory contains **isolated prototype game modules** for the future Living Textbook platform. Each prototype is a self-contained, standalone HTML/JS/CSS package with no build step and no dependencies on the main application.

## Hard constraints (all prototypes must satisfy)

1. Do not hard-code any tenant identity
2. All learner-facing text must have audio support
3. Prefer tap/click text to hear it
4. If text is also an action button, add a separate listen/replay control
5. Games must accept JSON-style input data
6. Games must emit standard event objects (`game_started`, `round_shown`, `answer_submitted`, `answer_result`, `game_completed`, `mastery_updated`)
7. Games must support 8-12 vocabulary terms
8. Games must support exactly 2 target sentence structures
9. Mobile layout must work first
10. No premium visual polish before clean layout and component structure
11. Do not introduce gambling-like reward mechanics
12. Do not import public code/assets unless license, source URL, and commercial-use status are documented

## Directory structure

```
prototypes/
├── README.md                          ← this file
├── _shared/
│   ├── prototype-framework.js         ← shared event emitter + audio + input validation
│   └── sample-data.json               ← example input (10 fruit terms, 2 sentence structures)
└── 01-vocab-tap-match/
    ├── README.md                      ← game-specific docs (7 required sections)
    ├── index.html                     ← standalone entry point (open in browser)
    ├── game.js                        ← game logic
    └── sample-data.js                 ← sample data as a JS file for standalone testing
```

## Running a prototype

No build step. Just serve the directory and open the HTML file:

```bash
cd prototypes/01-vocab-tap-match
python3 -m http.server 8080
# Visit http://localhost:8080/
```

Or open `index.html` directly in a browser (TTS requires a user gesture first).

## Shared framework (`_shared/prototype-framework.js`)

All prototypes use this shared framework. It provides:

| Class | Purpose |
|---|---|
| `LTB.EventLogger` | Emits the 6 standard events with timestamps + session token |
| `LTB.AudioBus` | TTS (Web Speech API) + optional audio URL playback |
| `LTB.InputValidator` | Validates JSON input shape (8-12 terms, 2 structures, required fields) |
| `LTB.MasteryTracker` | Per-term mastery tracking (0.0-1.0), emits `mastery_updated` events |
| `LTB.UI` | Mobile-first CSS helpers, `makeSpeakable()`, `makeListenButton()`, `shuffle()` |

## Standard event contract

All prototypes emit these 6 events via the `onEvent` callback:

1. **`game_started`** — emitted once when the game begins
2. **`round_shown`** — emitted at the start of each round
3. **`answer_submitted`** — emitted when the student submits an answer
4. **`answer_result`** — emitted immediately after `answer_submitted` with correctness
5. **`game_completed`** — emitted once when all rounds are done
6. **`mastery_updated`** — emitted whenever a term's mastery score changes

See `_shared/prototype-framework.js` for the exact event payload shapes.

## Prototypes index

| # | Name | Mechanic | Schema | Status |
|---|---|---|---|---|
| 01 | Vocab Tap Match | Multiple choice — tap the word that completes the sentence | `tenant` + `terms[]` + `sentenceStructures[]` | ✅ Playable |
| 02 | Sentence Builder | Drag/tap word tiles into order to build the target sentence | `unit_meta` + `pedagogical_payload` + `audio_cues` | ✅ Playable |
| 03 | _(next)_ | | | ⏳ Planned |

## Input schemas

The prototypes support two input schemas (the shared framework validates both):

### Schema A (Prototype 01)
```jsonc
{
  "tenant": { "id": "...", "displayName": "..." },
  "terms": [ { "id": "...", "term": "...", "definition": "..." } ],  // 8-12
  "sentenceStructures": [ { "id": "...", "template": "I like {term}." } ],  // exactly 2
  "config": { "roundsPerGame": 8 }
}
```
Validated by: `LTB.InputValidator.validate(data)`

### Schema B (Prototype 02+)
```jsonc
{
  "unit_meta": { "tenant_id": "...", "level": 1, "game_mode": "sentence-builder" },
  "pedagogical_payload": {
    "vocabulary_terms": ["hello", "goodbye", ...],  // 8-12 strings
    "target_sentences": ["Hello, teacher.", "Thank you, friend."]  // exactly 2
  },
  "audio_cues": [ { "kind": "term", "text": "hello", "language": "en" } ]
}
```
Validated by: `LTB.InputValidator.validateSentenceBuilder(data)`

## Integration into Living Textbook

Each prototype's README has an **"Integration notes"** section explaining how to embed it in the future Living Textbook React app. The prototypes are designed to be embeddable as isolated modules without modifying the host app's architecture, auth, deployment, database, or tenant model.
