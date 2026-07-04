/**
 * Space Explorer — Prototype #10
 * Planet Hunters TESS inspired. Student "discovers" celestial bodies
 * by scanning star systems and matching vocabulary words.
 * Each correct match = new planet discovered + vocabulary learned.
 */
function SpaceExplorer(rootSelector, inputData, options) {
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
  this.currentRound = 0;
  this.score = 0;
  this.vocabLearned = new Set();
  this.planetsDiscovered = [];
  this.fuel = 100;
  this.isFinished = false;
  this.gameStartTime = 0;
  this.roundStartTime = 0;
}

SpaceExplorer.prototype.start = function() {
  LTB.UI.applyBaseStyles(this.root);
  this.root.classList.add('ltb-root');
  this.root.style.background = '#000';
  this.root.style.color = '#fff';
  this.eventLogger.start();
  this.gameStartTime = Date.now();
  this.eventLogger.emit({type:'game_started',tenantId:this.unitMeta.tenant_id,gameMode:this.unitMeta.game_mode,totalPlanets:this.vocab.length});
  this._renderRound();
};

SpaceExplorer.prototype._renderRound = function() {
  var self = this;
  if (this.currentRound >= this.vocab.length) { this._renderCompletion(); return; }

  var targetWord = this.vocab[this.currentRound];
  this.roundStartTime = Date.now();
  this.eventLogger.emit({type:'round_shown',roundIndex:this.currentRound,targetWord:targetWord});

  // Generate 4 options (1 correct + 3 wrong)
  var wrongOptions = this.vocab.filter(function(v) { return v !== targetWord; });
  var shuffled = LTB.UI.shuffle(wrongOptions).slice(0, 3);
  var options = LTB.UI.shuffle([targetWord].concat(shuffled));

  this.root.innerHTML = '';

  // Title
  var title = document.createElement('div');
  title.style.cssText = 'font-size:20px;font-weight:bold;text-align:center;margin-bottom:4px;color:#60a5fa;';
  title.textContent = '🚀 Space Explorer — System ' + (this.currentRound + 1) + '/' + this.vocab.length;
  this.root.appendChild(title);

  // Fuel + score
  var stats = document.createElement('div');
  stats.style.cssText = 'text-align:center;font-size:13px;margin-bottom:12px;color:#fbbf24;';
  stats.textContent = '⛽ Fuel: ' + this.fuel + '%  ·  🪐 Planets: ' + this.planetsDiscovered.length + '  ·  Score: ' + this.score;
  this.root.appendChild(stats);

  // Star system visualization
  var systemCard = document.createElement('div');
  systemCard.style.cssText = 'background:#0a0a1a;border:1px solid #533483;border-radius:12px;padding:20px;margin-bottom:12px;text-align:center;position:relative;height:140px;overflow:hidden;';

  // Starfield
  for (var i = 0; i < 15; i++) {
    var star = document.createElement('div');
    star.style.cssText = 'position:absolute;width:2px;height:2px;background:#fff;border-radius:50%;left:' + (Math.random()*100) + '%;top:' + (Math.random()*100) + '%;opacity:' + (0.3 + Math.random()*0.7) + ';';
    systemCard.appendChild(star);
  }

  // Central star
  var sun = document.createElement('div');
  sun.style.cssText = 'font-size:48px;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);';
  sun.textContent = '⭐';
  systemCard.appendChild(sun);

  // Unknown planet (to be discovered)
  var planet = document.createElement('div');
  planet.style.cssText = 'font-size:36px;position:absolute;left:75%;top:30%;opacity:0.4;';
  planet.textContent = '🪐';
  systemCard.appendChild(planet);

  // Scan prompt
  var scanText = document.createElement('div');
  scanText.style.cssText = 'position:absolute;bottom:8px;left:50%;transform:translateX(-50%);font-size:12px;color:#60a5fa;';
  scanText.textContent = '📡 Scanning... Identify the celestial body!';
  systemCard.appendChild(scanText);

  this.root.appendChild(systemCard);

  // Question
  var question = document.createElement('div');
  question.style.cssText = 'font-size:16px;text-align:center;margin-bottom:8px;color:#aaa;';
  question.textContent = 'What do you see in this star system?';
  LTB.UI.makeSpeakable(question, 'What do you see in this star system?', this.audio);
  this.root.appendChild(question);

  // Options
  var emojis = { star:'⭐', planet:'🪐', moon:'🌙', comet:'☄️', galaxy:'🌌', orbit:'🔄', rocket:'🚀', astronaut:'👨‍🚀', telescope:'🔭', universe:'🌠' };
  options.forEach(function(word) {
    var btn = document.createElement('button');
    btn.className = 'ltb-button';
    btn.style.cssText = 'border-color:#533483;color:#60a5fa;background:#0a0a1a;text-align:center;';
    var emoji = emojis[word] || '✨';
    btn.textContent = emoji + ' ' + word;
    LTB.UI.makeSpeakable(btn, word, self.audio);
    btn.addEventListener('click', function(e) {
      if (e.target !== btn) return;
      self._handleAnswer(word, targetWord, emoji);
    });
    self.root.appendChild(btn);
  });
};

