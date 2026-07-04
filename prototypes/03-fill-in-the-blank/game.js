/**
 * Fill in the Blank — Living Textbook Prototype #03
 * ==================================================
 *
 * MECHANIC:
 *   A target sentence is shown with one word missing (shown as "____").
 *   3-4 answer choices are presented as tappable buttons.
 *   The student taps the word they think fills the blank.
 *   Correct → advance to next sentence. Incorrect → retry (no shame language).
 *
 *   The 2 target sentences are presented as 2 rounds.
 *   Each target sentence must contain exactly one {blank} placeholder.
 *
 * CONSTRAINTS SATISFIED:
 *   #1  No hard-coded tenant — tenant_id comes from unit_meta
 *   #2  All text has audio (choices, sentence, feedback, instruction)
 *   #3  Tap text to hear it (choices, sentence, feedback)
 *   #4  Choices are action buttons → each has separate 🔊 listen control
 *   #5  JSON input (unit_meta + pedagogical_payload + audio_cues)
 *   #6  Emits all 6 standard events
 *   #7  8-12 vocabulary terms supported (sample has 10)
 *   #8  Exactly 2 target sentences (sample has 2)
 *   #9  Mobile-first layout (max-width 480px, 44px+ tap targets)
 *   #10 No premium polish — clean divs, readable fonts
 *   #11 No gambling mechanics — deterministic scoring
 *   #12 No public code/assets imported (all original, dependency-free vanilla JS)
 *
 * RETRY WITHOUT SHAME:
 *   Incorrect answers do NOT use words like "wrong", "fail", "incorrect" in the UI.
 *   Instead: "Not quite. Try again." + the student can retry immediately.
 *   The event payload uses neutral field names (isCorrect: false) for telemetry.
 *
 * CONSTRUCTOR:
 *   new FillInTheBlank(rootSelector, inputData, options)
 *
 *   inputData shape: see sample-data.js
 *   options:
 *     - onEvent: (event) => void   — receives all 6 standard events
 *
 * PUBLIC API:
 *   game.start()  — renders the game and emits game_started
 */

function FillInTheBlank(rootSelector, inputData, options) {
  options = options || {};
  this.root = document.querySelector(rootSelector);
  this.data = inputData;
  this.onEvent = options.onEvent || function () {};

  // Shared framework pieces
  this.audio = new LTB.AudioBus();
  this.sessionToken = LTB.UI.generateSessionToken();
  this.eventLogger = new LTB.EventLogger(this.sessionToken, this.onEvent);

  // Extract pedagogical payload
  this.vocab = this.data.pedagogical_payload.vocabulary_terms;
  this.targetSentences = this.data.pedagogical_payload.target_sentences;
  // CRITICAL FIX: Use explicit answers array if provided. Fall back to
  // audio_cues derivation only if answers array is missing (backward compat).
  this.answers = this.data.pedagogical_payload.answers || null;
  this.audioCues = this.data.audio_cues || [];
  this.unitMeta = this.data.unit_meta || {};

  // Mastery tracker — keyed by sentence index
  this.mastery = new LTB.MasteryTracker(
    this.targetSentences.map(function (_s, i) { return 'sentence-' + i; }),
    this.eventLogger
  );

  // Game state
  this.currentRoundIndex = 0;
  this.score = 0;
  this.attempts = 0;
  this.roundAttempts = 0;
  this.gameStartTime = 0;
  this.roundStartTime = 0;
  this.isFinished = false;
  this.choicesPerRound = 4;
}

FillInTheBlank.prototype.start = function () {
  LTB.UI.applyBaseStyles(this.root);
  this.root.classList.add('ltb-root');
  this.eventLogger.start();
  this.gameStartTime = Date.now();
  this._emitGameStarted();
  this._renderRound();
};

// ===========================================================================
// ROUND SETUP
// ===========================================================================

