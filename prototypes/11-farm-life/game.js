/**
 * Farm Life — Prototype #11 (Stardew Valley-inspired ESL Reward Game)
 * ====================================================================
 * UNLOCKED as a reward when student completes a unit. Play for limited time.
 *
 * RESEARCH APPLIED:
 *   - Stardew Valley: "transforms everyday social interactions into powerful
 *     language lessons — vocabulary around food, seasons, daily routines"
 *   - "Stardew Valley is in fact an educational and learning game" (Medium)
 *   - JSdewValley / jhvozdovich/stardew_harvest_crossing: Phaser-based farming
 *   - Reward mechanics: "students access reward game after achieving progression"
 *
 * MECHANIC:
 *   4x4 farm grid. Student selects a tool (seed/water/sun/soil/harvest/market),
 *   then taps a grid cell to apply it. Crops grow through stages:
 *   Empty → Seed → Watered → Sunny → Growing → Ready → Harvest → Sell
 *   Each action teaches a vocabulary word. Selling crops earns coins.
 *   Day/night cycle. Season changes every 60 seconds.
 *
 * This is a SIMPLIFIED standalone version — the full JSdewValley integration
 * would require cloning that repo into Drewsure/JSdewValley and adapting it.
 */

function FarmLife(rootSelector, inputData, options) {
  options = options || {};
  this.root = document.querySelector(rootSelector);
  this.data = inputData;
  this.onEvent = options.onEvent || function(){};
  this.audio = new LTB.AudioBus();
  this.sessionToken = LTB.UI.generateSessionToken();
  this.eventLogger = new LTB.EventLogger(this.sessionToken, this.onEvent);
  this.vocab = this.data.pedagogical_payload.vocabulary_terms;
  this.crops = this.data.pedagogical_payload.crops;
  this.tools = this.data.pedagogical_payload.tools;
  this.gridSize = this.data.pedagogical_payload.farm_grid_size || 4;
  this.audioCues = this.data.audio_cues || [];
  this.unitMeta = this.data.unit_meta || {};

  this.grid = []; // 2D array of {state, crop, growthStage, watered, sunny}
  this.selectedTool = null;
  this.coins = 0;
  this.day = 1;
  this.season = 'Spring';
  this.seasons = ['Spring', 'Summer', 'Fall', 'Winter'];
  this.seasonIdx = 0;
  this.vocabLearned = new Set();
  this.score = 0;
  this.isFinished = false;
  this.gameStartTime = 0;
  this.dayTimer = null;
  this.timeLeft = 180; // 3 minutes of farm time
}

FarmLife.prototype.start = function() {
  LTB.UI.applyBaseStyles(this.root);
  this.root.classList.add('ltb-root');
  this.root.style.background = '#f0fdf4';
  this.eventLogger.start();
  this.gameStartTime = Date.now();
  this.eventLogger.emit({type:'game_started',tenantId:this.unitMeta.tenant_id,gameMode:this.unitMeta.game_mode,vocabularyCount:this.vocab.length});
  this._initGrid();
  this._startDayCycle();
  this._render();
};

FarmLife.prototype._initGrid = function() {
  for (var y = 0; y < this.gridSize; y++) {
    this.grid[y] = [];
    for (var x = 0; x < this.gridSize; x++) {
      this.grid[y][x] = { state: 'empty', crop: null, growthStage: 0, watered: false, sunny: false };
    }
  }
};

FarmLife.prototype._startDayCycle = function() {
  var self = this;
  this.dayTimer = setInterval(function() {
    if (self.isFinished) { clearInterval(self.dayTimer); return; }
    self.timeLeft--;
    if (self.timeLeft <= 0) {
      clearInterval(self.dayTimer);
      self._renderCompletion();
      return;
    }
    // Advance growth on all cells
    for (var y = 0; y < self.gridSize; y++) {
      for (var x = 0; x < self.gridSize; x++) {
        var cell = self.grid[y][x];
        if (cell.state === 'growing' && cell.watered && cell.sunny) {
          cell.growthStage++;
          var crop = self.crops.find(function(c) { return c.name === cell.crop; });
          if (crop && cell.growthStage >= crop.growTime) {
            cell.state = 'ready';
          }
        }
      }
    }
    // Change season every 45 seconds
    if (self.timeLeft % 45 === 0 && self.timeLeft > 0) {
      self.seasonIdx = (self.seasonIdx + 1) % self.seasons.length;
      self.season = self.seasons[self.seasonIdx];
      self.vocabLearned.add('season');
      self.audio.speakWithCues('Season change: ' + self.season, 'term', self.audioCues);
    }
    self._render();
  }, 1000);
};

