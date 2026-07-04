// sample-data.js — Farm Builder (Stardew Valley inspired vocabulary)
window.SAMPLE_DATA = {
  "unit_meta": {
    "tenant_id": "sample",
    "level": 1,
    "theme": "Farm Life",
    "game_mode": "farm-builder",
    "engine_id": "simulation"
  },
  "pedagogical_payload": {
    "vocabulary_terms": [
      "seed", "water", "sun", "soil", "harvest",
      "market", "season", "grow", "flower", "fruit"
    ],
    "target_sentences": [
      "Plant the seed in the soil and water it every day.",
      "When the sun shines, the flower will grow into a fruit."
    ],
    "farm_tasks": [
      { "id": "task1", "instruction": "Tap the {term} to plant it in the soil", "vocab": "seed", "emoji": "🌱", "next": "task2" },
      { "id": "task2", "instruction": "Tap to {term} the seed so it can grow", "vocab": "water", "emoji": "💧", "next": "task3" },
      { "id": "task3", "instruction": "Wait for the {term} to shine on your plant", "vocab": "sun", "emoji": "☀️", "next": "task4" },
      { "id": "task4", "instruction": "Your plant is growing in the {term}!", "vocab": "soil", "emoji": "🪴", "next": "task5" },
      { "id": "task5", "instruction": "The plant has a {term}! Tap to see it bloom", "vocab": "flower", "emoji": "🌸", "next": "task6" },
      { "id": "task6", "instruction": "Now you have a {term}! Time to harvest", "vocab": "fruit", "emoji": "🍎", "next": "task7" },
      { "id": "task7", "instruction": "Tap to {term} your fruit", "vocab": "harvest", "emoji": "🧺", "next": "task8" },
      { "id": "task8", "instruction": "Sell your fruit at the {term}", "vocab": "market", "emoji": "🏪", "next": "task9" },
      { "id": "task9", "instruction": "What {term} is it now? Tap to find out", "vocab": "season", "emoji": "🍂", "next": "task10" },
      { "id": "task10", "instruction": "Watch your farm {term} and prosper!", "vocab": "grow", "emoji": "🌾", "next": "END" }
    ]
  },
  "audio_cues": [
    { "kind": "term", "text": "seed", "language": "en" },
    { "kind": "term", "text": "water", "language": "en" },
    { "kind": "term", "text": "sun", "language": "en" },
    { "kind": "term", "text": "soil", "language": "en" },
    { "kind": "term", "text": "harvest", "language": "en" },
    { "kind": "term", "text": "market", "language": "en" },
    { "kind": "term", "text": "season", "language": "en" },
    { "kind": "term", "text": "grow", "language": "en" },
    { "kind": "term", "text": "flower", "language": "en" },
    { "kind": "term", "text": "fruit", "language": "en" },
    { "kind": "instruction", "text": "Welcome to your farm! Complete each task to grow your vocabulary!", "language": "en" }
  ]
};