SpaceExplorer.prototype._handleAnswer = function(selected, correct, emoji) {
  if (this.isFinished) return;
  var isCorrect = selected === correct;
  this.eventLogger.emit({type:'answer_submitted',roundIndex:this.currentRound,selected:selected,isCorrect:isCorrect,timeMs:Date.now()-this.roundStartTime});

  if (isCorrect) {
    this.score++;
    this.fuel = Math.max(0, this.fuel - 8);
    this.vocabLearned.add(correct);
    this.planetsDiscovered.push({ word: correct, emoji: emoji });
    this.audio.play('correct');
    this.audio.speakWithCues(correct, 'term', this.audioCues);
    this.eventLogger.emit({type:'answer_result',correct:true,scoreDelta:1,newScore:this.score});
    this.eventLogger.emit({type:'mastery_updated',termId:correct,previousMastery:0,newMastery:1.0,delta:1.0});

    var fb = document.createElement('div');
    fb.className = 'ltb-feedback correct';
    fb.textContent = '🪐 Planet discovered: ' + correct + '! +' + (1 + this.getSpeedBonus()) + ' discovery points!';
    LTB.UI.makeSpeakable(fb, 'Planet discovered: ' + correct + '!', this.audio);
    this.root.appendChild(fb);
  } else {
    this.fuel = Math.max(0, this.fuel - 15);
    this.audio.play('incorrect');
    this.eventLogger.emit({type:'answer_result',correct:false,scoreDelta:0,newScore:this.score});
    var fb2 = document.createElement('div');
    fb2.className = 'ltb-feedback incorrect';
    fb2.textContent = 'Not quite. The correct answer was: ' + correct;
    LTB.UI.makeSpeakable(fb2, 'Not quite. The correct answer was: ' + correct, this.audio);
    this.root.appendChild(fb2);
  }

  // Disable buttons
  var buttons = this.root.querySelectorAll('.ltb-button');
  buttons.forEach(function(b) { b.disabled = true; b.style.opacity = '0.5'; });

  // Check fuel
  if (this.fuel <= 0) {
    var self0 = this;
    setTimeout(function() { self0._renderDefeat(); }, 2000);
    return;
  }

  var self = this;
  setTimeout(function() {
    self.currentRound++;
    self._renderRound();
  }, 2000);
};

SpaceExplorer.prototype.getSpeedBonus = function() {
  var rt = Date.now() - this.roundStartTime;
  if (rt < 2000) return 2; if (rt < 4000) return 1; return 0;
};

