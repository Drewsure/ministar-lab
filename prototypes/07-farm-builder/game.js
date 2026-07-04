/**
 * Farm Builder — Living Textbook Prototype #07
 * ================================================
 * Inspired by: Stardew Valley — "transforms everyday social interactions
 * into powerful language lessons. Ideal for learning vocabulary around food,
 * seasons, daily routines, and building relationships."
 *
 * MECHANIC:
 *   Step-by-step farm simulation. Each step teaches a vocabulary word
 *   through an interactive task (tap the seed, water the plant, etc.).
 *   The farm visually grows as the student progresses.
 *   10 tasks = 10 vocabulary words learned.
 */

function FarmBuilder(rootSelector, inputData, options) {
  options = options || {};
  this.root = document.querySelector(rootSelector);
  this.data = inputData;
  this.onEvent = options.onEvent || function () {};

  this.audio = new LTB.AudioBus();
  this.sessionToken = LTB.UI.generateSessionToken();
  this.eventLogger = new LTB.EventLogger(this.sessionToken, this.onEvent);

  this.vocab = this.data.pedagogical_payload.vocabulary_terms;
  this.tasks = this.data.pedagogical_payload.farm_tasks;
  this.audioCues = this.data.audio_cues || [];
  this.unitMeta = this.data.unit_meta || {};

  this.currentTaskIdx = 0;
  this.vocabLearned = new Set();
  this.farmVisuals = []; // emoji visuals accumulated on the farm
  this.score = 0;
  this.isFinished = false;
  this.gameStartTime = 0;
  this.taskStartTime = 0;
}

FarmBuilder.prototype.start = function () {
  LTB.UI.applyBaseStyles(this.root);
  this.root.classList.add('ltb-root');
  this.root.style.background = '#f0fdf4';
  this.eventLogger.start();
  this.gameStartTime = Date.now();
  this._emitGameStarted();
  this._renderTask();
};

FarmBuilder.prototype._emitGameStarted = function () {
  this.eventLogger.emit({
    type: 'game_started', timestamp: 0,
    tenantId: this.unitMeta.tenant_id, gameMode: this.unitMeta.game_mode,
    totalTasks: this.tasks.length, vocabularyCount: this.vocab.length,
  });
};

FarmBuilder.prototype._emitRoundShown = function (task) {
  this.eventLogger.emit({
    type: 'round_shown', roundIndex: this.currentTaskIdx,
    instruction: task.instruction, vocabWord: task.vocab,
  });
};

FarmBuilder.prototype._emitAnswerResult = function (task) {
  this.score++;
  this.vocabLearned.add(task.vocab);
  this.eventLogger.emit({
    type: 'answer_result', correct: true,
    scoreDelta: 1, newScore: this.score,
    vocabLearned: task.vocab,
  });
  this.eventLogger.emit({
    type: 'mastery_updated', termId: task.vocab,
    previousMastery: 0, newMastery: 1.0, delta: 1.0,
  });
};

FarmBuilder.prototype._emitGameCompleted = function () {
  this.eventLogger.emit({
    type: 'game_completed', correct: this.score,
    totalAttempts: this.tasks.length, accuracy: 1.0,
    durationMs: Date.now() - this.gameStartTime,
    vocabularyLearned: Array.from(this.vocabLearned),
  });
};

FarmBuilder.prototype._renderTask = function () {
  var self = this;
  if (this.currentTaskIdx >= this.tasks.length) {
    this._renderCompletion();
    return;
  }

  var task = this.tasks[this.currentTaskIdx];
  this.taskStartTime = Date.now();
  this._emitRoundShown(task);

  // Fill instruction with vocab word
  var instruction = task.instruction.replace(/\{term\}/g, task.vocab);

  this.root.innerHTML = '';

  // Farm visualization (accumulated emojis)
  var farmCard = document.createElement('div');
  farmCard.style.cssText = 'background:#dcfce7;border:2px solid #22c55e;border-radius:12px;padding:20px;margin-bottom:16px;text-align:center;min-height:80px;';

  if (this.farmVisuals.length === 0) {
    var empty = document.createElement('div');
    empty.style.cssText = 'font-size:14px;color:#666;';
    empty.textContent = '🚜 Your farm is empty. Let\'s start farming!';
    farmCard.appendChild(empty);
  } else {
    var farmDisplay = document.createElement('div');
    farmDisplay.style.cssText = 'font-size:36px;letter-spacing:8px;';
    farmDisplay.textContent = this.farmVisuals.join(' ');
    LTB.UI.makeSpeakable(farmDisplay, 'Your farm has: ' + this.vocabLearned.size + ' things growing', this.audio);
    farmCard.appendChild(farmDisplay);
  }
  this.root.appendChild(farmCard);

  // Task instruction
  var taskCard = document.createElement('div');
  taskCard.className = 'ltb-card';

  var taskNum = document.createElement('div');
  taskNum.style.cssText = 'font-size:12px;color:#666;margin-bottom:8px;';
  taskNum.textContent = 'Task ' + (this.currentTaskIdx + 1) + ' of ' + this.tasks.length;
  taskCard.appendChild(taskNum);

  var instructionEl = document.createElement('div');
  instructionEl.style.cssText = 'font-size:18px;font-weight:bold;margin-bottom:16px;line-height:1.4;';
  instructionEl.textContent = instruction;
  LTB.UI.makeSpeakable(instructionEl, instruction, this.audio);
  instructionEl.addEventListener('click', function () {
    self.audio.speakWithCues(instruction, 'instruction', self.audioCues);
  });
  taskCard.appendChild(instructionEl);

  // Listen button
  var listenRow = document.createElement('div');
  listenRow.style.cssText = 'display:flex;justify-content:center;margin-bottom:16px;';
  var listenBtn = LTB.UI.makeListenButton(instruction, this.audio);
  listenBtn.style.width = '48px';
  listenBtn.style.height = '48px';
  listenBtn.addEventListener('click', function () {
    self.audio.speakWithCues(instruction, 'instruction', self.audioCues);
  });
  listenRow.appendChild(listenBtn);
  taskCard.appendChild(listenRow);

  // Interactive button (tap to complete task)
  var actionBtn = document.createElement('button');
  actionBtn.className = 'ltb-button';
  actionBtn.style.cssText = 'border-color:#22c55e;color:#22c55e;font-size:20px;text-align:center;';
  actionBtn.textContent = task.emoji + ' Tap here!';
  actionBtn.addEventListener('click', function () {
    self._completeTask(task);
  });
  taskCard.appendChild(actionBtn);

  this.root.appendChild(taskCard);

  // Progress
  var progress = document.createElement('div');
  progress.className = 'ltb-progress';
  progress.textContent = 'Words learned: ' + this.vocabLearned.size + ' / ' + this.vocab.length;
  this.root.appendChild(progress);
};