FarmLife.prototype._render = function() {
  var self = this;
  this.root.innerHTML = '';

  // Title bar
  var header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;';
  var title = document.createElement('div');
  title.style.cssText = 'font-size:20px;font-weight:bold;color:#22c55e;';
  title.textContent = '🌾 Farm Life';
  LTB.UI.makeSpeakable(title, 'Farm Life', this.audio);
  header.appendChild(title);

  var timer = document.createElement('div');
  timer.style.cssText = 'font-size:16px;font-weight:bold;color:' + (this.timeLeft < 30 ? '#ef4444' : '#fbbf24') + ';';
  timer.textContent = '⏱ ' + Math.floor(this.timeLeft / 60) + ':' + (this.timeLeft % 60).toString().padStart(2, '0');
  header.appendChild(timer);
  this.root.appendChild(header);

  // Stats bar
  var stats = document.createElement('div');
  stats.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;color:#666;';
  stats.innerHTML = '💰 Coins: ' + this.coins + '  ·  📅 Day ' + this.day + '  ·  🍂 ' + this.season +
    '  ·  📚 Words: ' + this.vocabLearned.size + '/' + this.vocab.length;
  this.root.appendChild(stats);

  // Farm grid
  var gridCard = document.createElement('div');
  gridCard.style.cssText = 'background:#dcfce7;border:2px solid #22c55e;border-radius:12px;padding:12px;margin-bottom:12px;';
  var gridEl = document.createElement('div');
  gridEl.style.cssText = 'display:grid;grid-template-columns:repeat(' + this.gridSize + ',1fr);gap:6px;';

  for (var y = 0; y < this.gridSize; y++) {
    for (var x = 0; x < this.gridSize; x++) {
      (function(cellY, cellX) {
        var cell = self.grid[cellY][cellX];
        var cellEl = document.createElement('div');
        cellEl.style.cssText = 'aspect-ratio:1;background:' + (cell.state === 'empty' ? '#f0fdf4' : '#bbf7d0') +
          ';border:2px solid #22c55e;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:28px;cursor:pointer;min-height:50px;';
        cellEl.textContent = self._getCellEmoji(cell);
        cellEl.addEventListener('click', function() { self._tapCell(cellY, cellX); });
        gridEl.appendChild(cellEl);
      })(y, x);
    }
  }
  gridCard.appendChild(gridEl);
  this.root.appendChild(gridCard);

  // Tool selection
  var toolsLabel = document.createElement('div');
  toolsLabel.style.cssText = 'font-size:13px;color:#666;margin-bottom:6px;';
  toolsLabel.textContent = 'Select a tool, then tap a grid cell:';
  this.root.appendChild(toolsLabel);

  var toolRow = document.createElement('div');
  toolRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;';
  this.tools.forEach(function(tool) {
    var btn = document.createElement('button');
    btn.style.cssText = 'flex:1;min-width:70px;padding:10px 6px;border:2px solid ' +
      (self.selectedTool === tool.action ? '#22c55e' : '#86efac') +
      ';border-radius:8px;background:' + (self.selectedTool === tool.action ? '#22c55e' : '#f0fdf4') +
      ';color:' + (self.selectedTool === tool.action ? '#fff' : '#22c55e') +
      ';font-size:14px;font-weight:bold;cursor:pointer;text-align:center;';
    btn.textContent = tool.emoji + ' ' + tool.name;
    LTB.UI.makeSpeakable(btn, tool.name, self.audio);
    btn.addEventListener('click', function(e) {
      if (e.target !== btn) return;
      self.selectedTool = tool.action;
      self.vocabLearned.add(tool.vocab);
      self.audio.speakWithCues(tool.name, 'term', self.audioCues);
      self.eventLogger.emit({type:'answer_submitted',tool:tool.action,vocab:tool.vocab,isCorrect:true});
      self.eventLogger.emit({type:'mastery_updated',termId:tool.vocab,previousMastery:0,newMastery:1.0,delta:1.0});
      self._render();
    });
    toolRow.appendChild(btn);
  });
  this.root.appendChild(toolRow);

  // Instructions
  var instr = document.createElement('div');
  instr.style.cssText = 'font-size:12px;color:#999;text-align:center;';
  if (this.selectedTool) {
    instr.textContent = '📌 Tool selected: ' + this.selectedTool + ' — tap a grid cell to use it!';
  } else {
    instr.textContent = '👆 Select a tool above to start farming!';
  }
  this.root.appendChild(instr);
};

FarmLife.prototype._getCellEmoji = function(cell) {
  if (cell.state === 'empty') return '🟫';
  if (cell.state === 'ready') {
    var crop = this.crops.find(function(c) { return c.name === cell.crop; });
    return crop ? crop.emoji : '🌾';
  }
  if (cell.state === 'growing') {
    if (cell.growthStage === 0) return '🌱';
    if (cell.growthStage === 1) return '🌿';
    return '🌾';
  }
  return '🟫';
};

