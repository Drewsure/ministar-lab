/**
 * Vocab Tap Match — Living Textbook Prototype #01 (Schema B migrated)
 * ================================================================
 *
 * MECHANIC:
 *   A sentence prompt is shown with a blank. The student taps the word
 *   that completes the sentence. 4 options are shown (1 correct + 3 distractors).
 *   Incorrect answers allow retry (shame-free) — round only advances on correct.
 *
 * MIGRATION FROM SCHEMA A:
 *   - Now uses unit_meta + pedagogical_payload + audio_cues (Schema B)
 *   - Now uses speakWithCues for audio (prefers pre-recorded, falls back to TTS)
 *   - Now allows retry on incorrect (matches Prototypes 02-04 pattern)
 *
 * CONSTRAINTS: All 12 hard constraints satisfied.
 *
 * CONSTRUCTOR:
 *   new VocabTapMatch(rootSelector, inputData, options)
 *   options:
 *     - onEvent: (event) => void
 */

function VocabTapMatch(rootSelector, inputData, options) {
  options = options || {};
  this.root = document.querySelector(rootSelector);
  this.data = inputData;
  this.onEvent = options.onEvent || function () {};

  this.audio = new LTB.AudioBus();
  this.sessionToken = LTB.UI.generateSessionToken();
  this.eventLogger = new LTB.EventLogger(this.sessionToken, this.onEvent);

  // Schema B extraction
  this.vocab = this.data.pedagogical_payload.vocabulary_terms;
  this.definitions = this.data.pedagogical_payload.term_definitions || {};
  this.sentences = this.data.pedagogical_payload.target_sentences;
  this.audioCues = this.data.audio_cues || [];
  this.unitMeta = this.data.unit_meta || {};

  // Game state
  this.rounds = [];
  this.currentRoundIndex = 0;
  this.score = 0;
  this.attempts = 0;
  this.roundAttempts = 0;
  this.streak = 0;
  this.gameStartTime = 0;
  this.roundStartTime = 0;
  this.isFinished = false;
  this.maxScore = Math.min(this.vocab.length, 8);
  this.choicesPerRound = 4;
}

VocabTapMatch.prototype.start = function () {
  LTB.UI.applyBaseStyles(this.root);
  this.root.classList.add('ltb-root');
  this.eventLogger.start();
  this.gameStartTime = Date.now();
  this._buildRounds();
  this._emitGameStarted();
  this._renderRound();
};

// ===========================================================================
// ROUND GENERATION
// ===========================================================================

VocabTapMatch.prototype._buildRounds = function () {
  var terms = LTB.UI.shuffle(this.vocab);
  var sentences = this.sentences;
  var numRounds = Math.min(this.maxScore, terms.length);
  this.rounds = [];
  for (var i = 0; i < numRounds; i++) {
    var correctTerm = terms[i % terms.length];
    var sentence = sentences[i % sentences.length]; // alternate between 2 sentences
    var filledSentence = sentence.replace(/\{term\}/gi, correctTerm);
    var promptWithBlank = sentence.replace(/\{term\}/gi, '_____');
    var options = this._generateChoices(correctTerm);
    this.rounds.push({
      roundIndex: i,
      term: correctTerm,
      sentence: filledSentence,
      promptWithBlank: promptWithBlank,
      sentenceStructure: sentence,
      options: options,
    });
  }
};

VocabTapMatch.prototype._generateChoices = function (correctTerm) {
  var others = this.vocab.filter(function (v) { return v !== correctTerm; });
  var distractors = LTB.UI.shuffle(others).slice(0, this.choicesPerRound - 1);
  return LTB.UI.shuffle([correctTerm].concat(distractors));
};

// ===========================================================================
// EVENT EMISSION
// ===========================================================================

VocabTapMatch.prototype._emitGameStarted = function () {
  this.eventLogger.emit({
    type: 'game_started',
    timestamp: 0,
    tenantId: this.unitMeta.tenant_id,
    gameMode: this.unitMeta.game_mode,
    totalRounds: this.rounds.length,
    vocabularyCount: this.vocab.length,
    targetSentences: this.sentences,
  });
};

VocabTapMatch.prototype._emitRoundShown = function (round) {
  this.eventLogger.emit({
    type: 'round_shown',
    roundIndex: round.roundIndex,
    prompt: round.promptWithBlank,
    answer: round.term,
    options: round.options,
  });
};