/**
 * Parse a target sentence with {blank} placeholder.
 * Returns { before, answer, after } where the sentence is split around the blank.
 * Example: "I {blank} a story." → { before: "I ", answer: "read", after: " a story." }
 *
 * The answer is derived from the full sentence (the word that was blanked out).
 * In the sample data, the target sentence is "I read a story every night."
 * but stored as "I {blank} a story every night." — so we need the original
 * answer word separately.
 *
 * DESIGN DECISION: Since the schema stores sentences with {blank} but doesn't
 * separately store the answer word, we derive the answer from the vocab list
 * by finding which vocab word, when substituted, makes the sentence read
 * naturally. For the prototype, we use a simpler approach: the answer is
 * provided via a parallel array OR derived deterministically.
 *
 * For this prototype, we extend the schema slightly: if a sentence has {blank},
 * the answer is the vocab word that best fits (first vocab word that, when
 * substituted, produces a grammatical sentence). In practice, the host app
 * should provide the answer explicitly. For now, we use a heuristic:
 * the answer is the first vocab word that appears in the "full" sentence.
 *
 * SIMPLER APPROACH (used here): The sample data's audio_cues include the
 * full sentence (e.g., "I read a story every night."). We find the answer
 * by comparing the {blank} sentence to the full sentence and extracting
 * the substituted word.
 */
FillInTheBlank.prototype._parseSentence = function (sentenceWithBlank) {
  // Find the {blank} placeholder
  var blankIdx = sentenceWithBlank.indexOf('{blank}');
  if (blankIdx === -1) {
    return {
      before: sentenceWithBlank,
      answer: '',
      after: '',
      display: sentenceWithBlank,
      blankWord: '_____'
    };
  }
  var before = sentenceWithBlank.slice(0, blankIdx);
  var after = sentenceWithBlank.slice(blankIdx + 7); // 7 = '{blank}'.length

  // CRITICAL FIX: Use explicit answers array first (1:1 mapping with target_sentences).
  // This replaces the fragile regex-matching approach that silently fell back to
  // the first vocab word if audio_cues lacked a matching sentence cue.
  if (this.answers && this.answers.length > this.currentRoundIndex) {
    var explicitAnswer = this.answers[this.currentRoundIndex];
    return {
      before: before,
      answer: explicitAnswer,
      after: after,
      display: before + '_____' + after,
      blankWord: '_____'
    };
  }

  // FALLBACK: Derive answer from audio_cues (backward compatibility)
  var self = this;
  if (this.audioCues && this.audioCues.length) {
    var pattern = before.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
                  '(.+?)' +
                  after.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var regex = new RegExp(pattern);
    for (var i = 0; i < this.audioCues.length; i++) {
      var cue = this.audioCues[i];
      if (cue.kind === 'sentence') {
        var match = cue.text.match(regex);
        if (match) {
          fullSentence = cue.text;
          return {
            before: before,
            answer: match[1],
            after: after,
            display: before + '_____' + after,
            blankWord: '_____'
          };
        }
      }
    }
  }

  // Fallback: if no full sentence found in audio_cues, the answer is unknown.
  // Use the first vocab word as a placeholder (shouldn't happen with valid data).
  return {
    before: before,
    answer: this.vocab[0] || '',
    after: after,
    display: before + '_____' + after,
    blankWord: '_____'
  };
};

FillInTheBlank.prototype._generateChoices = function (correctAnswer) {
  // Generate 4 choices: 1 correct + 3 distractors (deterministic — first 3
  // vocab words that aren't the answer, to keep scoring deterministic per constraint #11)
  var distractors = this.vocab.filter(function (v) {
    return v.toLowerCase() !== correctAnswer.toLowerCase();
  }).slice(0, this.choicesPerRound - 1);
  var choices = [correctAnswer].concat(distractors);
  // Shuffle choices (shuffling tile order doesn't make scoring non-deterministic —
  // the score is based on whether the student picks the correct word, not tile position)
  return LTB.UI.shuffle(choices);
};

// ===========================================================================
// EVENT EMISSION
// ===========================================================================

FillInTheBlank.prototype._emitGameStarted = function () {
  this.eventLogger.emit({
    type: 'game_started',
    tenantId: this.unitMeta.tenant_id,
    gameMode: this.unitMeta.game_mode,
    engineId: this.unitMeta.engine_id,
    level: this.unitMeta.level,
    theme: this.unitMeta.theme,
    totalRounds: this.targetSentences.length,
    vocabularyCount: this.vocab.length,
    targetSentences: this.targetSentences,
  });
};

