/**
 * Rhythm Tap — Prototype #09
 * Vocabulary words fall from top. Tap when they cross the hit line.
 * Perfect timing = 3 pts, Good = 2 pts, OK = 1 pt, Miss = 0 pts.
 * 10 words = 10 rounds. Speed increases per round.
 */
function RhythmTap(rootSelector, inputData, options) {
  options = options || {};
  this.root = document.querySelector(rootSelector);
  this.data = inputData;
  this.onEvent = options.onEvent || function(){};
  this.audio = new LTB.AudioBus();
  this.sessionToken = LTB.UI.generateSessionToken();
  this.eventLogger = new LTB.EventLogger(this.sessionToken, this.onEvent);
  this.vocab = this.data.pedagogical_payload.vocabulary_terms;
  this.audioCues = this.data.audio_cues || [];
  this.unitMeta = this.data.unit_meta || {};
  this.currentWordIdx = 0;
  this.score = 0;
  this.combo = 0;
  this.maxCombo = 0;
  this.vocabLearned = new Set();
  this.isFinished = false;
  this.gameStartTime = 0;
  this.wordY = 0;
  this.fallSpeed = 1;
  this.gameLoop = null;
  this.canTap = false;
  this.hitLineY = 70; // percentage from top
}

RhythmTap.prototype.start = function() {
  LTB.UI.applyBaseStyles(this.root);
  this.root.classList.add('ltb-root');
  this.root.style.background = '#0f0f23';
  this.root.style.color = '#fff';
  this.eventLogger.start();
  this.gameStartTime = Date.now();
  this.eventLogger.emit({type:'game_started',tenantId:this.unitMeta.tenant_id,gameMode:this.unitMeta.game_mode,totalWords:this.vocab.length});
  this._nextWord();
};

RhythmTap.prototype._nextWord = function() {
  var self = this;
  if (this.currentWordIdx >= this.vocab.length) { this._renderCompletion(); return; }
  var word = this.vocab[this.currentWordIdx];
  this.wordY = 0;
  this.fallSpeed = 0.8 + this.currentWordIdx * 0.08; // speeds up
  this.canTap = true;
  this.eventLogger.emit({type:'round_shown',roundIndex:this.currentWordIdx,word:word});

  if (this.gameLoop) clearInterval(this.gameLoop);
  this.gameLoop = setInterval(function() {
    if (self.isFinished) { clearInterval(self.gameLoop); return; }
    self.wordY += self.fallSpeed;
    if (self.wordY > 100) {
      // Missed
      clearInterval(self.gameLoop);
      self.combo = 0;
      self.audio.play('incorrect');
      self.eventLogger.emit({type:'answer_submitted',word:word,isCorrect:false,timing:'miss'});
      self.eventLogger.emit({type:'answer_result',correct:false,scoreDelta:0,newScore:self.score});
      self._showFeedback('miss', word);
      setTimeout(function() { self.currentWordIdx++; self._nextWord(); }, 1500);
    } else {
      self._renderGame(word);
    }
  }, 30);
};

RhythmTap.prototype._renderGame = function(word) {
  var self = this;
  this.root.innerHTML = '';

  // Title
  var title = document.createElement('div');
  title.style.cssText = 'font-size:18px;font-weight:bold;text-align:center;margin-bottom:4px;color:#a78bfa;';
  title.textContent = '🎵 Rhythm Tap — Word ' + (this.currentWordIdx + 1) + '/' + this.vocab.length;
  this.root.appendChild(title);

  // Score + combo
  var scoreRow = document.createElement('div');
  scoreRow.style.cssText = 'text-align:center;font-size:14px;margin-bottom:8px;color:#fbbf24;';
  scoreRow.textContent = 'Score: ' + this.score + (this.combo >= 2 ? '  ·  🔥 Combo x' + this.combo : '');
  this.root.appendChild(scoreRow);

  // Game area
  var gameArea = document.createElement('div');
  gameArea.style.cssText = 'background:#1a1a3e;border:2px solid #533483;border-radius:12px;height:300px;position:relative;overflow:hidden;margin-bottom:12px;';

  // Hit line
  var hitLine = document.createElement('div');
  hitLine.style.cssText = 'position:absolute;top:' + this.hitLineY + '%;left:0;right:0;height:3px;background:#22c55e;box-shadow:0 0 10px #22c55e;';
  gameArea.appendChild(hitLine);

  // Hit zone (perfect zone = ±5%)
  var hitZone = document.createElement('div');
  hitZone.style.cssText = 'position:absolute;top:' + (this.hitLineY - 5) + '%;left:0;right:0;height:10%;background:rgba(34,197,94,0.1);';
  gameArea.appendChild(hitZone);

  // Falling word
  var wordEl = document.createElement('div');
  wordEl.style.cssText = 'position:absolute;top:' + this.wordY + '%;left:50%;transform:translateX(-50%);font-size:28px;font-weight:bold;color:#fff;text-shadow:0 0 10px #a78bfa;transition:top 0.03s;';
  wordEl.textContent = word;
  LTB.UI.makeSpeakable(wordEl, word, this.audio);
  gameArea.appendChild(wordEl);

  this.root.appendChild(gameArea);

  // Tap button
  var tapBtn = document.createElement('button');
  tapBtn.className = 'ltb-button';
  tapBtn.style.cssText = 'border-color:#a78bfa;color:#a78bfa;font-size:20px;text-align:center;';
  tapBtn.textContent = '👆 TAP NOW!';
  tapBtn.addEventListener('click', function() {
    if (!self.canTap) return;
    self._handleTap(word);
  });
  this.root.appendChild(tapBtn);

  // Instructions
  var instr = document.createElement('div');
  instr.style.cssText = 'font-size:12px;color:#666;text-align:center;margin-top:8px;';
  instr.textContent = 'Tap when the word crosses the green line!';
  this.root.appendChild(instr);
};