VocabTapMatch.prototype._emitAnswerSubmitted = function (selectedTerm, isCorrect) {
  this.eventLogger.emit({
    type: 'answer_submitted',
    roundIndex: this.currentRoundIndex,
    term: this.rounds[this.currentRoundIndex].term,
    selectedTermId: selectedTerm,
    isCorrect: isCorrect,
    attemptNumber: this.roundAttempts,
    timeMs: Date.now() - this.roundStartTime,
  });
};

VocabTapMatch.prototype._emitAnswerResult = function (isCorrect) {
  if (isCorrect) { this.score++; this.streak++; } else { this.streak = 0; }
  this.eventLogger.emit({
    type: 'answer_result',
    roundIndex: this.currentRoundIndex,
    correct: isCorrect,
    scoreDelta: isCorrect ? 1 : 0,
    newScore: this.score,
    streak: this.streak,
    attemptsThisRound: this.roundAttempts,
  });
};

VocabTapMatch.prototype._emitGameCompleted = function () {
  this.eventLogger.emit({
    type: 'game_completed',
    totalRounds: this.rounds.length,
    correct: this.score,
    totalAttempts: this.attempts,
    accuracy: this.attempts > 0 ? this.score / this.attempts : 0,
    durationMs: Date.now() - this.gameStartTime,
  });
};

// ===========================================================================
// RENDERING
// ===========================================================================

VocabTapMatch.prototype._renderRound = function () {
  var self = this;
  if (this.currentRoundIndex >= this.rounds.length) {
    this._renderCompletion();
    return;
  }
  var round = this.rounds[this.currentRoundIndex];
  this.roundAttempts = 0;
  this.roundStartTime = Date.now();
  this._emitRoundShown(round);

  this.root.innerHTML = '';

  // Progress
  var progress = document.createElement('div');
  progress.className = 'ltb-progress';
  progress.textContent = 'Round ' + (this.currentRoundIndex + 1) + ' of ' + this.rounds.length +
    '  ·  Score: ' + this.score + (this.streak >= 2 ? '  ·  Streak: ' + this.streak : '');
  this.root.appendChild(progress);

  // Prompt card
  var card = document.createElement('div');
  card.className = 'ltb-card';

  // Sentence structure label
  var structureLabel = document.createElement('div');
  structureLabel.style.cssText = 'font-size:12px;color:#666;margin-bottom:8px;';
  structureLabel.textContent = 'Sentence: ' + round.sentenceStructure;
  LTB.UI.makeSpeakable(structureLabel, round.sentenceStructure, this.audio);
  structureLabel.addEventListener('click', function () {
    self.audio.speakWithCues(round.sentenceStructure, 'instruction', self.audioCues);
  });
  card.appendChild(structureLabel);

  // Prompt with blank + listen button
  var promptRow = document.createElement('div');
  promptRow.className = 'ltb-prompt';
  var promptSpan = document.createElement('span');
  promptSpan.textContent = round.promptWithBlank;
  promptSpan.style.flex = '1';
  LTB.UI.makeSpeakable(promptSpan, round.sentence, this.audio);
  promptSpan.addEventListener('click', function () {
    self.audio.speakWithCues(round.sentence, 'sentence', self.audioCues);
  });
  promptRow.appendChild(promptSpan);
  var listenBtn = LTB.UI.makeListenButton(round.sentence, this.audio);
  listenBtn.addEventListener('click', function () {
    self.audio.speakWithCues(round.sentence, 'sentence', self.audioCues);
  });
  promptRow.appendChild(listenBtn);
  card.appendChild(promptRow);

  // Hint (definition)
  var def = this.definitions[round.term] || '';
  if (def) {
    var hint = document.createElement('div');
    hint.style.cssText = 'font-size:14px;color:#444;margin-bottom:16px;padding:8px;background:#f5f5f5;border-radius:4px;';
    hint.textContent = 'Hint: ' + def;
    LTB.UI.makeSpeakable(hint, 'Hint. ' + def, this.audio);
    hint.addEventListener('click', function () {
      self.audio.speakWithCues('Hint. ' + def, 'instruction', self.audioCues);
    });
    card.appendChild(hint);
  }

  this.root.appendChild(card);

  // Options
  round.options.forEach(function (term) {
    var btn = document.createElement('button');
    btn.className = 'ltb-button';
    btn.type = 'button';
    var label = document.createElement('span');
    label.textContent = term;
    label.style.cssText = 'flex:1;text-align:left;';
    LTB.UI.makeSpeakable(label, term, self.audio);
    label.addEventListener('click', function (e) {
      e.stopPropagation();
      self.audio.speakWithCues(term, 'term', self.audioCues);
    });
    btn.appendChild(label);
    var termListen = LTB.UI.makeListenButton(term, self.audio);
    termListen.addEventListener('click', function (e) {
      e.stopPropagation();
      self.audio.speakWithCues(term, 'term', self.audioCues);
    });
    btn.appendChild(termListen);
    btn.addEventListener('click', function (e) {
      if (e.target === termListen || termListen.contains(e.target)) return;
      if (e.target === label || label.contains(e.target)) return;
      self._handleAnswer(term, round);
    });
    self.root.appendChild(btn);
  });
};