SpaceExplorer.prototype._renderCompletion = function() {
  this.isFinished = true;
  this.eventLogger.emit({type:'game_completed',correct:this.score,totalAttempts:this.vocab.length,accuracy:this.score/this.vocab.length,durationMs:Date.now()-this.gameStartTime,vocabularyLearned:Array.from(this.vocabLearned)});
  this.root.innerHTML = '';
  var card = document.createElement('div');
  card.className = 'ltb-card';
  card.style.textAlign = 'center';
  card.style.background = '#0a0a1a';
  card.style.color = '#fff';

  var title = document.createElement('div');
  title.style.cssText = 'font-size:24px;font-weight:bold;color:#60a5fa;margin-bottom:12px;';
  title.textContent = '🌌 Mission Complete!';
  LTB.UI.makeSpeakable(title, 'Mission complete! You discovered ' + this.planetsDiscovered.length + ' planets and explored the universe!', this.audio);
  card.appendChild(title);

  // Planets discovered
  var planetsDisplay = document.createElement('div');
  planetsDisplay.style.cssText = 'font-size:36px;letter-spacing:8px;margin:16px 0;';
  planetsDisplay.textContent = this.planetsDiscovered.map(function(p) { return p.emoji; }).join(' ');
  card.appendChild(planetsDisplay);

  var score = document.createElement('div');
  score.style.cssText = 'font-size:36px;font-weight:bold;color:#fbbf24;margin:8px 0;';
  score.textContent = this.score + '/' + this.vocab.length + ' discovered';
  card.appendChild(score);

  var fuel = document.createElement('div');
  fuel.style.cssText = 'font-size:14px;color:#22c55e;';
  fuel.textContent = '⛽ Fuel remaining: ' + this.fuel + '%';
  card.appendChild(fuel);

  var words = document.createElement('div');
  words.style.cssText = 'font-size:13px;color:#aaa;margin-top:8px;';
  words.textContent = 'Words mastered: ' + Array.from(this.vocabLearned).join(', ');
  card.appendChild(words);

  var badges = ['⭐ EXPLORER'];
  if (this.fuel > 50) badges.push('⛽ FUEL EFFICIENT');
  if (this.score === this.vocab.length) badges.push('🏆 UNIVERSE MAPPED');
  if (this.fuel === 100) badges.push('💎 FLAWLESS MISSION');
  var badgeEl = document.createElement('div');
  badgeEl.style.cssText = 'color:#fbbf24;font-weight:bold;margin-top:12px;';
  badgeEl.textContent = badges.join('  ·  ');
  card.appendChild(badgeEl);

  var self = this;
  var restart = document.createElement('button');
  restart.className = 'ltb-button';
  restart.style.cssText = 'border-color:#60a5fa;color:#60a5fa;margin-top:16px;';
  restart.textContent = '↻ New Mission';
  restart.addEventListener('click', function() {
    self.currentRound = 0; self.score = 0; self.vocabLearned = new Set();
    self.planetsDiscovered = []; self.fuel = 100; self.isFinished = false;
    self.gameStartTime = Date.now(); self.eventLogger.start();
    self._renderRound();
  });
  card.appendChild(restart);
  this.root.appendChild(card);
};

SpaceExplorer.prototype._renderDefeat = function() {
  this.isFinished = true;
  this.root.innerHTML = '';
  var card = document.createElement('div');
  card.className = 'ltb-card';
  card.style.textAlign = 'center';
  card.style.background = '#0a0a1a';
  card.style.color = '#fff';
  var title = document.createElement('div');
  title.style.cssText = 'font-size:24px;font-weight:bold;color:#ef4444;margin-bottom:12px;';
  title.textContent = '🛰️ Fuel Depleted!';
  LTB.UI.makeSpeakable(title, 'Fuel depleted! You discovered ' + this.planetsDiscovered.length + ' planets before running out of fuel. Try again!', this.audio);
  card.appendChild(title);
  var score = document.createElement('div');
  score.style.cssText = 'font-size:28px;color:#fbbf24;margin:16px 0;';
  score.textContent = this.planetsDiscovered.length + '/' + this.vocab.length + ' discovered';
  card.appendChild(score);
  var self = this;
  var restart = document.createElement('button');
  restart.className = 'ltb-button';
  restart.style.cssText = 'border-color:#ef4444;color:#ef4444;margin-top:16px;';
  restart.textContent = '↻ Relaunch';
  restart.addEventListener('click', function() {
    self.currentRound = 0; self.score = 0; self.vocabLearned = new Set();
    self.planetsDiscovered = []; self.fuel = 100; self.isFinished = false;
    self.gameStartTime = Date.now(); self.eventLogger.start();
    self._renderRound();
  });
  card.appendChild(restart);
  this.root.appendChild(card);
};