FillInTheBlank.prototype._emitRoundShown = function (parsed, choices) {
  this.eventLogger.emit({
    type: 'round_shown',
    roundIndex: this.currentRoundIndex,
    targetSentence: this.targetSentences[this.currentRoundIndex],
    displaySentence: parsed.display,
    answer: parsed.answer,
    choices: choices,
  });
};

FillInTheBlank.prototype._emitAnswerSubmitted = function (selectedWord, isCorrect) {
  this.eventLogger.emit({
    type: 'answer_submitted',
    roundIndex: this.currentRoundIndex,
    targetSentence: this.targetSentences[this.currentRoundIndex],
    selected: selectedWord,
    isCorrect: isCorrect,
    attemptNumber: this.roundAttempts,
    timeMs: Date.now() - this.roundStartTime,
  });
};

FillInTheBlank.prototype._emitAnswerResult = function (isCorrect) {
  if (isCorrect) {
    this.score++;
  }
  this.eventLogger.emit({
    type: 'answer_result',
    roundIndex: this.currentRoundIndex,
    correct: isCorrect,
    scoreDelta: isCorrect ? 1 : 0,
    newScore: this.score,
    attemptsThisRound: this.roundAttempts,
  });
};

FillInTheBlank.prototype._emitGameCompleted = function () {
  this.eventLogger.emit({
    type: 'game_completed',
    totalRounds: this.targetSentences.length,
    correct: this.score,
    totalAttempts: this.attempts,
    accuracy: this.attempts > 0 ? this.score / this.attempts : 0,
    durationMs: Date.now() - this.gameStartTime,
    finalMastery: this.mastery.getAll(),
  });
};

// ===========================================================================
// RENDERING
// ===========================================================================

FillInTheBlank.prototype._renderRound = function () {
  var self = this;
  if (this.currentRoundIndex >= this.targetSentences.length) {
    this._renderCompletion();
    return;
  }
  var sentenceWithBlank = this.targetSentences[this.currentRoundIndex];
  var parsed = this._parseSentence(sentenceWithBlank);
  var choices = this._generateChoices(parsed.answer);
  this.roundAttempts = 0;
  this.roundStartTime = Date.now();
  this._emitRoundShown(parsed, choices);

  this.root.innerHTML = '';

  // ---- Progress ----
  var progress = document.createElement('div');
  progress.className = 'ltb-progress';
  progress.textContent =
    'Round ' + (this.currentRoundIndex + 1) + ' of ' + this.targetSentences.length +
    '  ·  Score: ' + this.score;
  this.root.appendChild(progress);

  // ---- Instruction card ----
  var card = document.createElement('div');
  card.className = 'ltb-card';

  // Instruction (tap-to-speak)
  var instruction = document.createElement('div');
  instruction.style.cssText = 'font-size:14px;color:#666;margin-bottom:12px;';
  instruction.textContent = 'Choose the word that fits.';
  var self2 = this;
  LTB.UI.makeSpeakable(instruction, 'Choose the word that fits.', this.audio);
  instruction.addEventListener('click', function () {
    self2.audio.speakWithCues('Choose the word that fits.', 'instruction', self2.audioCues);
  });
  card.appendChild(instruction);

  // Sentence with blank (tap-to-speak the full sentence)
  var sentenceLabel = document.createElement('div');
  sentenceLabel.style.cssText = 'font-size:12px;color:#888;margin-bottom:4px;';
  sentenceLabel.textContent = 'Sentence:';
  card.appendChild(sentenceLabel);

  var sentenceRow = document.createElement('div');
  sentenceRow.className = 'ltb-prompt';
  var sentenceSpan = document.createElement('span');
  sentenceSpan.textContent = parsed.display;
  sentenceSpan.style.flex = '1';
  // Tap-to-speak the FULL sentence (with the answer filled in), not the blank version
  var fullSentence = parsed.before + parsed.answer + parsed.after;
  LTB.UI.makeSpeakable(sentenceSpan, fullSentence, this.audio);
  sentenceSpan.addEventListener('click', function () {
    self2.audio.speakWithCues(fullSentence, 'sentence', self2.audioCues);
  });
  sentenceRow.appendChild(sentenceSpan);
  // Separate listen/replay button for the sentence (constraint #4)
  var listenBtn = LTB.UI.makeListenButton(fullSentence, this.audio);
  listenBtn.addEventListener('click', function () {
    self2.audio.speakWithCues(fullSentence, 'sentence', self2.audioCues);
  });
  sentenceRow.appendChild(listenBtn);
  card.appendChild(sentenceRow);

  this.root.appendChild(card);

  // ---- Answer choices ----
  var choicesLabel = document.createElement('div');
  choicesLabel.style.cssText = 'font-size:12px;color:#888;margin:12px 0 4px;';
  choicesLabel.textContent = 'Your choices:';
  this.root.appendChild(choicesLabel);

  choices.forEach(function (word) {
    var btn = document.createElement('button');
    btn.className = 'ltb-button';
    btn.type = 'button';

    var wordSpan = document.createElement('span');
    wordSpan.textContent = word;
    wordSpan.style.cssText = 'flex:1;text-align:left;';
    // Tap-to-speak the word (constraint #3)
    LTB.UI.makeSpeakable(wordSpan, word, self.audio);
    wordSpan.addEventListener('click', function (e) {
      e.stopPropagation();
      self.audio.speakWithCues(word, 'term', self.audioCues);
    });
    btn.appendChild(wordSpan);

    // Separate listen button (constraint #4: button is also an action)
    var wordListenBtn = LTB.UI.makeListenButton(word, self.audio);
    wordListenBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      self.audio.speakWithCues(word, 'term', self.audioCues);
    });
    btn.appendChild(wordListenBtn);

    // Click on button body (not listen button) = submit answer
    btn.addEventListener('click', function (e) {
      if (e.target === wordListenBtn || wordListenBtn.contains(e.target)) return;
      if (e.target === wordSpan || wordSpan.contains(e.target)) return;
      self._handleChoice(word, parsed);
    });

    self.root.appendChild(btn);
  });
};

