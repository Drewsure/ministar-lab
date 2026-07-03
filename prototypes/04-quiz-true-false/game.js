/**
 * Quiz / True-False — Living Textbook Prototype #04
 * ==================================================
 *
 * MECHANIC:
 *   Start screen → choose mode (Multiple Choice or True/False) →
 *   One question at a time → tap answer → feedback → next question.
 *
 *   Two modes:
 *     - multiple-choice: "Which word goes with: 'says meow'?" → 4 options
 *     - true-false: "True or False: A cat says meow." → True / False buttons
 *
 * CONSTRAINTS SATISFIED:
 *   #1  No hard-coded tenant — tenant_id from unit_meta
 *   #2  All text has audio (instruction, question, answers, feedback)
 *   #3  Tap text to hear it (question, answers)
 *   #4  Submit/confirm action separate from listen controls (each answer has 🔊)
 *   #5  JSON input (unit_meta + pedagogical_payload + audio_cues)
 *   #6  Emits all 6 standard events
 *   #7  8-12 vocabulary terms (sample has 10)
 *   #8  Exactly 2 target sentences (sample has 2)
 *   #9  Mobile-first (max-width 480px, 44px+ tap targets)
 *   #10 No premium polish — clean divs, readable fonts
 *   #11 No gambling — deterministic scoring
 *   #12 No public code/assets — all original vanilla JS
 *
 * CHILD-SAFE FEEDBACK:
 *   - Correct: "That is right." + encouraging tone
 *   - Incorrect: "Not quite. Try again." — no shame language
 *   - Retry allowed on incorrect (no penalty, just try again)
 *
 * CONSTRUCTOR:
 *   new QuizTrueFalse(rootSelector, inputData, options)
 *   options:
 *     - onEvent: (event) => void
 *
 * PUBLIC API:
 *   game.start()  — renders the start screen
 */

function QuizTrueFalse(rootSelector, inputData, options) {
  options = options || {};
  this.root = document.querySelector(rootSelector);
  this.data = inputData;
  this.onEvent = options.onEvent || function () {};

  // Shared framework
  this.audio = new LTB.AudioBus();
  this.sessionToken = LTB.UI.generateSessionToken();
  this.eventLogger = new LTB.EventLogger(this.sessionToken, this.onEvent);

  // Payload
  this.vocab = this.data.pedagogical_payload.vocabulary_terms;
  this.targetSentences = this.data.pedagogical_payload.target_sentences;
  this.audioCues = this.data.audio_cues || [];
  this.unitMeta = this.data.unit_meta || {};

  // Game state
  this.mode = null;           // "multiple-choice" | "true-false"
  this.questions = [];
  this.currentQuestionIndex = 0;
  this.score = 0;
  this.attempts = 0;
  this.roundAttempts = 0;
  this.gameStartTime = 0;
  this.roundStartTime = 0;
  this.isFinished = false;

  // Mastery tracker — keyed by question ID
  this.mastery = null; // initialized when questions are generated
}

QuizTrueFalse.prototype.start = function () {
  LTB.UI.applyBaseStyles(this.root);
  this.root.classList.add('ltb-root');
  this._renderStartScreen();
};

// ===========================================================================
// START SCREEN
// ===========================================================================

