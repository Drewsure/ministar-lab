// Tower Defense — vocabulary words are towers, enemies carry wrong definitions
window.SAMPLE_DATA = {
  "unit_meta": { "tenant_id": "sample", "level": 1, "theme": "Castle Defense", "game_mode": "tower-defense", "engine_id": "strategy" },
  "pedagogical_payload": {
    "vocabulary_terms": ["wall", "archer", "knight", "mage", "dragon", "shield", "sword", "potion", "castle", "tower"],
    "target_sentences": ["The knight defends the castle with a shield and sword.", "The mage drinks a potion to cast spells from the tower."],
    "waves": [
      { "enemies": ["wrong word 1", "wrong word 2", "wrong word 3"], "speed": 1, "count": 3 },
      { "enemies": ["wrong word 1", "wrong word 2", "wrong word 3", "wrong word 4"], "speed": 1.3, "count": 4 },
      { "enemies": ["wrong word 1", "wrong word 2", "wrong word 3", "wrong word 4", "wrong word 5"], "speed": 1.6, "count": 5 }
    ]
  },
  "audio_cues": [
    { "kind": "term", "text": "wall", "language": "en" }, { "kind": "term", "text": "archer", "language": "en" },
    { "kind": "term", "text": "knight", "language": "en" }, { "kind": "term", "text": "mage", "language": "en" },
    { "kind": "term", "text": "dragon", "language": "en" }, { "kind": "term", "text": "shield", "language": "en" },
    { "kind": "term", "text": "sword", "language": "en" }, { "kind": "term", "text": "potion", "language": "en" },
    { "kind": "term", "text": "castle", "language": "en" }, { "kind": "term", "text": "tower", "language": "en" },
    { "kind": "instruction", "text": "Defend your castle! Tap the correct word to shoot enemies before they reach your wall!", "language": "en" }
  ]
};