FillInTheBlank.prototype._handleChoice = function (selectedWord, parsed) {
  if (this.isFinished) return;
  var isCorrect = selectedWord.toLowerCase() === parsed.answer.toLowerCase();

  this.attempts++;
  this.roundAttempts++;
  this._emitAnswerSubmitted(selectedWord, isCorrect);
  this._emitAnswerResult(isCorrect);

  if (isCorrect) {
    this.mastery.recordCorrect('sentence-' + this.currentRoundIndex);
    this._showFeedback(true, selectedWord, parsed);
  } else {
    this.mastery.recordIncorrect('sentence-' + this.currentRoundIndex);
    this._showFeedback(false, selectedWord, parsed);
  }
};

FillInTheBlank.prototype._showFeedback = function (correct, selectedWord, parsed) {
  var self = this;
  var fullSentence = parsed.before + parsed.answer + parsed.after;

  // Disable choice buttons
  var buttons = this.root.querySelectorAll('.ltb-button');
  buttons.forEach(function (b) { b.disabled = true; b.style.opacity = '0.5'; });

  // Feedback card (tap-to-speak — constraint #2)
  var feedback = document.createElement('div');
  feedback.className = 'ltb-feedback ' + (correct ? 'correct' : 'neutral');

  if (correct) {
    // Shame-free, encouraging language
    feedback.textContent = '✓ "' + selectedWord + '" fits. ' + fullSentence;
    LTB.UI.makeSpeakable(feedback, 'That fits. ' + fullSentence, this.audio);
    this.audio.speakWithCues('That fits. ' + fullSentence, 'feedback', this.audioCues);
  } else {
    // Shame-free retry language — no "wrong", "fail", "incorrect" in UI
    feedback.textContent = 'Not quite. Try again.';
    feedback.classList.remove('correct');
    feedback.classList.add('incorrect');
    LTB.UI.makeSpeakable(feedback, 'Not quite. Try again.', this.audio);
    this.audio.speakWithCues('Not quite. Try again.', 'feedback', self.audioCues);
  }
  this.root.appendChild(feedback);

  if (correct) {
    // Advance to next round after delay
    setTimeout(function () {
      self.currentRoundIndex++;
      self._renderRound();
    }, 2000);
  } else {
    // Re-enable choices for retry after delay (no shame, just try again)
    setTimeout(function () {
      self.root.querySelectorAll('.ltb-button').forEach(function (b) {
        b.disabled = false;
        b.style.opacity = '1';
      });
      feedback.remove();
    }, 1800);
  }
};