RhythmTap.prototype._handleTap = function(word) {
  if (!this.canTap || this.isFinished) return;
  this.canTap = false;
  clearInterval(this.gameLoop);

  var dist = Math.abs(this.wordY - this.hitLineY);
  var timing, points;
  if (dist < 3) { timing = 'perfect'; points = 3; this.combo++; }
  else if (dist < 8) { timing = 'good'; points = 2; this.combo++; }
  else if (dist < 15) { timing = 'ok'; points = 1; this.combo = 0; }
  else { timing = 'miss'; points = 0; this.combo = 0; }

  // Combo bonus
  if (this.combo >= 3) points += 1;
  if (this.combo >= 5) points += 1;

  this.score += points;
  if (this.maxCombo < this.combo) this.maxCombo = this.combo;
  this.vocabLearned.add(word);

  if (timing === 'miss') {
    this.audio.play('incorrect');
  } else {
    this.audio.play('correct');
    this.audio.speakWithCues(word, 'term', this.audioCues);
  }

  this.eventLogger.emit({type:'answer_submitted',word:word,isCorrect:timing!=='miss',timing:timing});
  this.eventLogger.emit({type:'answer_result',correct:timing!=='miss',scoreDelta:points,newScore:this.score});
  this.eventLogger.emit({type:'mastery_updated',termId:word,previousMastery:0,newMastery:1.0,delta:1.0});

  var self = this;
  this._showFeedback(timing, word);
  setTimeout(function() { self.currentWordIdx++; self._nextWord(); }, 1500);
};

RhythmTap.prototype._showFeedback = function(timing, word) {
  var text, color;
  if (timing === 'perfect') { text = '✨ PERFECT! +3'; color = '#22c55e'; }
  else if (timing === 'good') { text = '✓ GOOD! +2'; color = '#fbbf24'; }
  else if (timing === 'ok') { text = 'OK +1'; color = '#a78bfa'; }
  else { text = '✗ MISS!'; color = '#ef4444'; }

  var fb = document.createElement('div');
  fb.className = 'ltb-feedback ' + (timing === 'miss' ? 'incorrect' : 'correct');
  fb.textContent = text + ' — ' + word;
  LTB.UI.makeSpeakable(fb, text + ' ' + word, this.audio);
  this.root.appendChild(fb);
};

RhythmTap.prototype._renderCompletion = function() {
  this.isFinished = true;
  this.eventLogger.emit({type:'game_completed',correct:this.score,totalAttempts:this.vocab.length,accuracy:this.score/(this.vocab.length*3),durationMs:Date.now()-this.gameStartTime,vocabularyLearned:Array.from(this.vocabLearned)});
  this.root.innerHTML = '';
  var card = document.createElement('div');
  card.className = 'ltb-card';
  card.style.textAlign = 'center';
  card.style.background = '#1a1a3e';
  card.style.color = '#fff';

  var title = document.createElement('div');
  title.style.cssText = 'font-size:24px;font-weight:bold;color:#a78bfa;margin-bottom:12px;';
  title.textContent = '🎵 Song Complete!';
  LTB.UI.makeSpeakable(title, 'Song complete! You scored ' + this.score + ' points with a max combo of ' + this.maxCombo + '!', this.audio);
  card.appendChild(title);

  var score = document.createElement('div');
  score.style.cssText = 'font-size:48px;font-weight:bold;color:#fbbf24;margin:16px 0;';
  score.textContent = this.score + ' pts';
  card.appendChild(score);

  var combo = document.createElement('div');
  combo.style.cssText = 'font-size:16px;color:#22c55e;margin-bottom:8px;';
  combo.textContent = '🔥 Max Combo: x' + this.maxCombo;
  card.appendChild(combo);

  var words = document.createElement('div');
  words.style.cssText = 'font-size:14px;color:#aaa;';
  words.textContent = 'Words learned: ' + this.vocabLearned.size + '/' + this.vocab.length;
  card.appendChild(words);

  var badges = ['⭐ MUSICIAN'];
  if (this.maxCombo >= 5) badges.push('🔥 ON A ROLL');
  if (this.maxCombo >= 8) badges.push('💎 RHYTHM MASTER');
  if (this.score >= this.vocab.length * 3) badges.push('🏆 PERFECT SCORE');
  var badgeEl = document.createElement('div');
  badgeEl.style.cssText = 'color:#fbbf24;font-weight:bold;margin-top:12px;';
  badgeEl.textContent = badges.join('  ·  ');
  card.appendChild(badgeEl);

  var self = this;
  var restart = document.createElement('button');
  restart.className = 'ltb-button';
  restart.style.cssText = 'border-color:#a78bfa;color:#a78bfa;margin-top:16px;';
  restart.textContent = '↻ Play Again';
  restart.addEventListener('click', function() {
    self.currentWordIdx = 0; self.score = 0; self.combo = 0; self.maxCombo = 0;
    self.vocabLearned = new Set(); self.isFinished = false; self.canTap = false;
    self.gameStartTime = Date.now(); self.eventLogger.start();
    self._nextWord();
  });
  card.appendChild(restart);
  this.root.appendChild(card);
};