QuizTrueFalse.prototype._renderStartScreen = function () {
  var self = this;
  this.root.innerHTML = '';

  // ---- Title ----
  var title = document.createElement('div');
  title.style.cssText = 'font-size:28px;font-weight:bold;text-align:center;margin:24px 0 8px;color:#1a1a1a;';
  title.textContent = 'Quiz Time';
  LTB.UI.makeSpeakable(title, 'Quiz Time', this.audio);
  this.root.appendChild(title);

  // ---- Subtitle ----
  var subtitle = document.createElement('div');
  subtitle.style.cssText = 'font-size:16px;color:#666;text-align:center;margin-bottom:24px;';
  subtitle.textContent = 'Theme: ' + (this.unitMeta.theme || 'Vocabulary');
  LTB.UI.makeSpeakable(subtitle, 'Theme: ' + (this.unitMeta.theme || 'Vocabulary'), this.audio);
  this.root.appendChild(subtitle);

  // ---- Instruction card ----
  var card = document.createElement('div');
  card.className = 'ltb-card';
  var instruction = document.createElement('div');
  instruction.style.cssText = 'font-size:16px;line-height:1.5;margin-bottom:16px;';
  instruction.textContent = 'Read each question. Tap to hear it. Then choose your answer.';
  LTB.UI.makeSpeakable(instruction, 'Read each question. Tap to hear it. Then choose your answer.', this.audio);
  instruction.addEventListener('click', function () {
    self.audio.speakWithCues('Read each question. Tap to hear it. Then choose your answer.', 'instruction', self.audioCues);
  });
  card.appendChild(instruction);
  this.root.appendChild(card);

  // ---- Mode selection ----
  var modeLabel = document.createElement('div');
  modeLabel.style.cssText = 'font-size:14px;color:#666;margin:16px 0 8px;';
  modeLabel.textContent = 'Choose a mode:';
  LTB.UI.makeSpeakable(modeLabel, 'Choose a mode to begin.', this.audio);
  this.root.appendChild(modeLabel);

  // Multiple Choice button
  var mcBtn = document.createElement('button');
  mcBtn.className = 'ltb-button';
  mcBtn.style.borderColor = '#2563eb';
  mcBtn.style.color = '#2563eb';
  var mcLabel = document.createElement('span');
  mcLabel.textContent = '📝 Multiple Choice';
  mcLabel.style.cssText = 'flex:1;text-align:left;';
  mcBtn.appendChild(mcLabel);
  var mcListen = LTB.UI.makeListenButton('Multiple Choice. Tap the correct answer.', this.audio);
  mcListen.addEventListener('click', function (e) {
    e.stopPropagation();
    self.audio.speakWithCues('Multiple Choice. Tap the correct answer.', 'instruction', self.audioCues);
  });
  mcBtn.appendChild(mcListen);
  mcBtn.addEventListener('click', function (e) {
    if (e.target === mcListen || mcListen.contains(e.target)) return;
    self._startGame('multiple-choice');
  });
  this.root.appendChild(mcBtn);

  // True/False button
  var tfBtn = document.createElement('button');
  tfBtn.className = 'ltb-button';
  tfBtn.style.borderColor = '#16a34a';
  tfBtn.style.color = '#16a34a';
  var tfLabel = document.createElement('span');
  tfLabel.textContent = '✓✗ True or False';
  tfLabel.style.cssText = 'flex:1;text-align:left;';
  tfBtn.appendChild(tfLabel);
  var tfListen = LTB.UI.makeListenButton('True or False. Tap True or False.', this.audio);
  tfListen.addEventListener('click', function (e) {
    e.stopPropagation();
    self.audio.speakWithCues('True or False. Tap True or False.', 'instruction', self.audioCues);
  });
  tfBtn.appendChild(tfListen);
  tfBtn.addEventListener('click', function (e) {
    if (e.target === tfListen || tfListen.contains(e.target)) return;
    self._startGame('true-false');
  });
  this.root.appendChild(tfBtn);
};

// ===========================================================================
// GAME START
// ===========================================================================

QuizTrueFalse.prototype._startGame = function (mode) {
  var self = this;
  this.mode = mode;
  this.questions = QuizQuestionGenerator.generate(this.data.pedagogical_payload, mode);
  this.currentQuestionIndex = 0;
  this.score = 0;
  this.attempts = 0;
  this.roundAttempts = 0;
  this.isFinished = false;
  this.gameStartTime = Date.now();
  this.eventLogger.start();

  // Initialize mastery tracker with question IDs
  this.mastery = new LTB.MasteryTracker(
    this.questions.map(function (q) { return q.id; }),
    this.eventLogger
  );

  this._emitGameStarted();
  this._renderQuestion();
};