// ===========================================================================
// COMPLETION SCREEN
// ===========================================================================

FillInTheBlank.prototype._renderCompletion = function () {
  this.isFinished = true;
  this._emitGameCompleted();
  var accuracy = this.attempts > 0 ? Math.round((this.score / this.attempts) * 100) : 0;
  this.root.innerHTML = '';

  var card = document.createElement('div');
  card.className = 'ltb-card';
  card.style.textAlign = 'center';

  var title = document.createElement('div');
  title.style.cssText = 'font-size:24px;font-weight:bold;margin-bottom:12px;';
  title.textContent = 'All done!';
  LTB.UI.makeSpeakable(title, 'All done. You completed ' + this.targetSentences.length + ' sentences.', this.audio);
  card.appendChild(title);

  var score = document.createElement('div');
  score.style.cssText = 'font-size:48px;font-weight:bold;color:#2563eb;margin:16px 0;';
  score.textContent = this.score + ' / ' + this.targetSentences.length;
  LTB.UI.makeSpeakable(score, this.score + ' out of ' + this.targetSentences.length + ' correct.', this.audio);
  card.appendChild(score);

  var stats = document.createElement('div');
  stats.style.cssText = 'font-size:16px;color:#666;margin-bottom:8px;';
  stats.textContent = 'Total attempts: ' + this.attempts;
  LTB.UI.makeSpeakable(stats, 'Total attempts: ' + this.attempts, this.audio);
  card.appendChild(stats);

  var acc = document.createElement('div');
  acc.style.cssText = 'font-size:18px;color:#666;margin-bottom:16px;';
  acc.textContent = 'Accuracy: ' + accuracy + '%';
  LTB.UI.makeSpeakable(acc, 'Accuracy: ' + accuracy + ' percent.', this.audio);
  card.appendChild(acc);

  // Mastery summary
  var masteryLabel = document.createElement('div');
  masteryLabel.style.cssText = 'font-size:14px;color:#888;margin-top:16px;';
  masteryLabel.textContent = 'Sentence mastery:';
  card.appendChild(masteryLabel);

  var self = this;
  this.targetSentences.forEach(function (sentence, i) {
    var m = self.mastery.get('sentence-' + i);
    if (m <= 0) return;
    var parsed = self._parseSentence(sentence);
    var full = parsed.before + parsed.answer + parsed.after;
    var row = document.createElement('div');
    row.style.cssText = 'font-size:13px;color:#555;display:flex;justify-content:space-between;padding:2px 0;align-items:center;';
    var left = document.createElement('span');
    left.textContent = full;
    left.style.cssText = 'flex:1;margin-right:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    LTB.UI.makeSpeakable(left, full, self.audio);
    left.addEventListener('click', function () {
      self.audio.speakWithCues(full, 'sentence', self.audioCues);
    });
    var right = document.createElement('span');
    right.textContent = Math.round(m * 100) + '%';
    row.appendChild(left);
    row.appendChild(right);
    card.appendChild(row);
  });

  // Play again button
  var restart = document.createElement('button');
  restart.className = 'ltb-button';
  restart.style.cssText = 'margin-top:16px;text-align:center;border-color:#16a34a;color:#16a34a;';
  restart.textContent = '↻ Play Again';
  restart.addEventListener('click', function () {
    self.currentRoundIndex = 0;
    self.score = 0;
    self.attempts = 0;
    self.roundAttempts = 0;
    self.isFinished = false;
    self.gameStartTime = Date.now();
    self.eventLogger.start();
    self._emitGameStarted();
    self._renderRound();
  });
  card.appendChild(restart);

  this.root.appendChild(card);
};
