/**
 * Question Generator for Quiz / True-False Prototype
 * ====================================================
 *
 * Derives quiz questions from the pedagogical_payload (vocab + target sentences).
 * The host app can override this by providing an explicit "questions" array
 * in the input JSON (see sample-data.js for the schema without it).
 *
 * QUESTION TYPES GENERATED:
 *   1. multiple-choice: "Which word is: [definition]?" with 4 options
 *      (For this prototype, "definition" is derived from the target sentences
 *      — e.g., "A cat says meow." → question: "Which animal says meow?")
 *   2. true-false: "True or False: [statement]" where the statement is a
 *      target sentence (sometimes correct, sometimes with a swapped word)
 *
 * DETERMINISTIC (constraint #11):
 *   Questions are generated deterministically from the payload — no random
 *   shuffling of question ORDER. Choice order IS shuffled (doesn't affect
 *   scoring). True/False statement correctness is deterministic (first
 *   half true, second half false).
 */

/**
 * Generate quiz questions from the payload.
 * @param {object} payload - pedagogical_payload from input JSON
 * @param {string} mode - "multiple-choice" | "true-false" | "mixed"
 * @returns {Question[]}
 */
function generateQuestions(payload, mode) {
  var vocab = payload.vocabulary_terms;
  var sentences = payload.target_sentences;
  var questions = [];

  if (mode === 'multiple-choice' || mode === 'mixed') {
    // Generate one MC question per target sentence
    // "A cat says meow." → "Which animal says meow?" → answer: "cat"
    sentences.forEach(function (sentence, i) {
      var parsed = parseSentenceForMC(sentence, vocab);
      if (parsed) {
        questions.push({
          id: 'mc-' + i,
          type: 'multiple-choice',
          prompt: parsed.prompt,
          answer: parsed.answer,
          choices: parsed.choices,
          sourceSentence: sentence,
        });
      }
    });
  }

  if (mode === 'true-false' || mode === 'mixed') {
    // Generate TF questions: half true (correct sentence), half false (swapped word)
    sentences.forEach(function (sentence, i) {
      // True version
      questions.push({
        id: 'tf-true-' + i,
        type: 'true-false',
        prompt: 'True or False: ' + sentence,
        statement: sentence,
        answer: true, // this statement is true
        sourceSentence: sentence,
      });
      // False version — swap a word with a different vocab word
      var falseStatement = makeFalseStatement(sentence, vocab);
      if (falseStatement) {
        questions.push({
          id: 'tf-false-' + i,
          type: 'true-false',
          prompt: 'True or False: ' + falseStatement,
          statement: falseStatement,
          answer: false, // this statement is false
          sourceSentence: sentence,
        });
      }
    });
  }

  return questions;
}

/**
 * Parse a sentence like "A cat says meow." into a multiple-choice question.
 * Extracts the subject (cat) and creates: "Which animal says meow?" → answer: cat
 * Falls back to: "Which word is in this sentence: [sentence]?" if parsing fails.
 */
function parseSentenceForMC(sentence, vocab) {
  // Try to find a vocab word in the sentence (the subject)
  var lowerSentence = sentence.toLowerCase();
  var subject = null;
  for (var i = 0; i < vocab.length; i++) {
    var word = vocab[i].toLowerCase();
    if (lowerSentence.indexOf(word) !== -1) {
      subject = vocab[i]; // preserve original casing from vocab
      break;
    }
  }

  if (!subject) {
    // Fallback: "Which word is in this sentence?"
    return {
      prompt: 'Which word is in this sentence: "' + sentence + '"',
      answer: vocab[0],
      choices: buildChoices(vocab[0], vocab),
    };
  }

  // Extract the predicate (everything after the subject)
  var subjectIdx = lowerSentence.indexOf(subject.toLowerCase());
  var predicate = sentence.slice(subjectIdx + subject.length).replace(/^\s+/, '').replace(/[.\s]+$/, '');

  // Build a prompt like "Which animal says meow?"
  // Use "word" as a generic noun to avoid hard-coding "animal" (which assumes the theme)
  var prompt = 'Which word goes with: "' + predicate + '"?';

  return {
    prompt: prompt,
    answer: subject,
    choices: buildChoices(subject, vocab),
  };
}

/**
 * Build 4 choices: 1 correct + 3 distractors (deterministic — first 3
 * vocab words that aren't the answer). Then shuffle (shuffling choice
 * order doesn't make scoring non-deterministic).
 */
function buildChoices(answer, vocab) {
  var distractors = vocab.filter(function (v) {
    return v.toLowerCase() !== answer.toLowerCase();
  }).slice(0, 3);
  var choices = [answer].concat(distractors);
  return shuffle(choices);
}

/**
 * Create a false version of a sentence by swapping the subject with a
 * different vocab word.
 * "A cat says meow." → "A dog says meow." (false)
 */
function makeFalseStatement(sentence, vocab) {
  var lowerSentence = sentence.toLowerCase();
  var subject = null;
  var subjectIdx = -1;
  for (var i = 0; i < vocab.length; i++) {
    var word = vocab[i].toLowerCase();
    var idx = lowerSentence.indexOf(word);
    if (idx !== -1) {
      subject = vocab[i];
      subjectIdx = idx;
      break;
    }
  }
  if (!subject) return null;

  // Find a different vocab word to swap in
  var swapWord = null;
  for (var j = 0; j < vocab.length; j++) {
    if (vocab[j].toLowerCase() !== subject.toLowerCase()) {
      swapWord = vocab[j];
      break;
    }
  }
  if (!swapWord) return null;

  // Preserve the article/casing pattern
  var before = sentence.slice(0, subjectIdx);
  var after = sentence.slice(subjectIdx + subject.length);
  return before + swapWord + after;
}

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

// Expose globally
window.QuizQuestionGenerator = {
  generate: generateQuestions,
};
