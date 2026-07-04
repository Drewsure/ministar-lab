/**
 * Tower Defense — Prototype #08
 * Vocab words are towers. Enemies carry wrong definitions.
 * Tap the correct vocab word to "shoot" the matching enemy.
 * 3 waves of increasing difficulty. Castle HP = lives.
 */
function TowerDefense(rootSelector, inputData, options) {
  options = options || {};
  this.root = document.querySelector(rootSelector);
  this.data = inputData;
  this.onEvent = options.onEvent || function(){};
  this.audio = new LTB.AudioBus();
  this.sessionToken = LTB.UI.generateSessionToken();
  this.eventLogger = new LTB.EventLogger(this.sessionToken, this.onEvent);
  this.vocab = this.data.pedagogical_payload.vocabulary_terms;
  this.waves = this.data.pedagogical_payload.waves;
  this.audioCues = this.data.audio_cues || [];
  this.unitMeta = this.data.unit_meta || {};
  this.castleHp = 5;
  this.maxCastleHp = 5;
  this.currentWave = 0;
  this.score = 0;
  this.vocabLearned = new Set();
  this.isFinished = false;
  this.gameStartTime = 0;
  this.enemies = []; // {word, emoji, x, y, hp, correct}
  this.canAct = true;
  this.gameLoop = null;
}

TowerDefense.prototype.start = function() {
  LTB.UI.applyBaseStyles(this.root);
  this.root.classList.add('ltb-root');
  this.root.style.background = '#1a1a2e';
  this.root.style.color = '#fff';
  this.eventLogger.start();
  this.gameStartTime = Date.now();
  this.eventLogger.emit({type:'game_started',tenantId:this.unitMeta.tenant_id,gameMode:this.unitMeta.game_mode,totalWaves:this.waves.length,vocabularyCount:this.vocab.length});
  this._startWave();
};

TowerDefense.prototype._startWave = function() {
  var self = this;
  if (this.currentWave >= this.waves.length) { this._renderVictory(); return; }
  var wave = this.waves[this.currentWave];
  this.enemies = [];
  var shuffledVocab = LTB.UI.shuffle(this.vocab);
  for (var i = 0; i < wave.count; i++) {
    var correctWord = shuffledVocab[i % shuffledVocab.length];
    this.enemies.push({
      word: correctWord,
      emoji: '👾',
      progress: -i * 0.2, // staggered start
      hp: 1,
      correct: true,
      reached: false
    });
  }
  this.canAct = true;
  this.eventLogger.emit({type:'round_shown',roundIndex:this.currentWave,enemyCount:wave.count,waveSpeed:wave.speed});
  this._renderBattle();

  // Game loop — enemies advance
  if (this.gameLoop) clearInterval(this.gameLoop);
  var waveSpeed = wave.speed;
  this.gameLoop = setInterval(function() {
    if (self.isFinished) { clearInterval(self.gameLoop); return; }
    var allReached = true;
    for (var i = 0; i < self.enemies.length; i++) {
      var e = self.enemies[i];
      if (!e.reached) {
        allReached = false;
        e.progress += 0.008 * waveSpeed;
        if (e.progress >= 1) {
          e.reached = true;
          self.castleHp--;
          self.audio.play('incorrect');
          if (self.castleHp <= 0) {
            clearInterval(self.gameLoop);
            self._renderDefeat();
            return;
          }
        }
      }
    }
    self._renderBattle();
    if (allReached) {
      clearInterval(self.gameLoop);
      self.currentWave++;
      self.eventLogger.emit({type:'answer_result',correct:true,scoreDelta:1,newScore:self.score,waveCleared:true});
      setTimeout(function() { self._startWave(); }, 1500);
    }
  }, 50);
};