FarmBuilder.prototype._completeTask = function (task) {
  if (this.isFinished) return;
  this._emitAnswerResult(task);
  this.farmVisuals.push(task.emoji);

  // Speak the vocab word
  this.audio.speakWithCues(task.vocab, 'term', this.audioCues);

  // Feedback
  var self = this;
  var feedback = document.createElement('div');
  feedback.className = 'ltb-feedback correct';
  feedback.textContent = '✓ Great! You learned: ' + task.vocab;
  LTB.UI.makeSpeakable(feedback, 'Great! You learned the word: ' + task.vocab, this.audio);
  this.root.appendChild(feedback);

  // Disable button
  var buttons = this.root.querySelectorAll('.ltb-button');
  buttons.forEach(function (b) { b.disabled = true; b.style.opacity = '0.5'; });

  setTimeout(function () {
    self.currentTaskIdx++;
    self._renderTask();
  }, 2000);
};

FarmBuilder.prototype._renderCompletion = function () {
  this.isFinished = true;
  this._emitGameCompleted();
  this.root.innerHTML = '';

  var card = document.createElement('div');
  card.className = 'ltb-card';
  card.style.textAlign = 'center';

  var title = document.createElement('div');
  title.style.cssText = 'font-size:24px;font-weight:bold;margin-bottom:12px;color:#22c55e;';
  title.textContent = '🌾 Farm Complete!';
  LTB.UI.makeSpeakable(title, 'Farm complete! You learned ' + this.vocabLearned.size + ' words and built a beautiful farm!', this.audio);
  card.appendChild(title);

  // Final farm display
  var farmFinal = document.createElement('div');
  farmFinal.style.cssText = 'font-size:48px;letter-spacing:8px;margin:16px 0;';
  farmFinal.textContent = this.farmVisuals.join(' ');
  card.appendChild(farmFinal);

  var score = document.createElement('div');
  score.style.cssText = 'font-size:36px;font-weight:bold;color:#22c55e;margin:16px 0;';
  score.textContent = this.vocabLearned.size + ' / ' + this.vocab.length + ' words';
  card.appendChild(score);

  // Words learned
  var wordsLabel = document.createElement('div');
  wordsLabel.style.cssText = 'font-size:14px;color:#666;margin-top:12px;';
  wordsLabel.textContent = 'Words mastered: ' + Array.from(this.vocabLearned).join(', ');
  card.appendChild(wordsLabel);

  // Badges
  var badges = ['⭐ FARMER', '🌱 FIRST HARVEST'];
  if (this.vocabLearned.size === this.vocab.length) badges.push('🏆 MASTER FARMER');

  var badgeText = document.createElement('div');
  badgeText.style.cssText = 'font-size:14px;color:#22c55e;font-weight:bold;margin-top:16px;';
  badgeText.textContent = badges.join('  ·  ');
  card.appendChild(badgeText);

  var self = this;
  var restart = document.createElement('button');
  restart.className = 'ltb-button';
  restart.style.cssText = 'margin-top:16px;border-color:#22c55e;color:#22c55e;';
  restart.textContent = '↻ Start New Farm';
  restart.addEventListener('click', function () {
    self.currentTaskIdx = 0; self.vocabLearned = new Set();
    self.farmVisuals = []; self.score = 0; self.isFinished = false;
    self.gameStartTime = Date.now(); self.eventLogger.start();
    self._emitGameStarted(); self._renderTask();
  });
  card.appendChild(restart);
  this.root.appendChild(card);
};
