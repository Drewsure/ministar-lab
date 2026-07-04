// sample-data.js — Monster Fighter (turn-based RPG vocabulary battle)
window.SAMPLE_DATA = {
  "unit_meta": {
    "tenant_id": "sample",
    "level": 1,
    "theme": "Monster Battle",
    "game_mode": "monster-fighter",
    "engine_id": "rpg"
  },
  "pedagogical_payload": {
    "vocabulary_terms": [
      "fire", "water", "earth", "wind", "light",
      "shadow", "crystal", "thunder", "frost", "dragon"
    ],
    "target_sentences": [
      "The dragon breathes fire and thunder.",
      "A crystal of frost and shadow glows in the earth."
    ],
    "monsters": [
      { "name": "Slime", "emoji": "🟢", "hp": 3, "weakness": "fire", "vocab_reward": "fire" },
      { "name": "Bat", "emoji": "🦇", "hp": 3, "weakness": "light", "vocab_reward": "light" },
      { "name": "Golem", "emoji": "🪨", "hp": 4, "weakness": "water", "vocab_reward": "earth" },
      { "name": "Ghost", "emoji": "👻", "hp": 3, "weakness": "light", "vocab_reward": "shadow" },
      { "name": "Wolf", "emoji": "🐺", "hp": 4, "weakness": "frost", "vocab_reward": "wind" },
      { "name": "Dragon", "emoji": "🐉", "hp": 6, "weakness": "thunder", "vocab_reward": "dragon" }
    ],
    "spells": [
      { "name": "Fire Ball", "emoji": "🔥", "element": "fire", "power": 2 },
      { "name": "Water Wave", "emoji": "🌊", "element": "water", "power": 2 },
      { "name": "Earth Quake", "emoji": "🌍", "element": "earth", "power": 2 },
      { "name": "Wind Slash", "emoji": "🌪️", "element": "wind", "power": 2 },
      { "name": "Light Beam", "emoji": "✨", "element": "light", "power": 3 },
      { "name": "Shadow Strike", "emoji": "🌑", "element": "shadow", "power": 2 },
      { "name": "Crystal Shard", "emoji": "💎", "element": "crystal", "power": 2 },
      { "name": "Thunder Bolt", "emoji": "⚡", "element": "thunder", "power": 3 },
      { "name": "Frost Bite", "emoji": "❄️", "element": "frost", "power": 2 }
    ]
  },
  "audio_cues": [
    { "kind": "term", "text": "fire", "language": "en" },
    { "kind": "term", "text": "water", "language": "en" },
    { "kind": "term", "text": "earth", "language": "en" },
    { "kind": "term", "text": "wind", "language": "en" },
    { "kind": "term", "text": "light", "language": "en" },
    { "kind": "term", "text": "shadow", "language": "en" },
    { "kind": "term", "text": "crystal", "language": "en" },
    { "kind": "term", "text": "thunder", "language": "en" },
    { "kind": "term", "text": "frost", "language": "en" },
    { "kind": "term", "text": "dragon", "language": "en" },
    { "kind": "instruction", "text": "Choose a spell to attack the monster! Match the weakness for double damage!", "language": "en" },
    { "kind": "feedback", "text": "Super effective! Double damage!", "language": "en" },
    { "kind": "feedback", "text": "Not very effective. Try a different spell!", "language": "en" }
  ]
};