TowerDefense.prototype._renderBattle = function() {
  if (this.isFinished) return;
  var self = this;
  this.root.innerHTML = '';

  // Title
  var title = document.createElement('div');
  title.style.cssText = 'font-size:18px;font-weight:bold;text-align:center;margin-bottom:8px;color:#fbbf24;';
  title.textContent = '🏰 Tower Defense — Wave ' + (this.currentWave + 1) + '/' + this.waves.length;
  this.root.appendChild(title);

  // Castle HP
  var hpRow = document.createElement('div');
  hpRow.style.cssText = 'text-align:center;margin-bottom:12px;font-size:16px;';
  hpRow.textContent = '❤️ Castle: ' + '🟩'.repeat(Math.max(0,this.castleHp)) + '⬜'.repeat(Math.max(0,this.maxCastleHp - this.castleHp));
  this.root.appendChild(hpRow);

  // Enemy path visualization
  var pathCard = document.createElement('div');
  pathCard.style.cssText = 'background:#16213e;border:1px solid #e94560;border-radius:8px;padding:12px;margin-bottom:12px;height:80px;position:relative;overflow:hidden;';
  this.enemies.forEach(function(e, i) {
    if (e.reached) return;
    var enemyEl = document.createElement('div');
    enemyEl.style.cssText = 'position:absolute;font-size:24px;transition:left 0.05s;left:' + (e.progress * 90) + '%;top:50%;transform:translateY(-50%);';
    enemyEl.textContent = e.emoji;
    pathCard.appendChild(enemyEl);

    var wordLabel = document.createElement('div');
    wordLabel.style.cssText = 'position:absolute;font-size:10px;color:#aaa;left:' + (e.progress * 90) + '%;top:75%;transform:translateX(-50%);';
    wordLabel.textContent = e.word;
    pathCard.appendChild(wordLabel);
  });
  // Castle at end
  var castle = document.createElement('div');
  castle.style.cssText = 'position:absolute;right:0;top:50%;transform:translateY(-50%);font-size:32px;';
  castle.textContent = '🏰';
  pathCard.appendChild(castle);
  this.root.appendChild(pathCard);

  // Instruction
  var instr = document.createElement('div');
  instr.style.cssText = 'font-size:13px;color:#aaa;text-align:center;margin-bottom:8px;';
  instr.textContent = 'Tap the word matching the enemy to shoot it!';
  this.root.appendChild(instr);

  // Vocab buttons (towers)
  var currentEnemies = this.enemies.filter(function(e) { return !e.reached; });
  var availableWords = currentEnemies.length > 0 ? currentEnemies.map(function(e) { return e.word; }) : this.vocab.slice(0, 4);
  // Add some wrong options
  var wrongOptions = this.vocab.filter(function(v) { return availableWords.indexOf(v) === -1; }).slice(0, 2);
  var allOptions = LTB.UI.shuffle(availableWords.concat(wrongOptions)).slice(0, Math.min(5, availableWords.length + 2));

  allOptions.forEach(function(word) {
    var btn = document.createElement('button');
    btn.className = 'ltb-button';
    btn.style.cssText = 'border-color:#533483;color:#e94560;background:#16213e;text-align:center;';
    if (!self.canAct) { btn.disabled = true; btn.style.opacity = '0.5'; }
    btn.textContent = word;
    LTB.UI.makeSpeakable(btn, word, self.audio);
    btn.addEventListener('click', function(e) {
      if (e.target !== btn) return;
      self._shootWord(word);
    });
    self.root.appendChild(btn);
  });
};

TowerDefense.prototype._shootWord = function(word) {
  if (!this.canAct || this.isFinished) return;
  // Find the closest enemy with this word
  var target = null;
  var maxProgress = -1;
  this.enemies.forEach(function(e) {
    if (!e.reached && e.word === word && e.progress > maxProgress) {
      maxProgress = e.progress;
      target = e;
    }
  });

  if (target) {
    target.reached = true;
    this.score++;
    this.vocabLearned.add(word);
    this.audio.play('correct');
    this.audio.speakWithCues(word, 'term', this.audioCues);
    this.eventLogger.emit({type:'answer_submitted',selectedWord:word,isCorrect:true});
    this.eventLogger.emit({type:'answer_result',correct:true,scoreDelta:1,newScore:this.score});
    this.eventLogger.emit({type:'mastery_updated',termId:word,previousMastery:0,newMastery:1.0,delta:1.0});
  } else {
    // Wrong — no matching enemy
    this.audio.play('incorrect');
    this.eventLogger.emit({type:'answer_submitted',selectedWord:word,isCorrect:false});
  }
  this._renderBattle();
};

