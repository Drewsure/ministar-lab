// sample-data.js — loaded via <script> tag for the standalone prototype.
// In a real Living Textbook integration, this data is passed as a JSON object
// to the game constructor instead.
//
// Schema: unit_meta + pedagogical_payload + audio_cues (Schema B, same as Prototype 02)
//
// For Fill in the Blank, each target_sentence must contain ONE {blank} placeholder
// marking the missing word. The correct answer is the word that replaces {blank}.
window.SAMPLE_DATA = {
  "unit_meta": {
    "tenant_id": "sample",
    "level": 1,
    "theme": "Classroom",
    "game_mode": "fill-in-the-blank",
    "engine_id": "text-spelling"
  },
  "pedagogical_payload": {
    "vocabulary_terms": [
      "book",
      "pencil",
      "teacher",
      "student",
      "desk",
      "chair",
      "read",
      "write",
      "listen",
      "speak"
    ],
    "target_sentences": [
      "I {blank} a story every night.",
      "The {blank} writes on the whiteboard."
    ],
    "answers": ["read", "teacher"]
  },
  "audio_cues": [
    { "kind": "term", "text": "book", "language": "en" },
    { "kind": "term", "text": "pencil", "language": "en" },
    { "kind": "term", "text": "teacher", "language": "en" },
    { "kind": "term", "text": "student", "language": "en" },
    { "kind": "term", "text": "desk", "language": "en" },
    { "kind": "term", "text": "chair", "language": "en" },
    { "kind": "term", "text": "read", "language": "en" },
    { "kind": "term", "text": "write", "language": "en" },
    { "kind": "term", "text": "listen", "language": "en" },
    { "kind": "term", "text": "speak", "language": "en" },
    { "kind": "sentence", "text": "I read a story every night.", "language": "en" },
    { "kind": "sentence", "text": "The teacher writes on the whiteboard.", "language": "en" },
    { "kind": "instruction", "text": "Choose the word that fits.", "language": "en" },
    { "kind": "instruction", "text": "Try again. You can do it.", "language": "en" },
    { "kind": "instruction", "text": "Good work. Let us try the next one.", "language": "en" },
    { "kind": "feedback", "text": "That fits.", "language": "en" },
    { "kind": "feedback", "text": "Not quite. Try again.", "language": "en" }
  ]
};
