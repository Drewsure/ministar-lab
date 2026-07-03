// sample-data.js — loaded via <script> tag for the standalone prototype.
// In a real Living Textbook integration, this data is passed as a JSON object
// to the game constructor instead.
//
// Schema: unit_meta + pedagogical_payload + audio_cues
// This is the "Sentence Builder" schema (Prototype 02+), distinct from
// Prototype 01's tenant/terms/sentenceStructures schema.
window.SAMPLE_DATA = {
  "unit_meta": {
    "tenant_id": "sample",
    "level": 1,
    "theme": "Greetings",
    "game_mode": "sentence-builder",
    "engine_id": "text-spelling"
  },
  "pedagogical_payload": {
    "vocabulary_terms": [
      "hello",
      "goodbye",
      "teacher",
      "friend",
      "morning",
      "afternoon",
      "please",
      "thank you"
    ],
    "target_sentences": [
      "Hello, teacher.",
      "Thank you, friend."
    ]
  },
  "audio_cues": [
    { "kind": "term", "text": "hello", "language": "en" },
    { "kind": "term", "text": "goodbye", "language": "en" },
    { "kind": "term", "text": "teacher", "language": "en" },
    { "kind": "term", "text": "friend", "language": "en" },
    { "kind": "term", "text": "morning", "language": "en" },
    { "kind": "term", "text": "afternoon", "language": "en" },
    { "kind": "term", "text": "please", "language": "en" },
    { "kind": "term", "text": "thank you", "language": "en" },
    { "kind": "sentence", "text": "Hello, teacher.", "language": "en" },
    { "kind": "sentence", "text": "Thank you, friend.", "language": "en" },
    { "kind": "instruction", "text": "Tap the words in order.", "language": "en" },
    { "kind": "instruction", "text": "Build the sentence: Hello, teacher.", "language": "en" },
    { "kind": "instruction", "text": "Build the sentence: Thank you, friend.", "language": "en" }
  ]
};
