// Farm Life — Stardew Valley-inspired ESL Reward Game (Prototype #11)
// UNLOCKED when student completes a unit. Play for a limited time as a reward.
window.SAMPLE_DATA = {
  "unit_meta": { "tenant_id": "sample", "level": 1, "theme": "Farm Life", "game_mode": "farm-life", "engine_id": "simulation" },
  "pedagogical_payload": {
    "vocabulary_terms": ["seed", "water", "sun", "soil", "harvest", "market", "season", "grow", "flower", "fruit"],
    "target_sentences": ["Plant the seed in the soil and water it every day.", "When the sun shines the flower will grow into a fruit."],
    "farm_grid_size": 4,
    "crops": [
      { "name": "Carrot", "emoji": "🥕", "growTime": 3, "sellPrice": 10, "vocab": "harvest" },
      { "name": "Tomato", "emoji": "🍅", "growTime": 4, "sellPrice": 15, "vocab": "fruit" },
      { "name": "Sunflower", "emoji": "🌻", "growTime": 5, "sellPrice": 20, "vocab": "flower" },
      { "name": "Corn", "emoji": "🌽", "growTime": 4, "sellPrice": 12, "vocab": "grow" },
      { "name": "Pumpkin", "emoji": "🎃", "growTime": 6, "sellPrice": 25, "vocab": "season" }
    ],
    "tools": [
      { "name": "Seed", "emoji": "🌱", "action": "plant", "vocab": "seed" },
      { "name": "Water", "emoji": "💧", "action": "water", "vocab": "water" },
      { "name": "Sun", "emoji": "☀️", "action": "sun", "vocab": "sun" },
      { "name": "Soil", "emoji": "🪴", "action": "soil", "vocab": "soil" },
      { "name": "Harvest", "emoji": "🧺", "action": "harvest", "vocab": "harvest" },
      { "name": "Market", "emoji": "🏪", "action": "sell", "vocab": "market" }
    ]
  },
  "audio_cues": [
    { "kind": "term", "text": "seed", "language": "en" }, { "kind": "term", "text": "water", "language": "en" },
    { "kind": "term", "text": "sun", "language": "en" }, { "kind": "term", "text": "soil", "language": "en" },
    { "kind": "term", "text": "harvest", "language": "en" }, { "kind": "term", "text": "market", "language": "en" },
    { "kind": "term", "text": "season", "language": "en" }, { "kind": "term", "text": "grow", "language": "en" },
    { "kind": "term", "text": "flower", "language": "en" }, { "kind": "term", "text": "fruit", "language": "en" },
    { "kind": "instruction", "text": "Welcome to your farm! Plant seeds, water them, give them sun, and harvest crops to sell at the market!", "language": "en" }
  ]
};
