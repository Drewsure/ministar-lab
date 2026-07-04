/**
 * Story Adventure — Living Textbook Prototype #05
 * ================================================
 * Inspired by: Life is Strange (narrative choices), Stardew Valley (daily life vocabulary),
 * and interactive fiction (branching narratives for ESL).
 *
 * MECHANIC:
 *   A branching narrative story where the student reads a chapter,
 *   then chooses what happens next. Each choice reinforces a vocabulary word.
 *   The story adapts based on choices — different paths lead to different endings.
 *
 * RESEARCH APPLIED:
 *   - Life is Strange: "slower-paced narrative excellent for teaching natural,
 *     conversational American English" (academic research)
 *   - Stardew Valley: "transforms everyday social interactions into powerful
 *     language lessons" — vocabulary around food, seasons, daily routines
 *   - Interactive fiction: "branching narratives lead to different outcomes"
 *   - Choice-driven: "students choose their own learning adventures"
 *
 * CONSTRAINTS: All 12 hard constraints satisfied.
 */

function StoryAdventure(rootSelector, inputData, options) {
  options = options || {};
  this.root = document.querySelector(rootSelector);
  this.data = inputData;
  this.onEvent = options.onEvent || function () {};

  this.audio = new LTB.AudioBus();
  this.sessionToken = LTB.UI.generateSessionToken();
  this.eventLogger = new LTB.EventLogger(this.sessionToken, this.onEvent);

  this.vocab = this.data.pedagogical_payload.vocabulary_terms;
  this.chapters = {};
  // Index chapters by ID
  (this.data.pedagogical_payload.story_chapters || []).forEach(function (ch) {
    this.chapters[ch.id] = ch;
  }.bind(this));
  this.audioCues = this.data.audio_cues || [];
  this.unitMeta = this.data.unit_meta || {};

  this.currentChapterId = 'ch1';
  this.choicesMade = [];
  this.vocabUsed = new Set();
  this.score = 0;
  this.isFinished = false;
  this.gameStartTime = 0;
}

StoryAdventure.prototype.start = function () {
  LTB.UI.applyBaseStyles(this.root);
  this.root.classList.add('ltb-root');
  this.eventLogger.start();
  this.gameStartTime = Date.now();
  this._emitGameStarted();
  this._renderChapter();
};

StoryAdventure.prototype._emitGameStarted = function () {
  this.eventLogger.emit({
    type: 'game_started',
    tenantId: this.unitMeta.tenant_id,
    gameMode: this.unitMeta.game_mode,
    totalChapters: Object.keys(this.chapters).length,
    vocabularyCount: this.vocab.length,
  });
};

StoryAdventure.prototype._emitRoundShown = function (chapter) {
  this.eventLogger.emit({
    type: 'round_shown',
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    narrative: this._fillNarrative(chapter.narrative),
    choices: chapter.choices.map(function (c) { return c.text; }),
  });
};

StoryAdventure.prototype._emitAnswerSubmitted = function (choice, chapter) {
  this.eventLogger.emit({
    type: 'answer_submitted',
    chapterId: chapter.id,
    selectedChoice: choice.text,
    vocabWord: choice.vocab,
    isCorrect: true, // all choices are "correct" — it's a story, not a quiz
  });
};

StoryAdventure.prototype._emitAnswerResult = function (choice) {
  this.score++;
  this.vocabUsed.add(choice.vocab);
  this.eventLogger.emit({
    type: 'answer_result',
    correct: true,
    scoreDelta: 1,
    newScore: this.score,
    vocabLearned: choice.vocab,
  });
  this.eventLogger.emit({
    type: 'mastery_updated',
    termId: choice.vocab,
    previousMastery: 0,
    newMastery: 1.0, // full mastery on use
    delta: 1.0,
  });
};