FarmLife.prototype._tapCell = function(y, x) {
  if (!this.selectedTool || this.isFinished) return;
  var cell = this.grid[y][x];
  var tool = this.tools.find(function(t) { return t.action === self.selectedTool; });
  var self = this;

  switch (this.selectedTool) {
    case 'plant':
      if (cell.state === 'empty') {
        cell.state = 'growing';
        cell.crop = self.crops[Math.floor(Math.random() * self.crops.length)].name;
        cell.growthStage = 0;
        cell.watered = false;
        cell.sunny = false;
        self.vocabLearned.add('seed');
        self.audio.speakWithCues('seed', 'term', self.audioCues);
      }
      break;
    case 'water':
      if (cell.state === 'growing') {
        cell.watered = true;
        self.vocabLearned.add('water');
        self.audio.speakWithCues('water', 'term', self.audioCues);
      }
      break;
    case 'sun':
      if (cell.state === 'growing') {
        cell.sunny = true;
        self.vocabLearned.add('sun');
        self.audio.speakWithCues('sun', 'term', self.audioCues);
      }
      break;
    case 'soil':
      if (cell.state === 'empty') {
        self.vocabLearned.add('soil');
        self.audio.speakWithCues('soil', 'term', self.audioCues);
      }
      break;
    case 'harvest':
      if (cell.state === 'ready') {
        var crop = self.crops.find(function(c) { return c.name === cell.crop; });
        if (crop) {
          self.coins += crop.sellPrice;
          self.score++;
          self.vocabLearned.add(crop.vocab);
          self.audio.speakWithCues(crop.vocab, 'term', self.audioCues);
          self.eventLogger.emit({type:'answer_result',correct:true,scoreDelta:1,newScore:self.score,cropHarvested:cell.crop});
        }
        cell.state = 'empty';
        cell.crop = null;
        cell.growthStage = 0;
        cell.watered = false;
        cell.sunny = false;
      }
      break;
    case 'sell':
      // Sell mode = harvest + sell in one action
      if (cell.state === 'ready') {
        var crop2 = self.crops.find(function(c) { return c.name === cell.crop; });
        if (crop2) {
          self.coins += crop2.sellPrice;
          self.score++;
          self.vocabLearned.add('market');
          self.audio.speakWithCues('market', 'term', self.audioCues);
        }
        cell.state = 'empty';
        cell.crop = null;
        cell.growthStage = 0;
        cell.watered = false;
        cell.sunny = false;
      }
      break;
  }
  this._render();
};

FarmLife.prototype._renderCompletion = function() {
  this.isFinished = true;
  this.eventLogger.emit({type:'game_completed',correct:this.score,totalAttempts:this.score,accuracy:1.0,durationMs:Date.now()-this.gameStartTime,vocabularyLearned:Array.from(this.vocabLearned),coinsEarned:this.coins});
  this.root.innerHTML = '';
  var card = document.createElement('div');
  card.className = 'ltb-card';
  card.style.textAlign = 'center';

  var title = document.createElement('div');
  title.style.cssText = 'font-size:24px;font-weight:bold;color:#22c55e;margin-bottom:12px;';
  title.textContent = '🌾 Farm Time Over!';
  LTB.UI.makeSpeakable(title, 'Farm time over! You earned ' + this.coins + ' coins and learned ' + this.vocabLearned.size + ' words!', this.audio);
  card.appendChild(title);

  var coins = document.createElement('div');
  coins.style.cssText = 'font-size:48px;font-weight:bold;color:#fbbf24;margin:16px 0;';
  coins.textContent = '💰 ' + this.coins + ' coins';
  card.appendChild(coins);

  var crops = document.createElement('div');
  crops.style.cssText = 'font-size:18px;color:#22c55e;margin-bottom:8px;';
  crops.textContent = '🧺 Crops harvested: ' + this.score;
  card.appendChild(crops);

  var words = document.createElement('div');
  words.style.cssText = 'font-size:16px;color:#666;';
  words.textContent = '📚 Words learned: ' + this.vocabLearned.size + '/' + this.vocab.length;
  card.appendChild(words);

  if (this.vocabLearned.size > 0) {
    var wordList = document.createElement('div');
    wordList.style.cssText = 'font-size:13px;color:#999;margin-top:8px;';
    wordList.textContent = Array.from(this.vocabLearned).join(', ');
    card.appendChild(wordList);
  }

  // Badges
  var badges = ['⭐ FARMER'];
  if (this.coins >= 50) badges.push('💰 MERCHANT');
  if (this.coins >= 100) badges.push('🏆 WEALTHY FARMER');
  if (this.vocabLearned.size === this.vocab.length) badges.push('📚 WORD MASTER');
  if (this.score >= 10) badges.push('🌾 MASTER GROWER');
  var badgeEl = document.createElement('div');
  badgeEl.style.cssText = 'color:#22c55e;font-weight:bold;margin-top:12px;';
  badgeEl.textContent = badges.join('  ·  ');
  card.appendChild(badgeEl);

  var self = this;
  var restart = document.createElement('button');
  restart.className = 'ltb-button';
  restart.style.cssText = 'margin-top:16px;border-color:#22c55e;color:#22c55e;';
  restart.textContent = '↻ Play Again';
  restart.addEventListener('click', function() {
    self._initGrid();
    self.coins = 0; self.day = 1; self.score = 0;
    self.vocabLearned = new Set();
    self.seasonIdx = 0; self.season = 'Spring';
    self.timeLeft = 180; self.isFinished = false;
    self.gameStartTime = Date.now();
    self.eventLogger.start();
    self._startDayCycle();
    self._render();
  });
  card.appendChild(restart);
  this.root.appendChild(card);
};