VocabTapMatch.prototype._handleAnswer = function (selectedTerm, round) {
  if (this.isFinished) return;
  var correct = selectedTerm === round.term;
  this.attempts++;
  this.roundAttempts++;
  this._emitAnswerSubmitted(selectedTerm, correct);
  this._emitAnswerResult(correct);

  if (correct) {
    this._showFeedback(true, round, selectedTerm);
  } else {
    // RETRY: Shame-free, matches Prototypes 02-04 pattern
    this._showFeedback(false, round, selectedTerm);
  }
};

VocabTapMatch.prototype._showFeedback = function (correct, round, selectedTerm) {
  var self = this;
  var buttons = this.root.querySelectorAll('.ltb-button');
  buttons.forEach(function (b) { b.disabled = true; b.style.opacity = '0.5'; });

  var feedback = document.createElement('div');
  feedback.className = 'ltb-feedback ' + (correct ? 'correct' : 'neutral');

  if (correct) {
    feedback.textContent = '✓ Correct! ' + round.sentence;
    LTB.UI.makeSpeakable(feedback, 'Correct! ' + round.sentence, this.audio);
    this.audio.speakWithCues(round.sentence, 'sentence', this.audioCues);
    this.root.appendChild(feedback);

    setTimeout(function () {
      self.currentRoundIndex++;
      self._renderRound();
    }, 1800);
  } else {
    // Shame-free retry
    feedback.textContent = 'Not quite. Try again.';
    feedback.classList.add('incorrect');
    LTB.UI.makeSpeakable(feedback, 'Not quite. Try again.', this.audio);
    this.audio.speakWithCues('Not quite. Try again.', 'instruction', this.audioCues);
    this.root.appendChild(feedback);

    setTimeout(function () {
      self.root.querySelectorAll('.ltb-button').forEach(function (b) {
        b.disabled = false; b.style.opacity = '1';
      });
      feedback.remove();
    }, 1500);
  }
};

// ===========================================================================
// COMPLETION
// ===========================================================================

VocabTapMatch.prototype._renderCompletion = function () {
  this.isFinished = true;
  this._emitGameCompleted();
  var accuracy = this.attempts > 0 ? Math.round((this.score / this.attempts) * 100) : 0;
  this.root.innerHTML = '';

  var card = document.createElement('div');
  card.className = 'ltb-card';
  card.style.textAlign = 'center';

  var title = document.createElement('div');
  title.style.cssText = 'font-size:24px;font-weight:bold;margin-bottom:12px;';
  title.textContent = 'Game Complete!';
  LTB.UI.makeSpeakable(title, 'Game complete. You scored ' + this.score + ' out of ' + this.rounds.length + '.', this.audio);
  card.appendChild(title);

  var score = document.createElement('div');
  score.style.cssText = 'font-size:48px;font-weight:bold;color:#2563eb;margin:16px 0;';
  score.textContent = this.score + ' / ' + this.rounds.length;
  LTB.UI.makeSpeakable(score, this.score + ' out of ' + this.rounds.length + ' correct.', this.audio);
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

  var self = this;
  var restart = document.createElement('button');
  restart.className = 'ltb-button';
  restart.style.cssText = 'margin-top:16px;text-align:center;border-color:#16a34a;color:#16a34a;';
  restart.textContent = '↻ Play Again';
  restart.addEventListener('click', function () {
    self.currentRoundIndex = 0;
    self.score = 0;
    self.attempts = 0;
    self.roundAttempts = 0;
    self.streak = 0;
    self.isFinished = false;
    self.gameStartTime = Date.now();
    self.eventLogger.start();
    self._buildRounds();
    self._emitGameStarted();
    self._renderRound();
  });
  card.appendChild(restart);
  this.root.appendChild(card);
};