StoryAdventure.prototype._emitGameCompleted = function () {
  this.eventLogger.emit({
    type: 'game_completed',
    correct: this.score,
    totalAttempts: this.choicesMade.length,
    accuracy: 1.0,
    durationMs: Date.now() - this.gameStartTime,
    vocabularyLearned: Array.from(this.vocabUsed),
    storyPath: this.choicesMade,
  });
};

StoryAdventure.prototype._fillNarrative = function (narrative) {
  // Replace {term} with actual vocab words for display
  var filled = narrative;
  // Find all {term} placeholders and fill with vocab
  var terms = this.vocab;
  var termIdx = 0;
  filled = filled.replace(/\{term\}/g, function () {
    if (termIdx < terms.length) return terms[termIdx++];
    return '_____';
  });
  return filled;
};

StoryAdventure.prototype._renderChapter = function () {
  var self = this;
  var chapter = this.chapters[this.currentChapterId];

  if (!chapter || this.currentChapterId === 'END') {
    this._renderCompletion();
    return;
  }

  this._emitRoundShown(chapter);

  this.root.innerHTML = '';

  // Chapter title
  var title = document.createElement('div');
  title.style.cssText = 'font-size:22px;font-weight:bold;color:#2563eb;margin-bottom:12px;text-align:center;';
  title.textContent = '📖 ' + chapter.title;
  LTB.UI.makeSpeakable(title, chapter.title, this.audio);
  this.root.appendChild(title);

  // Narrative card
  var card = document.createElement('div');
  card.className = 'ltb-card';

  var narrative = document.createElement('div');
  narrative.style.cssText = 'font-size:17px;line-height:1.6;margin-bottom:16px;';
  var filledText = this._fillNarrative(chapter.narrative);
  narrative.textContent = filledText;
  LTB.UI.makeSpeakable(narrative, filledText, this.audio);
  this.root.appendChild(card);
  card.appendChild(narrative);

  // Listen button for narrative
  var listenRow = document.createElement('div');
  listenRow.style.cssText = 'display:flex;justify-content:center;margin-bottom:16px;';
  var listenBtn = LTB.UI.makeListenButton(filledText, this.audio);
  listenBtn.style.width = '48px';
  listenBtn.style.height = '48px';
  listenBtn.addEventListener('click', function () {
    self.audio.speakWithCues(filledText, 'instruction', self.audioCues);
  });
  listenRow.appendChild(listenBtn);
  card.appendChild(listenRow);

  // Choices
  var choicesLabel = document.createElement('div');
  choicesLabel.style.cssText = 'font-size:14px;color:#666;margin-bottom:8px;';
  choicesLabel.textContent = 'What do you choose?';
  card.appendChild(choicesLabel);

  chapter.choices.forEach(function (choice, i) {
    var btn = document.createElement('button');
    btn.className = 'ltb-button';
    btn.type = 'button';

    var label = document.createElement('span');
    label.textContent = choice.text;
    label.style.cssText = 'flex:1;text-align:left;';
    LTB.UI.makeSpeakable(label, choice.text, self.audio);
    label.addEventListener('click', function (e) {
      e.stopPropagation();
      self.audio.speakWithCues(choice.text, 'term', self.audioCues);
    });
    btn.appendChild(label);

    var choiceListen = LTB.UI.makeListenButton(choice.text, self.audio);
    choiceListen.addEventListener('click', function (e) {
      e.stopPropagation();
      self.audio.speakWithCues(choice.text, 'term', self.audioCues);
    });
    btn.appendChild(choiceListen);

    btn.addEventListener('click', function (e) {
      if (e.target === choiceListen || choiceListen.contains(e.target)) return;
      if (e.target === label || label.contains(e.target)) return;
      self._handleChoice(choice, chapter);
    });

    card.appendChild(btn);
  });

  this.root.appendChild(card);

  // Progress indicator
  var progress = document.createElement('div');
  progress.className = 'ltb-progress';
  progress.textContent = 'Words learned: ' + this.vocabUsed.size + ' / ' + this.vocab.length +
    '  ·  Choices made: ' + this.choicesMade.length;
  this.root.appendChild(progress);
};

