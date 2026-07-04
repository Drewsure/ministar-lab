/**
 * Monster Fighter — Living Textbook Prototype #06
 * ================================================
 * Turn-based RPG battle system where students cast spells (vocabulary words)
 * to defeat monsters. Each monster has a weakness — matching the weakness
 * teaches the vocabulary word and deals double damage.
 *
 * RESEARCH APPLIED:
 *   - Turn-based RPG: "clean mechanics, strategic combat" (game design research)
 *   - Pokemon-style weakness chart: match element to monster weakness
 *   - Vocabulary reinforcement: each spell = a vocabulary word
 *   - Spaced repetition: monsters reappear with different weaknesses
 *   - Progression: 6 monsters with increasing HP, ending with Dragon boss
 */

function MonsterFighter(rootSelector, inputData, options) {
  options = options || {};
  this.root = document.querySelector(rootSelector);
  this.data = inputData;
  this.onEvent = options.onEvent || function () {};

  this.audio = new LTB.AudioBus();
  this.sessionToken = LTB.UI.generateSessionToken();
  this.eventLogger = new LTB.EventLogger(this.sessionToken, this.onEvent);

  this.vocab = this.data.pedagogical_payload.vocabulary_terms;
  this.monsters = this.data.pedagogical_payload.monsters;
  this.spells = this.data.pedagogical_payload.spells;
  this.audioCues = this.data.audio_cues || [];
  this.unitMeta = this.data.unit_meta || {};

  this.currentMonsterIdx = 0;
  this.monsterHp = 0;
  this.playerHp = 5;
  this.maxPlayerHp = 5;
  this.score = 0;
  this.vocabLearned = new Set();
  this.isFinished = false;
  this.gameStartTime = 0;
  this.roundStartTime = 0;
  this.canAct = true;
}

MonsterFighter.prototype.start = function () {
  LTB.UI.applyBaseStyles(this.root);
  this.root.classList.add('ltb-root');
  this.root.style.background = '#1a1a2e';
  this.root.style.color = '#fff';
  this.eventLogger.start();
  this.gameStartTime = Date.now();
  this._emitGameStarted();
  this._renderBattle();
};

MonsterFighter.prototype._emitGameStarted = function () {
  this.eventLogger.emit({
    type: 'game_started', timestamp: 0,
    tenantId: this.unitMeta.tenant_id, gameMode: this.unitMeta.game_mode,
    totalMonsters: this.monsters.length, vocabularyCount: this.vocab.length,
  });
};

MonsterFighter.prototype._emitRoundShown = function (monster) {
  this.eventLogger.emit({
    type: 'round_shown', roundIndex: this.currentMonsterIdx,
    monsterName: monster.name, monsterHp: this.monsterHp,
    weakness: monster.weakness,
  });
};

MonsterFighter.prototype._emitAnswerSubmitted = function (spell, isEffective) {
  this.eventLogger.emit({
    type: 'answer_submitted', roundIndex: this.currentMonsterIdx,
    spellName: spell.name, element: spell.element,
    isCorrect: isEffective, timeMs: Date.now() - this.roundStartTime,
  });
};

MonsterFighter.prototype._emitAnswerResult = function (isEffective, monsterDefeated) {
  if (isEffective) this.score++;
  this.eventLogger.emit({
    type: 'answer_result', correct: isEffective,
    scoreDelta: isEffective ? 1 : 0, newScore: this.score,
    monsterDefeated: monsterDefeated,
  });
  if (monsterDefeated) {
    var monster = this.monsters[this.currentMonsterIdx];
    this.vocabLearned.add(monster.vocab_reward);
    this.eventLogger.emit({
      type: 'mastery_updated', termId: monster.vocab_reward,
      previousMastery: 0, newMastery: 1.0, delta: 1.0,
    });
  }
};