// ===========================================================================
// EVENT EMISSION
// ===========================================================================

QuizTrueFalse.prototype._emitGameStarted = function () {
  this.eventLogger.emit({
    type: 'game_started',
    tenantId: this.unitMeta.tenant_id,
    gameMode: this.unitMeta.game_mode,
    engineId: this.unitMeta.engine_id,
    level: this.unitMeta.level,
    theme: this.unitMeta.theme,
    mode: this.mode,
    totalQuestions: this.questions.length,
    vocabularyCount: this.vocab.length,
    targetSentences: this.targetSentences,
  });
};

QuizTrueFalse.prototype._emitRoundShown = function (question) {
  this.eventLogger.emit({
    type: 'round_shown',
    questionIndex: this.currentQuestionIndex,
    questionId: question.id,
    questionType: question.type,
    prompt: question.prompt,
    answer: question.answer,
    choices: question.choices || (question.type === 'true-false' ? [true, false] : undefined),
  });
};

QuizTrueFalse.prototype._emitAnswerSubmitted = function (selected, isCorrect) {
  this.eventLogger.emit({
    type: 'answer_submitted',
    questionIndex: this.currentQuestionIndex,
    questionId: this.questions[this.currentQuestionIndex].id,
    selected: selected,
    isCorrect: isCorrect,
    attemptNumber: this.roundAttempts,
    timeMs: Date.now() - this.roundStartTime,
  });
};

QuizTrueFalse.prototype._emitAnswerResult = function (isCorrect) {
  if (isCorrect) this.score++;
  this.eventLogger.emit({
    type: 'answer_result',
    questionIndex: this.currentQuestionIndex,
    correct: isCorrect,
    scoreDelta: isCorrect ? 1 : 0,
    newScore: this.score,
    attemptsThisRound: this.roundAttempts,
  });
};

QuizTrueFalse.prototype._emitGameCompleted = function () {
  this.eventLogger.emit({
    type: 'game_completed',
    mode: this.mode,
    totalQuestions: this.questions.length,
    correct: this.score,
    totalAttempts: this.attempts,
    accuracy: this.attempts > 0 ? this.score / this.attempts : 0,
    durationMs: Date.now() - this.gameStartTime,
    finalMastery: this.mastery.getAll(),
  });
};

// ===========================================================================
// RENDER QUESTION
// ===========================================================================

QuizTrueFalse.prototype._renderQuestion = function () {
  if (this.currentQuestionIndex >= this.questions.length) {
    this._renderCompletion();
    return;
  }
  var question = this.questions[this.currentQuestionIndex];
  this.roundAttempts = 0;
  this.roundStartTime = Date.now();
  this._emitRoundShown(question);

  this.root.innerHTML = '';

  // ---- Progress ----
  var progress = document.createElement('div');
  progress.className = 'ltb-progress';
  progress.textContent =
    'Question ' + (this.currentQuestionIndex + 1) + ' of ' + this.questions.length +
    '  ·  Score: ' + this.score;
  this.root.appendChild(progress);

  // ---- Mode badge ----
  var modeBadge = document.createElement('div');
  modeBadge.style.cssText = 'font-size:12px;color:#888;margin-bottom:8px;';
  modeBadge.textContent = question.type === 'multiple-choice' ? '📝 Multiple Choice' : '✓✗ True or False';
  this.root.appendChild(modeBadge);

  // ---- Question card ----
  var card = document.createElement('div');
  card.className = 'ltb-card';

  var questionRow = document.createElement('div');
  questionRow.className = 'ltb-prompt';
  var questionSpan = document.createElement('span');
  questionSpan.textContent = question.prompt;
  questionSpan.style.flex = '1';
  LTB.UI.makeSpeakable(questionSpan, question.prompt, this.audio);
  var self = this;
  questionSpan.addEventListener('click', function () {
    self.audio.speakWithCues(question.prompt, 'instruction', self.audioCues);
  });
  questionRow.appendChild(questionSpan);
  // Separate listen button for the question (constraint #4)
  var qListen = LTB.UI.makeListenButton(question.prompt, this.audio);
  qListen.addEventListener('click', function () {
    self.audio.speakWithCues(question.prompt, 'instruction', self.audioCues);
  });
  questionRow.appendChild(qListen);
  card.appendChild(questionRow);

  this.root.appendChild(card);

  // ---- Answer choices ----
  if (question.type === 'multiple-choice') {
    this._renderMultipleChoiceAnswers(question);
  } else {
    this._renderTrueFalseAnswers(question);
  }
};