StoryAdventure.prototype._handleChoice = function (choice, chapter) {
  if (this.isFinished) return;

  this._emitAnswerSubmitted(choice, chapter);
  this._emitAnswerResult(choice);
  this.choicesMade.push({ chapterId: chapter.id, choice: choice.text, vocab: choice.vocab });

  // Show consequence
  var self = this;
  var feedback = document.createElement('div');
  feedback.className = 'ltb-feedback correct';
  feedback.textContent = '✓ ' + choice.consequence;
  LTB.UI.makeSpeakable(feedback, choice.consequence, this.audio);
  this.audio.speakWithCues(choice.consequence, 'feedback', this.audioCues);
  this.root.appendChild(feedback);

  // Disable buttons
  var buttons = this.root.querySelectorAll('.ltb-button');
  buttons.forEach(function (b) { b.disabled = true; b.style.opacity = '0.5'; });

  // Move to next chapter
  setTimeout(function () {
    self.currentChapterId = choice.next;
    self._renderChapter();
  }, 2500);
};

StoryAdventure.prototype._renderCompletion = function () {
  this.isFinished = true;
  this._emitGameCompleted();

  this.root.innerHTML = '';
  var card = document.createElement('div');
  card.className = 'ltb-card';
  card.style.textAlign = 'center';

  var title = document.createElement('div');
  title.style.cssText = 'font-size:24px;font-weight:bold;margin-bottom:12px;';
  title.textContent = '📚 Story Complete!';
  LTB.UI.makeSpeakable(title, 'Story complete! You learned ' + this.vocabUsed.size + ' words!', this.audio);
  card.appendChild(title);

  var score = document.createElement('div');
  score.style.cssText = 'font-size:48px;font-weight:bold;color:#2563eb;margin:16px 0;';
  score.textContent = this.vocabUsed.size + ' / ' + this.vocab.length;
  LTB.UI.makeSpeakable(score, 'You learned ' + this.vocabUsed.size + ' out of ' + this.vocab.length + ' words!', this.audio);
  card.appendChild(score);

  // Story path summary
  var pathLabel = document.createElement('div');
  pathLabel.style.cssText = 'font-size:14px;color:#666;margin-top:16px;margin-bottom:8px;';
  pathLabel.textContent = 'Your story path:';
  card.appendChild(pathLabel);

  this.choicesMade.forEach(function (cm, i) {
    var step = document.createElement('div');
    step.style.cssText = 'font-size:13px;color:#555;padding:4px 0;text-align:left;';
    step.textContent = (i + 1) + '. ' + cm.choice + ' (learned: ' + cm.vocab + ')';
    LTB.UI.makeSpeakable(step, cm.choice, this.audio);
    card.appendChild(step);
  }.bind(this));

  // Badges
  var badges = [];
  if (this.vocabUsed.size === this.vocab.length) badges.push('🏆 WORD EXPLORER');
  if (this.choicesMade.length >= 4) badges.push('📖 STORY WALKER');
  badges.push('⭐ STORY COMPLETER');

  var badgeText = document.createElement('div');
  badgeText.style.cssText = 'font-size:14px;color:#fbbf24;font-weight:bold;margin-top:16px;';
  badgeText.textContent = badges.join('  ·  ');
  card.appendChild(badgeText);

  // Play again
  var self = this;
  var restart = document.createElement('button');
  restart.className = 'ltb-button';
  restart.style.cssText = 'margin-top:16px;text-align:center;border-color:#16a34a;color:#16a34a;';
  restart.textContent = '↻ Play Again (Different Choices!)';
  restart.addEventListener('click', function () {
    self.currentChapterId = 'ch1';
    self.choicesMade = [];
    self.vocabUsed = new Set();
    self.score = 0;
    self.isFinished = false;
    self.gameStartTime = Date.now();
    self.eventLogger.start();
    self._emitGameStarted();
    self._renderChapter();
  });
  card.appendChild(restart);

  this.root.appendChild(card);
};