MonsterFighter.prototype._emitGameCompleted = function () {
  this.eventLogger.emit({
    type: 'game_completed', correct: this.score,
    totalAttempts: this.currentMonsterIdx + 1,
    accuracy: 1.0, durationMs: Date.now() - this.gameStartTime,
    vocabularyLearned: Array.from(this.vocabLearned),
  });
};

MonsterFighter.prototype._renderBattle = function () {
  var self = this;
  if (this.currentMonsterIdx >= this.monsters.length) {
    this._renderVictory();
    return;
  }

  var monster = this.monsters[this.currentMonsterIdx];
  if (this.monsterHp <= 0) this.monsterHp = monster.hp;
  this.roundStartTime = Date.now();
  this._emitRoundShown(monster);

  this.root.innerHTML = '';

  // Title
  var title = document.createElement('div');
  title.style.cssText = 'font-size:20px;font-weight:bold;text-align:center;margin-bottom:12px;color:#fbbf24;';
  title.textContent = '⚔️ Monster ' + (this.currentMonsterIdx + 1) + ' of ' + this.monsters.length;
  this.root.appendChild(title);

  // Monster display
  var monsterCard = document.createElement('div');
  monsterCard.style.cssText = 'background:#16213e;border-radius:12px;padding:20px;margin-bottom:16px;text-align:center;border:2px solid #e94560;';

  var monsterEmoji = document.createElement('div');
  monsterEmoji.style.cssText = 'font-size:64px;margin-bottom:8px;';
  monsterEmoji.textContent = monster.emoji;
  monsterCard.appendChild(monsterEmoji);

  var monsterName = document.createElement('div');
  monsterName.style.cssText = 'font-size:20px;font-weight:bold;margin-bottom:8px;';
  monsterName.textContent = monster.name;
  LTB.UI.makeSpeakable(monsterName, monster.name, this.audio);
  monsterCard.appendChild(monsterName);

  // HP bar
  var hpBar = document.createElement('div');
  hpBar.style.cssText = 'background:#333;border-radius:8px;height:24px;overflow:hidden;margin-bottom:8px;';
  var hpFill = document.createElement('div');
  hpFill.style.cssText = 'background:#e94560;height:100%;transition:width 0.3s;border-radius:8px;';
  hpFill.style.width = (this.monsterHp / monster.hp * 100) + '%';
  hpBar.appendChild(hpFill);
  monsterCard.appendChild(hpBar);

  var hpText = document.createElement('div');
  hpText.style.cssText = 'font-size:14px;color:#aaa;';
  hpText.textContent = 'HP: ' + this.monsterHp + ' / ' + monster.hp;
  monsterCard.appendChild(hpText);

  // Weakness hint
  var hint = document.createElement('div');
  hint.style.cssText = 'font-size:13px;color:#fbbf24;margin-top:8px;font-style:italic;';
  hint.textContent = '💡 Weakness: ' + monster.weakness;
  LTB.UI.makeSpeakable(hint, 'Weakness: ' + monster.weakness, this.audio);
  monsterCard.appendChild(hint);

  this.root.appendChild(monsterCard);

  // Player HP
  var playerHp = document.createElement('div');
  playerHp.style.cssText = 'text-align:center;font-size:14px;color:#22c55e;margin-bottom:12px;';
  playerHp.textContent = '❤️ Your HP: ' + this.playerHp + ' / ' + this.maxPlayerHp;
  this.root.appendChild(playerHp);

  // Spells
  var spellsLabel = document.createElement('div');
  spellsLabel.style.cssText = 'font-size:14px;color:#aaa;margin-bottom:8px;';
  spellsLabel.textContent = 'Choose a spell to cast:';
  this.root.appendChild(spellsLabel);

  this.spells.forEach(function (spell) {
    var btn = document.createElement('button');
    btn.className = 'ltb-button';
    btn.style.cssText = 'border-color:#533483;color:#e94560;background:#16213e;';
    if (!self.canAct) { btn.disabled = true; btn.style.opacity = '0.5'; }

    var label = document.createElement('span');
    label.textContent = spell.emoji + ' ' + spell.name;
    label.style.cssText = 'flex:1;text-align:left;';
    LTB.UI.makeSpeakable(label, spell.name, self.audio);
    label.addEventListener('click', function (e) {
      e.stopPropagation();
      self.audio.speakWithCues(spell.name, 'term', self.audioCues);
    });
    btn.appendChild(label);

    var spellListen = LTB.UI.makeListenButton(spell.name, self.audio);
    spellListen.addEventListener('click', function (e) {
      e.stopPropagation();
      self.audio.speakWithCues(spell.name, 'term', self.audioCues);
    });
    btn.appendChild(spellListen);

    btn.addEventListener('click', function (e) {
      if (e.target === spellListen || spellListen.contains(e.target)) return;
      if (e.target === label || label.contains(e.target)) return;
      self._castSpell(spell, monster);
    });

    self.root.appendChild(btn);
  });
};