QuizTrueFalse.prototype._renderMultipleChoiceAnswers = function (question) {
  var self = this;
  var label = document.createElement('div');
  label.style.cssText = 'font-size:12px;color:#888;margin:12px 0 4px;';
  label.textContent = 'Your choices:';
  this.root.appendChild(label);

  question.choices.forEach(function (choice) {
    var btn = document.createElement('button');
    btn.className = 'ltb-button';
    btn.type = 'button';

    var choiceSpan = document.createElement('span');
    choiceSpan.textContent = choice;
    choiceSpan.style.cssText = 'flex:1;text-align:left;';
    LTB.UI.makeSpeakable(choiceSpan, choice, self.audio);
    choiceSpan.addEventListener('click', function (e) {
      e.stopPropagation();
      self.audio.speakWithCues(choice, 'term', self.audioCues);
    });
    btn.appendChild(choiceSpan);

    var listenBtn = LTB.UI.makeListenButton(choice, self.audio);
    listenBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      self.audio.speakWithCues(choice, 'term', self.audioCues);
    });
    btn.appendChild(listenBtn);

    btn.addEventListener('click', function (e) {
      if (e.target === listenBtn || listenBtn.contains(e.target)) return;
      if (e.target === choiceSpan || choiceSpan.contains(e.target)) return;
      self._handleAnswer(choice, question.answer, question);
    });
    self.root.appendChild(btn);
  });
};

QuizTrueFalse.prototype._renderTrueFalseAnswers = function (question) {
  var self = this;
  var label = document.createElement('div');
  label.style.cssText = 'font-size:12px;color:#888;margin:12px 0 4px;';
  label.textContent = 'Your answer:';
  this.root.appendChild(label);

  [true, false].forEach(function (value) {
    var btn = document.createElement('button');
    btn.className = 'ltb-button';
    btn.type = 'button';
    var displayText = value ? '✓ True' : '✗ False';
    var speakText = value ? 'True' : 'False';

    var choiceSpan = document.createElement('span');
    choiceSpan.textContent = displayText;
    choiceSpan.style.cssText = 'flex:1;text-align:left;';
    LTB.UI.makeSpeakable(choiceSpan, speakText, self.audio);
    choiceSpan.addEventListener('click', function (e) {
      e.stopPropagation();
      self.audio.speakWithCues(speakText, 'term', self.audioCues);
    });
    btn.appendChild(choiceSpan);

    var listenBtn = LTB.UI.makeListenButton(speakText, self.audio);
    listenBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      self.audio.speakWithCues(speakText, 'term', self.audioCues);
    });
    btn.appendChild(listenBtn);

    btn.addEventListener('click', function (e) {
      if (e.target === listenBtn || listenBtn.contains(e.target)) return;
      if (e.target === choiceSpan || choiceSpan.contains(e.target)) return;
      self._handleAnswer(value, question.answer, question);
    });
    self.root.appendChild(btn);
  });
};

// ===========================================================================
// ANSWER HANDLING
// ===========================================================================

