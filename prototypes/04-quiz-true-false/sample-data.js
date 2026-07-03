// sample-data.js — loaded via <script> tag for the standalone prototype.
// In a real Living Textbook integration, this data is passed as a JSON object
// to the game constructor instead.
//
// Schema: unit_meta + pedagogical_payload + audio_cues (Schema B)
//
// For Quiz / True-False, the game generates questions from the vocab + sentences.
// The host app can also provide an explicit "questions" array to override
// generation (see questions.js for the generator).
window.SAMPLE_DATA = {
  "unit_meta": {
    "tenant_id": "sample",
    "level": 1,
    "theme": "Animals",
    "game_mode": "quiz-true-false",
    "engine_id": "selection"
  },
  "pedagogical_payload": {
    "vocabulary_terms": [
      "cat",
      "dog",
      "bird",
      "fish",
      "rabbit",
      "mouse",
      "horse",
      "cow",
      "duck",
      "frog"
    ],
    "target_sentences": [
      "A cat says meow.",
      "A dog says woof."
    ]
  },
  "audio_cues": [
    { "kind": "term", "text": "cat", "language": "en" },
    { "kind": "term", "text": "dog", "language": "en" },
    { "kind": "term", "text": "bird", "language": "en" },
    { "kind": "term", "text": "fish", "language": "en" },
    { "kind": "term", "text": "rabbit", "language": "en" },
    { "kind": "term", "text": "mouse", "language": "en" },
    { "kind": "term", "text": "horse", "language": "en" },
    { "kind": "term", "text": "cow", "language": "en" },
    { "kind": "term", "text": "duck", "language": "en" },
    { "kind": "term", "text": "frog", "language": "en" },
    { "kind": "sentence", "text": "A cat says meow.", "language": "en" },
    { "kind": "sentence", "text": "A dog says woof.", "language": "en" },
    { "kind": "instruction", "text": "Choose a mode to begin.", "language": "en" },
    { "kind": "instruction", "text": "Multiple Choice. Tap the correct answer.", "language": "en" },
    { "kind": "instruction", "text": "True or False. Tap True or False.", "language": "en" },
    { "kind": "instruction", "text": "Read each question. Tap to hear it. Then choose your answer.", "language": "en" },
    { "kind": "instruction", "text": "Not quite. Try again.", "language": "en" },
    { "kind": "feedback", "text": "That is right.", "language": "en" },
    { "kind": "feedback", "text": "Not quite. Try again.", "language": "en" }
  ]
};
