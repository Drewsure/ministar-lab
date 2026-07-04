// sample-data.js — Schema B (migrated from Schema A for consistency with Prototypes 02-04)
// Uses unit_meta + pedagogical_payload + audio_cues structure.
window.SAMPLE_DATA = {
  "unit_meta": {
    "tenant_id": "demo-tenant",
    "level": 1,
    "theme": "Fruits",
    "game_mode": "vocab-tap-match",
    "engine_id": "selection"
  },
  "pedagogical_payload": {
    "vocabulary_terms": [
      "apple", "banana", "cherry", "grape", "lemon",
      "mango", "orange", "peach", "pear", "strawberry"
    ],
    "term_definitions": {
      "apple": "a round red or green fruit",
      "banana": "a long yellow fruit",
      "cherry": "a small round red fruit with a stone inside",
      "grape": "a small sweet fruit that grows in bunches",
      "lemon": "a yellow citrus fruit with a sour taste",
      "mango": "a tropical orange fruit with a sweet taste",
      "orange": "a round citrus fruit with a sweet taste",
      "peach": "a soft round fruit with fuzzy skin",
      "pear": "a sweet fruit shaped like a bell",
      "strawberry": "a small red fruit with seeds on the outside"
    },
    "target_sentences": [
      "I like apple.",
      "I see a apple on the table."
    ]
  },
  "audio_cues": [
    { "kind": "term", "text": "apple", "language": "en" },
    { "kind": "term", "text": "banana", "language": "en" },
    { "kind": "term", "text": "cherry", "language": "en" },
    { "kind": "term", "text": "grape", "language": "en" },
    { "kind": "term", "text": "lemon", "language": "en" },
    { "kind": "term", "text": "mango", "language": "en" },
    { "kind": "term", "text": "orange", "language": "en" },
    { "kind": "term", "text": "peach", "language": "en" },
    { "kind": "term", "text": "pear", "language": "en" },
    { "kind": "term", "text": "strawberry", "language": "en" },
    { "kind": "sentence", "text": "I like apple.", "language": "en" },
    { "kind": "sentence", "text": "I see a apple on the table.", "language": "en" },
    { "kind": "instruction", "text": "Choose the word that completes the sentence.", "language": "en" }
  ]
};
