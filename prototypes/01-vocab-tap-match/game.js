/**
 * Vocab Tap Match — Living Textbook Prototype #01
 * ================================================
 *
 * MECHANIC:
 *   Each round, a sentence prompt is shown with a blank.
 *   The student taps the word that completes the sentence.
 *   4 options are shown (1 correct + 3 distractors).
 *
 *   The 2 sentence structures alternate round-by-round so the student
 *   practices both target structures.
 *
 * CONSTRAINTS SATISFIED:
 *   #2  All text has audio (tap-to-speak on prompt, options, feedback)
 *   #3  Tap text to hear it (prompt, options, definition in feedback)
 *   #4  Prompt is also an action target → separate 🔊 listen button
 *   #5  JSON input (see sample-data.js)
 *   #6  Emits all 6 standard events
 *   #7  8-12 terms supported (sample has 10)
 *   #8  Exactly 2 sentence structures
 *   #9  Mobile-first layout (max-width 480px, 44px+ tap targets)
 *   #10 No premium polish — clean divs, readable fonts
 *   #11 No gambling mechanics — mastery is purely correct/incorrect based
 *
 * CONSTRUCTOR:
 *   new VocabTapMatch(rootSelector, inputData, options)
 *
 *   inputData shape: see _shared/sample-data.json
 *   options:
 *     - onEvent: (event) => void   — receives all 6 standard events
 *
 * PUBLIC API:
 *   game.start()  — renders the game and emits game_started
 */

function VocabTapMatch(rootSelector, inputData, options) {
  options = options || {};
  this.root = document.querySelector(rootSelector);
  this.data = inputData;
  this.onEvent = options.onEvent || function () {};

  // Shared framework pieces
  this.audio = new LTB.AudioBus();
  this.sessionToken = LTB.UI.generateSessionToken();
  this.eventLogger = new LTB.EventLogger(this.sessionToken, this.onEvent);
  this.mastery = new LTB.MasteryTracker(
    this.data.terms.map(function (t) { return t.id; }),
    this.eventLogger
  );

  // Game state
  this.rounds = [];
  this.currentRoundIndex = 0;
  this.score = 0;
  this.streak = 0;
  this.gameStartTime = 0;
  this.roundStartTime = 0;
  this.isFinished = false;
  this.config = Object.assign(
    { roundsPerGame: 8, optionsPerRound: 4, timePerRoundSec: null },
    this.data.config || {}
  );
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
  var terms = LTB.UI.shuffle(this.data.terms);
  var structures = this.data.sentenceStructures;
  var numRounds = Math.min(this.config.roundsPerGame, terms.length);
  this.rounds = [];
  for (var i = 0; i < numRounds; i++) {
    var correctTerm = terms[i % terms.length];
    var structure = structures[i % structures.length]; // alternate between the 2
    var options = this._generateOptions(correctTerm);
    this.rounds.push({
      roundIndex: i,
      term: correctTerm,
      sentenceStructure: structure,
      options: options,
    });
  }
};

VocabTapMatch.prototype._generateOptions = function (correctTerm) {
  var others = this.data.terms.filter(function (t) { return t.id !== correctTerm.id; });
  var distractors = LTB.UI.shuffle(others).slice(0, this.config.optionsPerRound - 1);
  var options = LTB.UI.shuffle([correctTerm].concat(distractors));
  return options;
};

// ===========================================================================
// EVENT EMISSION
// ===========================================================================

VocabTapMatch.prototype._emitGameStarted = function () {
  this.eventLogger.emit({
    type: 'game_started',
    tenantId: this.data.tenant ? this.data.tenant.id : null,
    totalRounds: this.rounds.length,
    termCount: this.data.terms.length,
    sentenceStructureIds: this.data.sentenceStructures.map(function (s) { return s.id; }),
  });
};

VocabTapMatch.prototype._emitRoundShown = function (round) {
  var prompt = this._fillTemplate(round.sentenceStructure.template, round.term);
  this.eventLogger.emit({
    type: 'round_shown',
    roundIndex: round.roundIndex,
    prompt: prompt,
    sentenceStructureId: round.sentenceStructure.id,
    termId: round.term.id,
    options: round.options.map(function (t) { return t.id; }),
  });
};

