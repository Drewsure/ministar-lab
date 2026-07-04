// sample-data.js — Story Adventure (Life is Strange / Stardew Valley inspired)
// Schema B with branching narrative + vocabulary integration
window.SAMPLE_DATA = {
  "unit_meta": {
    "tenant_id": "sample",
    "level": 1,
    "theme": "School Life",
    "game_mode": "story-adventure",
    "engine_id": "narrative"
  },
  "pedagogical_payload": {
    "vocabulary_terms": [
      "morning", "breakfast", "classroom", "teacher", "homework",
      "friend", "lunch", "library", "weekend", "favorite"
    ],
    "target_sentences": [
      "Every morning I eat breakfast before school.",
      "My favorite class is in the classroom with my teacher."
    ],
    "story_chapters": [
      {
        "id": "ch1",
        "title": "A New Morning",
        "narrative": "You wake up to the sound of your alarm. It is {term}. The sun is shining through your window. You need to get ready for school. What do you do first?",
        "choices": [
          { "text": "Eat {term} in the kitchen", "vocab": "breakfast", "next": "ch2a", "consequence": "You feel energized and ready to learn!" },
          { "text": "Rush to the {term} without eating", "vocab": "classroom", "next": "ch2b", "consequence": "Your stomach growls during class. Maybe you should have eaten!" }
        ]
      },
      {
        "id": "ch2a",
        "title": "The Classroom",
        "narrative": "You arrive at the {term} early. Your {term} greets you with a smile. Today's lesson is about friendship and kindness. The teacher asks you to work with a partner.",
        "choices": [
          { "text": "Work with your best {term}", "vocab": "friend", "next": "ch3", "consequence": "You and your friend complete the assignment perfectly!" },
          { "text": "Work alone in the {term}", "vocab": "library", "next": "ch3", "consequence": "You finish the assignment, but it was more fun with a partner." }
        ]
      },
      {
        "id": "ch2b",
        "title": "Hungry Morning",
        "narrative": "Your stomach is growling. You forgot to eat {term}! During {term} break, your friend offers to share their food. What do you say?",
        "choices": [
          { "text": "Thank you, you are a good {term}!", "vocab": "friend", "next": "ch3", "consequence": "Your friend smiles. You feel grateful." },
          { "text": "No thank you, I will wait for {term}", "vocab": "lunch", "next": "ch3", "consequence": "You wait patiently, but you are very hungry." }
        ]
      },
      {
        "id": "ch3",
        "title": "The End of the Day",
        "narrative": "The school day is over. You have {term} to do tonight. Your {term} asks what you want to do this {term}. What is your answer?",
        "choices": [
          { "text": "I want to finish my {term} first", "vocab": "homework", "next": "ending_good", "consequence": "Responsible choice! You enjoy your weekend stress-free." },
          { "text": "I want to go to the {term} to read", "vocab": "library", "next": "ending_good", "consequence": "You love reading! Knowledge is power." },
          { "text": "My {term} activity is playing outside", "vocab": "favorite", "next": "ending_good", "consequence": "Fresh air and exercise! Great choice." }
        ]
      },
      {
        "id": "ending_good",
        "title": "A Good Day",
        "narrative": "You had a wonderful day at school. You learned new words, made good choices, and spent time with friends. Every {term} is a new adventure! What was your {term} part of today?",
        "choices": [
          { "text": "My {term} part was learning new words", "vocab": "favorite", "next": "END", "consequence": "You earned the Word Explorer badge!" },
          { "text": "My {term} part was spending time with my {term}", "vocab": "friend", "next": "END", "consequence": "You earned the Friendship badge!" }
        ]
      }
    ]
  },
  "audio_cues": [
    { "kind": "term", "text": "morning", "language": "en" },
    { "kind": "term", "text": "breakfast", "language": "en" },
    { "kind": "term", "text": "classroom", "language": "en" },
    { "kind": "term", "text": "teacher", "language": "en" },
    { "kind": "term", "text": "homework", "language": "en" },
    { "kind": "term", "text": "friend", "language": "en" },
    { "kind": "term", "text": "lunch", "language": "en" },
    { "kind": "term", "text": "library", "language": "en" },
    { "kind": "term", "text": "weekend", "language": "en" },
    { "kind": "term", "text": "favorite", "language": "en" },
    { "kind": "instruction", "text": "Read the story. Choose what happens next. Tap any word to hear it!", "language": "en" },
    { "kind": "feedback", "text": "Great choice!", "language": "en" }
  ]
};