QuizTrueFalse.prototype._handleAnswer = function (selected, correctAnswer, question) {
  if (this.isFinished) return;
  var isCorrect;
  if (typeof selected === 'boolean') {
    isCorrect = selected === correctAnswer;
  } else {
    isCorrect = String(selected).toLowerCase() === String(correctAnswer).toLowerCase();
  }

  this.attempts++;
  this.roundAttempts++;
  this._emitAnswerSubmitted(selected, isCorrect);
  this._emitAnswerResult(isCorrect);

  if (isCorrect) {
    this.mastery.recordCorrect(question.id);
    this._showFeedback(true, question);
  } else {
    this.mastery.recordIncorrect(question.id);
    this._showFeedback(false, question);
  }
};

QuizTrueFalse.prototype._showFeedback = function (correct, question) {
  var self = this;
  var buttons = this.root.querySelectorAll('.ltb-button');
  buttons.forEach(function (b) { b.disabled = true; b.style.opacity = '0.5'; });

  var feedback = document.createElement('div');
  feedback.className = 'ltb-feedback ' + (correct ? 'correct' : 'incorrect');

  if (correct) {
    feedback.textContent = '✓ That is right!';
    LTB.UI.makeSpeakable(feedback, 'That is right.', this.audio);
    this.audio.speakWithCues('That is right.', 'feedback', this.audioCues);
  } else {
    // Child-safe, shame-free
    feedback.textContent = 'Not quite. Try again.';
    LTB.UI.makeSpeakable(feedback, 'Not quite. Try again.', this.audio);
    this.audio.speakWithCues('Not quite. Try again.', 'feedback', this.audioCues);
  }
  this.root.appendChild(feedback);

  if (correct) {
    setTimeout(function () {
      self.currentQuestionIndex++;
      self._renderQuestion();
    }, 1800);
  } else {
    setTimeout(function () {
      self.root.querySelectorAll('.ltb-button').forEach(function (b) {
        b.disabled = false;
        b.style.opacity = '1';
      });
      feedback.remove();
    }, 1500);
  }
};

// ===========================================================================
// COMPLETION SCREEN
// ===========================================================================

QuizTrueFalse.prototype._renderCompletion = function () {
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
  LTB.UI.makeSpeakable(title, 'All done. You completed ' + this.questions.length + ' questions.', this.audio);
  card.appendChild(title);

  var modeLabel = document.createElement('div');
  modeLabel.style.cssText = 'font-size:14px;color:#888;margin-bottom:8px;';
  modeLabel.textContent = this.mode === 'multiple-choice' ? '📝 Multiple Choice' : '✓✗ True or False';
  card.appendChild(modeLabel);

  var score = document.createElement('div');
  score.style.cssText = 'font-size:48px;font-weight:bold;color:#2563eb;margin:16px 0;';
  score.textContent = this.score + ' / ' + this.questions.length;
  LTB.UI.makeSpeakable(score, this.score + ' out of ' + this.questions.length + ' correct.', this.audio);
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

  // Play again button (same mode)
  var self = this;
  var restart = document.createElement('button');
  restart.className = 'ltb-button';
  restart.style.cssText = 'margin-top:16px;text-align:center;border-color:#16a34a;color:#16a34a;';
  restart.textContent = '↻ Play Again (' + (this.mode === 'multiple-choice' ? 'Multiple Choice' : 'True or False') + ')';
  restart.addEventListener('click', function () {
    self._startGame(self.mode);
  });
  card.appendChild(restart);

  // Back to mode selection
  var backBtn = document.createElement('button');
  backBtn.className = 'ltb-button';
  backBtn.style.cssText = 'margin-top:8px;text-align:center;border-color:#2563eb;color:#2563eb;font-size:14px;';
  backBtn.textContent = '← Choose Different Mode';
  backBtn.addEventListener('click', function () {
    self._renderStartScreen();
  });
  card.appendChild(backBtn);

  this.root.appendChild(card);
};