MonsterFighter.prototype._castSpell = function (spell, monster) {
  if (!this.canAct || this.isFinished) return;
  this.canAct = false;

  var isEffective = spell.element === monster.weakness;
  var damage = isEffective ? spell.power * 2 : spell.power;

  this._emitAnswerSubmitted(spell, isEffective);

  this.monsterHp -= damage;
  if (this.monsterHp < 0) this.monsterHp = 0;

  var feedback = document.createElement('div');
  feedback.className = 'ltb-feedback ' + (isEffective ? 'correct' : 'neutral');
  if (isEffective) {
    feedback.textContent = '✨ SUPER EFFECTIVE! ' + spell.name + ' deals ' + damage + ' damage!';
    this.audio.speakWithCues('Super effective! ' + spell.name + ' deals ' + damage + ' damage!', 'feedback', this.audioCues);
  } else {
    feedback.textContent = spell.emoji + ' ' + spell.name + ' deals ' + damage + ' damage.';
    this.audio.speak(spell.name + ' deals ' + damage + ' damage.');
  }
  this.root.appendChild(feedback);

  var monsterDefeated = this.monsterHp <= 0;
  this._emitAnswerResult(isEffective, monsterDefeated);

  if (monsterDefeated) {
    // Monster defeated!
    var defeatMsg = document.createElement('div');
    defeatMsg.className = 'ltb-feedback correct';
    defeatMsg.textContent = '🎉 ' + monster.name + ' defeated! You learned: ' + monster.vocab_reward;
    LTB.UI.makeSpeakable(defeatMsg, monster.name + ' defeated! You learned the word: ' + monster.vocab_reward, this.audio);
    this.audio.speakWithCues('You learned the word: ' + monster.vocab_reward, 'term', this.audioCues);
    this.root.appendChild(defeatMsg);

    // Monster counter-attack (if not effective, player takes damage)
    if (!isEffective && this.playerHp > 0) {
      this.playerHp--;
    }

    var self = this;
    setTimeout(function () {
      self.currentMonsterIdx++;
      self.monsterHp = 0;
      self.canAct = true;
      self._renderBattle();
    }, 2500);
  } else {
    // Monster counter-attacks
    this.playerHp--;
    var counterMsg = document.createElement('div');
    counterMsg.className = 'ltb-feedback incorrect';
    counterMsg.textContent = '💥 ' + monster.name + ' attacks! You lose 1 HP!';
    this.root.appendChild(counterMsg);

    if (this.playerHp <= 0) {
      // Game over
      var self2 = this;
      setTimeout(function () { self2._renderDefeat(); }, 2000);
      return;
    }

    // Re-render battle
    var self3 = this;
    setTimeout(function () {
      self3.canAct = true;
      self3._renderBattle();
    }, 2000);
  }
};