TowerDefense.prototype._renderVictory = function() {
  this.isFinished = true;
  this.eventLogger.emit({type:'game_completed',correct:this.score,totalAttempts:this.score,accuracy:1.0,durationMs:Date.now()-this.gameStartTime,vocabularyLearned:Array.from(this.vocabLearned)});
  this.root.innerHTML = '';
  var card = document.createElement('div');
  card.className = 'ltb-card';
  card.style.textAlign = 'center';
  card.style.background = '#16213e';
  card.style.color = '#fff';
  var title = document.createElement('div');
  title.style.cssText = 'font-size:24px;font-weight:bold;color:#fbbf24;margin-bottom:12px;';
  title.textContent = '🏰 Castle Defended!';
  LTB.UI.makeSpeakable(title, 'Victory! You defended your castle and learned ' + this.vocabLearned.size + ' words!', this.audio);
  card.appendChild(title);
  var score = document.createElement('div');
  score.style.cssText = 'font-size:36px;color:#22c55e;margin:16px 0;';
  score.textContent = this.vocabLearned.size + '/' + this.vocab.length + ' words';
  card.appendChild(score);
  var badges = ['⭐ DEFENDER','🛡️ CASTLE GUARD'];
  if (this.castleHp === this.maxCastleHp) badges.push('💎 FLAWLESS DEFENSE');
  if (this.vocabLearned.size === this.vocab.length) badges.push('🏆 WORD WARRIOR');
  var badgeEl = document.createElement('div');
  badgeEl.style.cssText = 'color:#fbbf24;font-weight:bold;margin-top:12px;';
  badgeEl.textContent = badges.join('  ·  ');
  card.appendChild(badgeEl);
  var self = this;
  var restart = document.createElement('button');
  restart.className = 'ltb-button';
  restart.style.cssText = 'border-color:#22c55e;color:#22c55e;margin-top:16px;';
  restart.textContent = '↻ Defend Again';
  restart.addEventListener('click', function() {
    self.castleHp = self.maxCastleHp; self.currentWave = 0; self.score = 0;
    self.vocabLearned = new Set(); self.isFinished = false; self.canAct = true;
    self.gameStartTime = Date.now(); self.eventLogger.start();
    self.eventLogger.emit({type:'game_started',tenantId:self.unitMeta.tenant_id,gameMode:self.unitMeta.game_mode,totalWaves:self.waves.length,vocabularyCount:self.vocab.length});
    self._startWave();
  });
  card.appendChild(restart);
  this.root.appendChild(card);
};

TowerDefense.prototype._renderDefeat = function() {
  this.isFinished = true;
  this.root.innerHTML = '';
  var card = document.createElement('div');
  card.className = 'ltb-card';
  card.style.textAlign = 'center';
  card.style.background = '#16213e';
  card.style.color = '#fff';
  var title = document.createElement('div');
  title.style.cssText = 'font-size:24px;font-weight:bold;color:#e94560;margin-bottom:12px;';
  title.textContent = '💀 Castle Overrun!';
  LTB.UI.makeSpeakable(title, 'Your castle was overrun! But you learned ' + this.vocabLearned.size + ' words. Try again!', this.audio);
  card.appendChild(title);
  var score = document.createElement('div');
  score.style.cssText = 'font-size:28px;color:#fbbf24;margin:16px 0;';
  score.textContent = this.vocabLearned.size + '/' + this.vocab.length + ' words learned';
  card.appendChild(score);
  var self = this;
  var restart = document.createElement('button');
  restart.className = 'ltb-button';
  restart.style.cssText = 'border-color:#e94560;color:#e94560;margin-top:16px;';
  restart.textContent = '↻ Try Again';
  restart.addEventListener('click', function() {
    self.castleHp = self.maxCastleHp; self.currentWave = 0; self.score = 0;
    self.vocabLearned = new Set(); self.isFinished = false; self.canAct = true;
    self.gameStartTime = Date.now(); self.eventLogger.start();
    self._startWave();
  });
  card.appendChild(restart);
  this.root.appendChild(card);
};