VocabTapMatch.prototype._emitAnswerSubmitted = function (round, selectedTermId) {
  this.eventLogger.emit({
    type: 'answer_submitted',
    roundIndex: round.roundIndex,
    termId: round.term.id,
    selectedTermId: selectedTermId,
    timeMs: Date.now() - this.roundStartTime,
  });
};

VocabTapMatch.prototype._emitAnswerResult = function (round, correct) {
  if (correct) {
    this.score++;
    this.streak++;
  } else {
    this.streak = 0;
  }
  this.eventLogger.emit({
    type: 'answer_result',
    roundIndex: round.roundIndex,
    correct: correct,
    scoreDelta: correct ? 1 : 0,
    newScore: this.score,
    streak: this.streak,
  });
};

VocabTapMatch.prototype._emitGameCompleted = function () {
  this.eventLogger.emit({
    type: 'game_completed',
    totalRounds: this.rounds.length,
    correct: this.score,
    accuracy: this.rounds.length > 0 ? this.score / this.rounds.length : 0,
    durationMs: Date.now() - this.gameStartTime,
    finalMastery: this.mastery.getAll(),
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
  this.roundStartTime = Date.now();
  this._emitRoundShown(round);

  var promptText = this._fillTemplate(round.sentenceStructure.template, round.term);
  // For the prompt, blank out the term so the student has to find it.
  var promptWithBlank = this._fillTemplate(round.sentenceStructure.template, { term: '_____' });

  this.root.innerHTML = '';

  // ---- Progress ----
  var progress = document.createElement('div');
  progress.className = 'ltb-progress';
  progress.textContent =
    'Round ' + (round.roundIndex + 1) + ' of ' + this.rounds.length +
    '  ·  Score: ' + this.score +
    (this.streak >= 2 ? '  ·  Streak: ' + this.streak : '');
  this.root.appendChild(progress);

  // ---- Prompt card ----
  var card = document.createElement('div');
  card.className = 'ltb-card';

  // Structure label (small, muted — tap-to-speak)
  var structureLabel = document.createElement('div');
  structureLabel.style.cssText = 'font-size:12px;color:#666;margin-bottom:8px;';
  structureLabel.textContent = 'Sentence: ' + round.sentenceStructure.description;
  LTB.UI.makeSpeakable(structureLabel, round.sentenceStructure.description, this.audio);
  card.appendChild(structureLabel);

  // Prompt text + listen button (constraint #4: prompt is also an action target,
  // so we add a separate 🔊 listen button)
  var promptRow = document.createElement('div');
  promptRow.className = 'ltb-prompt';
  var promptSpan = document.createElement('span');
  promptSpan.textContent = promptWithBlank;
  promptSpan.style.flex = '1';
  LTB.UI.makeSpeakable(promptSpan, promptText, this.audio); // tap-to-speak (constraint #3)
  promptRow.appendChild(promptSpan);
  promptRow.appendChild(LTB.UI.makeListenButton(promptText, this.audio));
  card.appendChild(promptRow);

  // Hint: definition of the target word (tap-to-speak)
  var hint = document.createElement('div');
  hint.style.cssText = 'font-size:14px;color:#444;margin-bottom:16px;padding:8px;background:#f5f5f5;border-radius:4px;';
  hint.textContent = 'Hint: ' + round.term.definition;
  LTB.UI.makeSpeakable(hint, 'Hint. ' + round.term.definition, this.audio);
  card.appendChild(hint);

  this.root.appendChild(card);

  // ---- Options ----
  round.options.forEach(function (term) {
    var btn = document.createElement('button');
    btn.className = 'ltb-button';
    btn.type = 'button';
    var label = (term.emoji ? term.emoji + ' ' : '') + term.term;
    btn.textContent = label;
    // Constraint #3: tap-to-speak on the option text.
    // But the option is ALSO an action button (selects the answer).
    // Per constraint #4, we add a separate listen button.
    var listenBtn = LTB.UI.makeListenButton(term.term, self.audio);
    listenBtn.style.float = 'right';
    listenBtn.style.marginTop = '4px';
    btn.appendChild(listenBtn);
    // Click on the button body (not the listen button) = submit answer
    btn.addEventListener('click', function (e) {
      // If the click landed on the listen button, don't submit
      if (e.target === listenBtn || listenBtn.contains(e.target)) return;
      self._handleAnswer(term, round);
    });
    self.root.appendChild(btn);
  });
};

VocabTapMatch.prototype._renderCompletion = function () {
  this.isFinished = true;
  this._emitGameCompleted();
  var accuracy = this.rounds.length > 0 ? Math.round((this.score / this.rounds.length) * 100) : 0;
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

  var acc = document.createElement('div');
  acc.style.cssText = 'font-size:18px;color:#666;margin-bottom:16px;';
  acc.textContent = 'Accuracy: ' + accuracy + '%';
  LTB.UI.makeSpeakable(acc, 'Accuracy: ' + accuracy + ' percent.', this.audio);
  card.appendChild(acc);

  // Mastery summary (no gambling — just informational)
  var masteryLabel = document.createElement('div');
  masteryLabel.style.cssText = 'font-size:14px;color:#888;margin-top:16px;';
  masteryLabel.textContent = 'Mastery scores:';
  card.appendChild(masteryLabel);

  var self = this;
  this.data.terms.forEach(function (t) {
    var m = self.mastery.get(t.id);
    if (m <= 0) return; // only show terms that were touched
    var row = document.createElement('div');
    row.style.cssText = 'font-size:13px;color:#555;display:flex;justify-content:space-between;padding:2px 0;';
    var left = document.createElement('span');
    left.textContent = (t.emoji ? t.emoji + ' ' : '') + t.term;
    LTB.UI.makeSpeakable(left, t.term, self.audio);
    var right = document.createElement('span');
    right.textContent = Math.round(m * 100) + '%';
    row.appendChild(left);
    row.appendChild(right);
    card.appendChild(row);
  });

  // Play again button
  var restart = document.createElement('button');
  restart.className = 'ltb-button';
  restart.style.marginTop = '16px';
  restart.style.textAlign = 'center';
  restart.style.borderColor = '#16a34a';
  restart.style.color = '#16a34a';
  restart.textContent = '↻ Play Again';
  restart.addEventListener('click', function () {
    self.currentRoundIndex = 0;
    self.score = 0;
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

// ===========================================================================
// ANSWER HANDLING
// ===========================================================================

VocabTapMatch.prototype._handleAnswer = function (selectedTerm, round) {
  if (this.isFinished) return;
  var correct = selectedTerm.id === round.term.id;
  this._emitAnswerSubmitted(round, selectedTerm.id);
  this._emitAnswerResult(round, correct);

  if (correct) {
    this.mastery.recordCorrect(round.term.id);
  } else {
    this.mastery.recordIncorrect(round.term.id);
    // Also record mastery for the incorrectly-selected term (student confused them)
    this.mastery.recordIncorrect(selectedTerm.id);
  }

  this._showFeedback(correct, round, selectedTerm);
};

VocabTapMatch.prototype._showFeedback = function (correct, round, selectedTerm) {
  var self = this;
  // Highlight correct/incorrect options
  var buttons = this.root.querySelectorAll('.ltb-button');
  buttons.forEach(function (btn, i) {
    btn.disabled = true;
    var term = round.options[i];
    if (term.id === round.term.id) {
      btn.classList.add('correct');
    } else if (term.id === selectedTerm.id && !correct) {
      btn.classList.add('incorrect');
    }
  });

  // Feedback card
  var feedback = document.createElement('div');
  feedback.className = 'ltb-feedback ' + (correct ? 'correct' : 'incorrect');

  if (correct) {
    var fullSentence = this._fillTemplate(round.sentenceStructure.template, round.term);
    feedback.textContent = '✓ Correct! ' + fullSentence;
    LTB.UI.makeSpeakable(feedback, 'Correct! ' + fullSentence, this.audio);
    this.audio.speak(fullSentence); // speak the full correct sentence
  } else {
    var correctSentence = this._fillTemplate(round.sentenceStructure.template, round.term);
    feedback.textContent = '✗ The answer was: ' + round.term.term;
    LTB.UI.makeSpeakable(feedback, 'Not quite. The answer was: ' + round.term.term + '. ' + correctSentence, this.audio);
    this.audio.speak('The answer was: ' + round.term.term);
  }
  this.root.appendChild(feedback);

  // Next round after delay
  setTimeout(function () {
    self.currentRoundIndex++;
    self._renderRound();
  }, correct ? 1500 : 2500);
};

// ===========================================================================
// HELPERS
// ===========================================================================

VocabTapMatch.prototype._fillTemplate = function (template, term) {
  return template.replace('{term}', term.term || '_____');
};