MonsterFighter.prototype._renderVictory = function () {
  this.isFinished = true;
  this._emitGameCompleted();
  this.root.innerHTML = '';

  var card = document.createElement('div');
  card.className = 'ltb-card';
  card.style.textAlign = 'center';
  card.style.background = '#16213e';
  card.style.color = '#fff';

  var title = document.createElement('div');
  title.style.cssText = 'font-size:28px;font-weight:bold;margin-bottom:12px;color:#fbbf24;';
  title.textContent = '🏆 VICTORY! Dragon Defeated!';
  LTB.UI.makeSpeakable(title, 'Victory! You defeated all monsters and learned ' + this.vocabLearned.size + ' words!', this.audio);
  card.appendChild(title);

  var score = document.createElement('div');
  score.style.cssText = 'font-size:48px;font-weight:bold;color:#22c55e;margin:16px 0;';
  score.textContent = this.vocabLearned.size + ' / ' + this.vocab.length + ' words';
  card.appendChild(score);

  // Words learned
  var wordsLabel = document.createElement('div');
  wordsLabel.style.cssText = 'font-size:14px;color:#aaa;margin-top:16px;';
  wordsLabel.textContent = 'Words mastered: ' + Array.from(this.vocabLearned).join(', ');
  card.appendChild(wordsLabel);

  // Badges
  var badges = [];
  if (this.vocabLearned.size === this.vocab.length) badges.push('🏆 WORD MASTER');
  if (this.playerHp === this.maxPlayerHp) badges.push('🛡️ FLAWLESS');
  if (this.currentMonsterIdx >= 6) badges.push('🐉 DRAGON SLAYER');
  badges.push('⭐ MONSTER FIGHTER');

  var badgeText = document.createElement('div');
  badgeText.style.cssText = 'font-size:14px;color:#fbbf24;font-weight:bold;margin-top:16px;';
  badgeText.textContent = badges.join('  ·  ');
  card.appendChild(badgeText);

  var self = this;
  var restart = document.createElement('button');
  restart.className = 'ltb-button';
  restart.style.cssText = 'margin-top:16px;border-color:#22c55e;color:#22c55e;';
  restart.textContent = '↻ Battle Again';
  restart.addEventListener('click', function () {
    self.currentMonsterIdx = 0; self.monsterHp = 0;
    self.playerHp = self.maxPlayerHp; self.score = 0;
    self.vocabLearned = new Set(); self.isFinished = false;
    self.canAct = true; self.gameStartTime = Date.now();
    self.eventLogger.start(); self._emitGameStarted(); self._renderBattle();
  });
  card.appendChild(restart);
  this.root.appendChild(card);
};

MonsterFighter.prototype._renderDefeat = function () {
  this.isFinished = true;
  this.root.innerHTML = '';

  var card = document.createElement('div');
  card.className = 'ltb-card';
  card.style.textAlign = 'center';
  card.style.background = '#16213e';
  card.style.color = '#fff';

  var title = document.createElement('div');
  title.style.cssText = 'font-size:28px;font-weight:bold;margin-bottom:12px;color:#e94560;';
  title.textContent = '💀 Defeated!';
  LTB.UI.makeSpeakable(title, 'You were defeated! But you learned ' + this.vocabLearned.size + ' words. Try again!', this.audio);
  card.appendChild(title);

  var score = document.createElement('div');
  score.style.cssText = 'font-size:36px;font-weight:bold;color:#fbbf24;margin:16px 0;';
  score.textContent = this.vocabLearned.size + ' / ' + this.vocab.length + ' words';
  card.appendChild(score);

  var self = this;
  var restart = document.createElement('button');
  restart.className = 'ltb-button';
  restart.style.cssText = 'margin-top:16px;border-color:#e94560;color:#e94560;';
  restart.textContent = '↻ Try Again';
  restart.addEventListener('click', function () {
    self.currentMonsterIdx = 0; self.monsterHp = 0;
    self.playerHp = self.maxPlayerHp; self.score = 0;
    self.vocabLearned = new Set(); self.isFinished = false;
    self.canAct = true; self.gameStartTime = Date.now();
    self.eventLogger.start(); self._emitGameStarted(); self._renderBattle();
  });
  card.appendChild(restart);
  this.root.appendChild(card);
};
