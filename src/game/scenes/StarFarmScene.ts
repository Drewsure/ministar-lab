import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';

// ============================================================================
// STAR FARM — AAA Stardew Valley Clone
// ============================================================================
// FEATURES:
//   • 16x10 tilemap farm with terrain types (grass, dirt, water, path, rock, tree)
//   • 4 seasons (Spring/Summer/Fall/Winter) — 28 days each, affects crops
//   • 12+ crops across seasons (parsnip, cauliflower, melon, blueberry, etc.)
//   • 6 tools: Hoe, Watering Can, Seeds, Harvest, Axe, Pickaxe
//   • Tool upgrades (Lv1-3) — buy at shop
//   • Animals: Chicken coop (eggs), Cow barn (milk) — feed daily
//   • Mining: rocks yield stone/ore/gems
//   • Foraging: wild berries/mushrooms spawn daily
//   • Fishing minigame: cast, wait, reel
//   • 5 NPCs with friendship/heart system + dialogue
//   • Cooking: combine crops into dishes for bonus energy
//   • Achievements system
//   • Day-end summary modal
//   • Save/load (localStorage)
//   • Energy system + weather + day/night cycle
// ============================================================================

type ToolType = 'hoe' | 'water' | 'seed' | 'harvest' | 'axe' | 'pickaxe';
type CropType = 'parsnip' | 'cauliflower' | 'potato' | 'strawberry' |
                'tomato' | 'blueberry' | 'melon' | 'corn' |
                'pumpkin' | 'grape' | 'carrot' | 'eggplant' |
                'starfruit' | 'sunflower' | 'coffee' | 'ancient';
type Season = 'spring' | 'summer' | 'fall' | 'winter';
type TerrainType = 'grass' | 'dirt' | 'water' | 'path' | 'rock' | 'tree' | 'forage' | 'house' | 'barn';
type CropStage = 'empty' | 'tilled' | 'watered' | 'seeded' | 'sprout' | 'growing' | 'ready';
type AnimalType = 'chicken' | 'cow' | 'sheep' | 'pig';

interface CropDef {
  name: string; emoji: string; seedPrice: number; sellPrice: number;
  growTime: number; seasons: Season[]; vocab: string;
}

interface Tile {
  x: number; y: number; row: number; col: number;
  terrain: TerrainType; stage: CropStage; cropType?: CropType; growth: number;
  forageType?: string; forageEmoji?: string;
  bg: Phaser.GameObjects.Rectangle; emoji: Phaser.GameObjects.Text;
  hp?: number; // for rocks/trees (hits to break)
}

interface NPC {
  name: string; emoji: string; x: number; y: number;
  type: 'shop' | 'quest' | 'friend' | 'fish' | 'cook';
  hearts: number; text: Phaser.GameObjects.Text;
}

interface Animal {
  type: AnimalType; x: number; y: number; text: Phaser.GameObjects.Text;
  fed: boolean; produceReady: boolean;
  emoji: string;
}

interface Festival {
  season: Season; day: number; name: string; emoji: string; reward: number;
}

interface Achievement {
  id: string; name: string; emoji: string; desc: string; unlocked: boolean;
}

const CROPS: Record<CropType, CropDef> = {
  // Spring crops
  parsnip:    { name: 'Parsnip',    emoji: '🥬', seedPrice: 10, sellPrice: 25,  growTime: 3, seasons: ['spring'], vocab: 'parsnip' },
  cauliflower:{ name: 'Cauliflower',emoji: '🥦', seedPrice: 15, sellPrice: 40,  growTime: 4, seasons: ['spring'], vocab: 'cauliflower' },
  potato:     { name: 'Potato',     emoji: '🥔', seedPrice: 8,  sellPrice: 20,  growTime: 3, seasons: ['spring'], vocab: 'potato' },
  strawberry: { name: 'Strawberry', emoji: '🍓', seedPrice: 12, sellPrice: 30,  growTime: 4, seasons: ['spring'], vocab: 'strawberry' },
  // Summer crops
  tomato:     { name: 'Tomato',     emoji: '🍅', seedPrice: 10, sellPrice: 25,  growTime: 4, seasons: ['summer'], vocab: 'tomato' },
  blueberry:  { name: 'Blueberry',  emoji: '🫐', seedPrice: 15, sellPrice: 35,  growTime: 4, seasons: ['summer'], vocab: 'blueberry' },
  melon:      { name: 'Melon',      emoji: '🍉', seedPrice: 20, sellPrice: 50,  growTime: 5, seasons: ['summer'], vocab: 'melon' },
  corn:       { name: 'Corn',       emoji: '🌽', seedPrice: 12, sellPrice: 28,  growTime: 5, seasons: ['summer','fall'], vocab: 'corn' },
  // Fall crops
  pumpkin:    { name: 'Pumpkin',    emoji: '🎃', seedPrice: 18, sellPrice: 45,  growTime: 5, seasons: ['fall'], vocab: 'pumpkin' },
  grape:      { name: 'Grape',      emoji: '🍇', seedPrice: 14, sellPrice: 32,  growTime: 4, seasons: ['fall'], vocab: 'grape' },
  carrot:     { name: 'Carrot',     emoji: '🥕', seedPrice: 8,  sellPrice: 18,  growTime: 3, seasons: ['fall'], vocab: 'carrot' },
  eggplant:   { name: 'Eggplant',   emoji: '🍆', seedPrice: 12, sellPrice: 28,  growTime: 4, seasons: ['fall'], vocab: 'eggplant' },
  // Special crops (all seasons or rare)
  starfruit:  { name: 'Starfruit',  emoji: '⭐', seedPrice: 50, sellPrice: 120, growTime: 7, seasons: ['summer'], vocab: 'starfruit' },
  sunflower:  { name: 'Sunflower',  emoji: '🌻', seedPrice: 10, sellPrice: 22,  growTime: 3, seasons: ['summer','fall'], vocab: 'sunflower' },
  coffee:     { name: 'Coffee',     emoji: '☕', seedPrice: 20, sellPrice: 45,  growTime: 5, seasons: ['spring','summer'], vocab: 'coffee' },
  ancient:    { name: 'Ancient Fruit', emoji: '🍇', seedPrice: 100, sellPrice: 250, growTime: 8, seasons: ['spring','summer','fall'], vocab: 'ancient' },
};

const TOOL_NAMES: Record<ToolType, string> = {
  hoe: 'Hoe', water: 'Watering Can', seed: 'Seeds', harvest: 'Harvest',
  axe: 'Axe', pickaxe: 'Pickaxe',
};

const TOOL_EMOJIS: Record<ToolType, string> = {
  hoe: '⛏️', water: '💧', seed: '🌱', harvest: '🧺', axe: '🪓', pickaxe: '⛏️',
};

const SEASON_NAMES: Record<Season, string> = {
  spring: '🌸 Spring', summer: '☀️ Summer', fall: '🍂 Fall', winter: '❄️ Winter',
};

const FORAGE_ITEMS = [
  { name: 'Dandelion', emoji: '🌼', price: 8 },
  { name: 'Mushroom', emoji: '🍄', price: 12 },
  { name: 'Berry', emoji: '🫐', price: 10 },
  { name: 'Leek', emoji: '🧅', price: 15 },
  { name: 'Acorn', emoji: '🌰', price: 6 },
];

const FISH_TYPES = [
  { name: 'Sardine', emoji: '🐟', price: 15 },
  { name: 'Salmon', emoji: '🐠', price: 40 },
  { name: 'Tuna', emoji: '🐟', price: 50 },
  { name: 'Carp', emoji: '🐡', price: 20 },
  { name: 'Catfish', emoji: '🐟', price: 35 },
  { name: 'Lobster', emoji: '🦞', price: 80 },
];

const COOKING_RECIPES = [
  { name: 'Salad', emoji: '🥗', ingredients: ['parsnip', 'tomato'], energy: 40, vocab: 'salad' },
  { name: 'Soup', emoji: '🍲', ingredients: ['potato', 'carrot'], energy: 50, vocab: 'soup' },
  { name: 'Pie', emoji: '🥧', ingredients: ['pumpkin', 'strawberry'], energy: 60, vocab: 'pie' },
  { name: 'Juice', emoji: '🧃', ingredients: ['blueberry', 'grape'], energy: 35, vocab: 'juice' },
  { name: 'Pizza', emoji: '🍕', ingredients: ['tomato', 'corn'], energy: 70, vocab: 'pizza' },
  { name: 'Bread', emoji: '🍞', ingredients: ['potato', 'eggplant'], energy: 45, vocab: 'bread' },
  { name: 'Wine', emoji: '🍷', ingredients: ['grape', 'ancient'], energy: 80, vocab: 'wine' },
  { name: 'Coffee Cup', emoji: '☕', ingredients: ['coffee'], energy: 55, vocab: 'coffee cup' },
  { name: 'Fruit Bowl', emoji: '🍓', ingredients: ['strawberry', 'blueberry', 'melon'], energy: 65, vocab: 'fruit bowl' },
  { name: 'Star Cake', emoji: '🎂', ingredients: ['starfruit', 'sunflower'], energy: 100, vocab: 'star cake' },
];

const FESTIVALS: Festival[] = [
  { season: 'spring', day: 14, name: 'Flower Festival', emoji: '🌸', reward: 100 },
  { season: 'summer', day: 14, name: 'Summer Luau', emoji: '🏝️', reward: 150 },
  { season: 'fall', day: 14, name: 'Harvest Fair', emoji: '🎃', reward: 200 },
  { season: 'winter', day: 14, name: 'Star Festival', emoji: '⭐', reward: 250 },
  { season: 'spring', day: 28, name: 'Spring Finale', emoji: '🌷', reward: 120 },
  { season: 'summer', day: 28, name: 'Summer Finale', emoji: '🌞', reward: 170 },
  { season: 'fall', day: 28, name: 'Fall Finale', emoji: '🍂', reward: 220 },
  { season: 'winter', day: 28, name: 'Winter Finale', emoji: '❄️', reward: 300 },
];

const SAVE_KEY = 'starfarm-aaa-save';

export default class StarFarmScene extends BaseEngine {
  // Grid
  private grid: Tile[][] = [];
  private readonly GRID_W = 16;
  private readonly GRID_H = 9;
  private readonly TILE = 44;
  private gridOffsetX = 0;
  private gridOffsetY = 0;

  // Player state
  private selectedTool: ToolType = 'hoe';
  private selectedCrop: CropType = 'parsnip';
  private toolLevel: Record<ToolType, number> = { hoe: 1, water: 1, seed: 1, harvest: 1, axe: 1, pickaxe: 1 };

  // Resources
  private coins = 100;
  private energy = 100;
  private maxEnergy = 100;
  private day = 1;
  private season: Season = 'spring';
  private dayProgress = 0;
  private weather: 'sunny' | 'rainy' = 'sunny';

  // Inventory
  private inventory: Partial<Record<CropType, number>> = {};
  private seedsOwned: Partial<Record<CropType, number>> = { parsnip: 5 };
  private forageInventory: Record<string, number> = {};
  private fishInventory: number = 0;
  private wood = 0;
  private stone = 0;
  private ore = 0;
  private cookedDishes: Record<string, number> = {};

  // Animals
  private animals: Animal[] = [];

  // NPCs
  private npcs: NPC[] = [];

  // Vocab
  private vocabLearned = new Set<string>();

  // Achievements
  private achievements: Achievement[] = [
    { id: 'first_harvest', name: 'First Harvest', emoji: '🌱', desc: 'Harvest your first crop', unlocked: false },
    { id: 'ten_crops', name: 'Farmer', emoji: '🌾', desc: 'Harvest 10 crops', unlocked: false },
    { id: 'fifty_crops', name: 'Master Farmer', emoji: '🏆', desc: 'Harvest 50 crops', unlocked: false },
    { id: 'hundred_coins', name: 'Rich', emoji: '💰', desc: 'Earn 100 coins', unlocked: false },
    { id: 'thousand_coins', name: 'Wealthy', emoji: '💎', desc: 'Earn 1000 coins', unlocked: false },
    { id: 'first_fish', name: 'Angler', emoji: '🎣', desc: 'Catch your first fish', unlocked: false },
    { id: 'ten_fish', name: 'Master Angler', emoji: '🐠', desc: 'Catch 10 fish', unlocked: false },
    { id: 'first_wood', name: 'Lumberjack', emoji: '🪓', desc: 'Chop your first tree', unlocked: false },
    { id: 'first_ore', name: 'Miner', emoji: '⛏️', desc: 'Mine your first ore', unlocked: false },
    { id: 'first_egg', name: 'Rancher', emoji: '🥚', desc: 'Collect your first egg', unlocked: false },
    { id: 'first_milk', name: 'Dairy Farmer', emoji: '🥛', desc: 'Collect your first milk', unlocked: false },
    { id: 'first_wool', name: 'Shepherd', emoji: '🧶', desc: 'Collect your first wool', unlocked: false },
    { id: 'first_truffle', name: 'Pig Farmer', emoji: '🍄', desc: 'Find your first truffle', unlocked: false },
    { id: 'first_dish', name: 'Chef', emoji: '👨‍🍳', desc: 'Cook your first dish', unlocked: false },
    { id: 'five_dishes', name: 'Master Chef', emoji: '🍳', desc: 'Cook 5 dishes', unlocked: false },
    { id: 'season_master', name: 'Season Veteran', emoji: '📅', desc: 'Survive a full season', unlocked: false },
    { id: 'year_one', name: 'Year One', emoji: '🎊', desc: 'Survive all 4 seasons', unlocked: false },
    { id: 'five_friends', name: 'Popular', emoji: '💝', desc: 'Reach 5 hearts with any NPC', unlocked: false },
    { id: 'all_friends', name: 'Beloved', emoji: '💖', desc: 'Reach 5 hearts with all NPCs', unlocked: false },
    { id: 'all_tools', name: 'Master Tools', emoji: '⚒️', desc: 'Upgrade any tool to Lv3', unlocked: false },
    { id: 'festival_first', name: 'Festival Goer', emoji: '🎪', desc: 'Attend your first festival', unlocked: false },
    { id: 'starfruit_grow', name: 'Star Grower', emoji: '⭐', desc: 'Harvest a Starfruit', unlocked: false },
    { id: 'ancient_grow', name: 'Ancient Wisdom', emoji: '📜', desc: 'Harvest an Ancient Fruit', unlocked: false },
    { id: 'wine_make', name: 'Vintner', emoji: '🍷', desc: 'Make your first wine', unlocked: false },
  ];
  private harvestCount = 0;

  // UI
  private coinsText!: Phaser.GameObjects.Text;
  private energyBar!: Phaser.GameObjects.Rectangle;
  private energyText!: Phaser.GameObjects.Text;
  private dayText!: Phaser.GameObjects.Text;
  private seasonText!: Phaser.GameObjects.Text;
  private weatherText!: Phaser.GameObjects.Text;
  private toolButtons: Phaser.GameObjects.Container[] = [];
  private cropButtons: Phaser.GameObjects.Container[] = [];
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private skyRect!: Phaser.GameObjects.Rectangle;
  private modalContainer?: Phaser.GameObjects.Container;
  private dayTimer?: Phaser.Time.TimerEvent;
  private growthTimer?: Phaser.Time.TimerEvent;
  private shopOpen = false;

  // Fishing
  private fishingActive = false;
  private fishingTimer?: Phaser.Time.TimerEvent;
  private fishingBar?: Phaser.GameObjects.Rectangle;
  private fishingTarget?: Phaser.GameObjects.Rectangle;

  protected maxQuestions() { return 10; }

  protected buildWorld() {
    this.gridOffsetX = (this.scale.width - this.GRID_W * this.TILE) / 2;
    this.gridOffsetY = 160;

    // Sky
    this.skyRect = this.add.rectangle(this.scale.width / 2, 70, this.scale.width, 140, 0x87ceeb, 1)
      .setDepth(-20);

    // Title + day + season
    this.dayText = this.add.text(this.scale.width / 2, 18, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '14px',
      color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    this.seasonText = this.add.text(this.scale.width / 2, 38, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px',
      color: this.hex(this.theme.accent), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    this.add.text(this.scale.width / 2, 58, '🌾 Star Farm', {
      fontFamily: 'Inter, sans-serif', fontSize: '13px',
      color: this.hex(this.theme.textMuted),
    }).setOrigin(0.5).setDepth(50);

    // Coins + energy
    this.coinsText = this.add.text(10, 80, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '12px',
      color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setDepth(50);

    this.add.text(10, 100, 'Energy', {
      fontFamily: 'Inter, sans-serif', fontSize: '9px',
      color: this.hex(this.theme.textMuted),
    }).setDepth(50);
    this.add.rectangle(50, 107, 80, 6, 0x000000, 0.4).setDepth(49);
    this.energyBar = this.add.rectangle(10, 107, 80, 6, this.theme.success, 1)
      .setOrigin(0, 0.5).setDepth(50);
    this.energyText = this.add.text(95, 107, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '9px',
      color: this.hex(this.theme.text),
    }).setOrigin(0, 0.5).setDepth(50);

    // Resources (wood/stone/ore)
    this.weatherText = this.add.text(this.scale.width - 10, 80, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '11px',
      color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(50);

    // Prompt
    this.promptBg = this.add.rectangle(this.scale.width / 2, 130, 620, 24, this.theme.card, 0.85)
      .setStrokeStyle(2, this.theme.accent, 0.5).setDepth(48);
    this.promptText = this.add.text(this.scale.width / 2, 130, 'Pick a tool, tap a tile!', {
      fontFamily: 'Inter, sans-serif', fontSize: '11px',
      color: this.hex(this.theme.text), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(49);
    this.makeSpeakable(this.promptText);

    this._buildGrid();
    this._buildNPCs();
    this._buildAnimals();
    this._buildToolBar();
    this._buildCropBar();

    // Timers
    this.growthTimer = this.time.addEvent({
      delay: 4000, loop: true, callback: () => this._advanceGrowth(),
    });
    this.dayTimer = this.time.addEvent({
      delay: 1500, loop: true, callback: () => this._tickDay(),
    });

    this._loadGame();

    // Input
    this.setupGlobalPointer((x, y) => {
      if (this.shopOpen || this.fishingActive) return;
      this._handleTap(x, y);
    });

    // Sleep + Save buttons
    const sleepBtn = this.add.text(this.scale.width - 55, this.scale.height - 28, '😴 Sleep', {
      fontFamily: 'Inter, sans-serif', fontSize: '11px',
      color: '#ffffff', fontStyle: 'bold',
      backgroundColor: '#' + this.theme.accent.toString(16).padStart(6, '0'),
      padding: { x: 10, y: 6 },
    }).setOrigin(0.5).setDepth(60).setInteractive({ useHandCursor: true });
    sleepBtn.on('pointerdown', () => this._sleep());

    const saveBtn = this.add.text(55, this.scale.height - 28, '💾', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px',
    }).setOrigin(0.5).setDepth(60).setInteractive({ useHandCursor: true });
    saveBtn.on('pointerdown', () => {
      this._saveGame();
      this.juice.scorePopup(this.scale.width / 2, 200, '💾 Saved!', this.theme.success);
      audioBus.speak('Game saved!');
    });

    // Achievement button
    const achBtn = this.add.text(this.scale.width / 2, this.scale.height - 28, '🏆', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px',
    }).setOrigin(0.5).setDepth(60).setInteractive({ useHandCursor: true });
    achBtn.on('pointerdown', () => this._showAchievements());

    this._updateUI();
    audioBus.speak('Welcome to Star Farm! A complete farming adventure! Explore the farm, till soil, plant crops, raise animals, mine rocks, chop trees, and fish!');
  }

  protected onTick(_remainingMs: number) {}

  // ===========================================================================
  // GRID + TERRAIN
  // ===========================================================================
  private _buildGrid() {
    for (let r = 0; r < this.GRID_H; r++) {
      this.grid[r] = [];
      for (let c = 0; c < this.GRID_W; c++) {
        const x = this.gridOffsetX + c * this.TILE + this.TILE / 2;
        const y = this.gridOffsetY + r * this.TILE + this.TILE / 2;
        let terrain: TerrainType = 'grass';
        let emoji = '🟩';
        let bg = 0x4a7c3a;
        let hp: number | undefined;

        // Water on right edge (for fishing)
        if (c >= this.GRID_W - 2 && r >= 4 && r <= 6) {
          terrain = 'water'; emoji = '🌊'; bg = 0x2563eb;
        }
        // Paths
        else if (r === 0 || r === this.GRID_H - 1 || c === 0 || c === this.GRID_W - 1) {
          terrain = 'path'; emoji = '⬜'; bg = 0x8b7355;
        }
        // Rocks (mining) — cluster in top-right
        else if (r <= 2 && c >= this.GRID_W - 4 && !(r === 0 || c === this.GRID_W - 1)) {
          terrain = 'rock'; emoji = '🪨'; bg = 0x6b6b6b; hp = 3;
        }
        // Trees (chopping) — cluster in top-left
        else if (r <= 2 && c <= 3) {
          terrain = 'tree'; emoji = '🌳'; bg = 0x2d5016; hp = 3;
        }
        // Forage spots (random)
        else if (Math.random() < 0.08) {
          terrain = 'forage';
          const f = Phaser.Utils.Array.GetRandom(FORAGE_ITEMS);
          emoji = f.emoji; bg = 0x4a7c3a;
        }

        const bgRect = this.add.rectangle(x, y, this.TILE - 1, this.TILE - 1, bg, 0.75)
          .setStrokeStyle(1, 0x000000, 0.2);
        const txt = this.add.text(x, y, emoji, { fontSize: '22px' }).setOrigin(0.5);
        this.grid[r][c] = { x, y, row: r, col: c, terrain, stage: 'empty', growth: 0, bg: bgRect, emoji: txt, hp };
      }
    }
  }

  private _buildNPCs() {
    // Shopkeeper (bottom-left path)
    this._addNPC('🧑‍🌾', 'Farmer Joe', 'shop', this.gridOffsetX + this.TILE * 1.5, this.gridOffsetY + this.TILE * 8.5);
    // Quest giver (bottom-right path)
    this._addNPC('👩‍🦰', 'Mary', 'quest', this.gridOffsetX + this.TILE * 14.5, this.gridOffsetY + this.TILE * 8.5);
    // Friend NPC 1 (top path)
    this._addNPC('👨', 'Tom', 'friend', this.gridOffsetX + this.TILE * 7.5, this.gridOffsetY - this.TILE * 0.3);
    // Friend NPC 2 (mid-left)
    this._addNPC('👵', 'Grandma', 'friend', this.gridOffsetX + this.TILE * 0.5, this.gridOffsetY + this.TILE * 4.5);
    // Cook (near water)
    this._addNPC('👨‍🍳', 'Chef Pierre', 'cook', this.gridOffsetX + this.TILE * 13.5, this.gridOffsetY + this.TILE * 3.5);
  }

  private _addNPC(emoji: string, name: string, type: NPC['type'], x: number, y: number) {
    const text = this.add.text(x, y, emoji, { fontSize: '28px' }).setOrigin(0.5).setDepth(30);
    this.add.text(x, y + 22, name.split(' ')[0], {
      fontFamily: 'Inter, sans-serif', fontSize: '8px',
      color: '#ffffff', fontStyle: 'bold',
      backgroundColor: '#' + this.theme.card.toString(16).padStart(6, '0'),
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(30);
    this.npcs.push({ name, emoji, x, y, type, hearts: 0, text });
  }

  private _buildAnimals() {
    // Chicken (top-middle grass area)
    this._addAnimal('chicken', '🐔', this.gridOffsetX + this.TILE * 5, this.gridOffsetY + this.TILE * 3.5);
    // Cow (mid-middle grass area)
    this._addAnimal('cow', '🐄', this.gridOffsetX + this.TILE * 8, this.gridOffsetY + this.TILE * 5);
    // Sheep (bottom-middle grass area)
    this._addAnimal('sheep', '🐑', this.gridOffsetX + this.TILE * 6, this.gridOffsetY + this.TILE * 6.5);
    // Pig (bottom-middle grass area)
    this._addAnimal('pig', '🐷', this.gridOffsetX + this.TILE * 9, this.gridOffsetY + this.TILE * 3.5);
  }

  private _addAnimal(type: AnimalType, emoji: string, x: number, y: number) {
    const text = this.add.text(x, y, emoji, { fontSize: '28px' }).setOrigin(0.5).setDepth(25);
    this.animals.push({ type, x, y, text, fed: false, produceReady: false, emoji });
  }

  private _buildToolBar() {
    const tools: ToolType[] = ['hoe', 'water', 'seed', 'harvest', 'axe', 'pickaxe'];
    const startY = this.scale.height - 70;
    const spacing = 85;
    const totalW = tools.length * spacing;
    const startX = (this.scale.width - totalW) / 2 + spacing / 2;

    tools.forEach((t, i) => {
      const x = startX + i * spacing;
      const bg = this.add.rectangle(0, 0, 75, 34, i === 0 ? this.theme.accent : this.theme.card, 0.92)
        .setStrokeStyle(2, this.theme.accent, 0.6);
      const txt = this.add.text(0, -6, `${TOOL_EMOJIS[t]} ${TOOL_NAMES[t].slice(0, 8)}`, {
        fontFamily: 'Inter, sans-serif', fontSize: '9px',
        color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      const lvlTxt = this.add.text(0, 8, `Lv${this.toolLevel[t]}`, {
        fontFamily: 'Inter, sans-serif', fontSize: '8px',
        color: this.hex(this.theme.warning),
      }).setOrigin(0.5);
      const container = this.add.container(x, startY, [bg, txt, lvlTxt]).setSize(75, 34).setDepth(40);
      this.toolButtons.push(container);
    });
  }

  private _buildCropBar() {
    const allCrops = Object.keys(CROPS) as CropType[];
    const startY = this.scale.height - 28;
    const spacing = 52;
    const totalW = allCrops.length * spacing;
    const startX = (this.scale.width - totalW) / 2 + spacing / 2;

    allCrops.forEach((c, i) => {
      const x = startX + i * spacing;
      const crop = CROPS[c];
      const isSeason = crop.seasons.includes(this.season);
      const bg = this.add.rectangle(0, 0, 46, 24, i === 0 ? this.theme.warning : this.theme.card, 0.92)
        .setStrokeStyle(1, isSeason ? this.theme.success : 0x666666, 0.6);
      const txt = this.add.text(0, 0, `${crop.emoji}`, {
        fontFamily: 'Inter, sans-serif', fontSize: '12px',
      }).setOrigin(0.5);
      if (!isSeason) txt.setAlpha(0.3);
      const container = this.add.container(x, startY, [bg, txt]).setSize(46, 24).setDepth(40);
      this.cropButtons.push(container);
    });
    this.cropButtons.forEach(btn => btn.setVisible(this.selectedTool === 'seed'));
  }

  private _selectTool(t: ToolType) {
    this.selectedTool = t;
    audioBus.play('tap');
    audioBus.speak(TOOL_NAMES[t]);
    this.vocabLearned.add(TOOL_NAMES[t].toLowerCase());
    this.promptText.setText(`Tool: ${TOOL_NAMES[t]} — tap a tile!`);
    const tools: ToolType[] = ['hoe', 'water', 'seed', 'harvest', 'axe', 'pickaxe'];
    this.toolButtons.forEach((btn, i) => {
      const bg = btn.getAt(0) as Phaser.GameObjects.Rectangle;
      bg.setFillStyle(tools[i] === t ? this.theme.accent : this.theme.card, 0.92);
    });
    this.cropButtons.forEach(btn => btn.setVisible(t === 'seed'));
  }

  private _updateCropButtons() {
    const allCrops = Object.keys(CROPS) as CropType[];
    this.cropButtons.forEach((btn, i) => {
      const bg = btn.getAt(0) as Phaser.GameObjects.Rectangle;
      bg.setFillStyle(allCrops[i] === this.selectedCrop ? this.theme.warning : this.theme.card, 0.92);
    });
  }

  // ===========================================================================
  // INPUT HANDLING
  // ===========================================================================
  private _handleTap(x: number, y: number) {
    // NPCs
    for (const npc of this.npcs) {
      if (Math.abs(x - npc.x) < 28 && Math.abs(y - npc.y) < 28) {
        this._openNPC(npc);
        return;
      }
    }
    // Animals
    for (const animal of this.animals) {
      if (Math.abs(x - animal.x) < 28 && Math.abs(y - animal.y) < 28) {
        this._interactAnimal(animal);
        return;
      }
    }
    // Tool buttons
    const tools: ToolType[] = ['hoe', 'water', 'seed', 'harvest', 'axe', 'pickaxe'];
    for (let i = 0; i < this.toolButtons.length; i++) {
      const btn = this.toolButtons[i];
      if (Math.abs(x - btn.x) < 38 && Math.abs(y - btn.y) < 17) {
        this._selectTool(tools[i]);
        return;
      }
    }
    // Crop buttons
    if (this.selectedTool === 'seed') {
      const allCrops = Object.keys(CROPS) as CropType[];
      for (let i = 0; i < this.cropButtons.length; i++) {
        const btn = this.cropButtons[i];
        if (Math.abs(x - btn.x) < 23 && Math.abs(y - btn.y) < 12) {
          this.selectedCrop = allCrops[i];
          audioBus.play('tap');
          audioBus.speak(CROPS[this.selectedCrop].name);
          this._updateCropButtons();
          return;
        }
      }
    }
    // Grid tiles
    for (let r = 0; r < this.GRID_H; r++) {
      for (let c = 0; c < this.GRID_W; c++) {
        const tile = this.grid[r][c];
        if (Math.abs(x - tile.x) < this.TILE / 2 && Math.abs(y - tile.y) < this.TILE / 2) {
          this._useTool(tile);
          return;
        }
      }
    }
  }

  // ===========================================================================
  // TOOL USE
  // ===========================================================================
  private _useTool(tile: Tile) {
    const tool = this.selectedTool;
    const energyCost = Math.max(2, 5 - this.toolLevel[tool]);

    if (this.energy < energyCost) {
      this.promptText.setText('😴 Too tired! Sleep to restore energy.');
      audioBus.play('incorrect');
      return;
    }

    if (tool === 'hoe') {
      if (tile.terrain === 'grass' || tile.terrain === 'forage') {
        if (tile.terrain === 'forage') this._collectForage(tile);
        tile.terrain = 'dirt'; tile.stage = 'tilled';
        tile.emoji.setText('🟫'); tile.bg.setFillStyle(0x8b5a2b, 0.8);
        this._spendEnergy(energyCost);
        audioBus.play('flip');
        this.vocabLearned.add('till');
      } else if (tile.terrain === 'dirt' && tile.stage === 'empty') {
        tile.stage = 'tilled';
        this._spendEnergy(energyCost);
        audioBus.play('flip');
      } else {
        this.promptText.setText('Can\'t till here!');
        return;
      }
    } else if (tool === 'water') {
      if (tile.stage === 'tilled') {
        tile.stage = 'watered';
        tile.bg.setFillStyle(0x3b82f6, 0.5);
        this._spendEnergy(energyCost);
        audioBus.play('pop');
        this.vocabLearned.add('water');
        if (this.toolLevel.water >= 2) {
          for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nr = tile.row + dr, nc = tile.col + dc;
            if (nr >= 0 && nr < this.GRID_H && nc >= 0 && nc < this.GRID_W) {
              const t2 = this.grid[nr][nc];
              if (t2.stage === 'tilled') {
                t2.stage = 'watered';
                t2.bg.setFillStyle(0x3b82f6, 0.5);
              }
            }
          }
        }
      } else {
        this.promptText.setText('Till the soil first!');
        return;
      }
    } else if (tool === 'seed') {
      if (tile.stage === 'watered') {
        const crop = CROPS[this.selectedCrop];
        if (!crop.seasons.includes(this.season)) {
          this.promptText.setText(`${crop.name} can't grow in ${this.season}!`);
          audioBus.play('incorrect');
          return;
        }
        const owned = this.seedsOwned[this.selectedCrop] ?? 0;
        if (owned > 0) {
          this.seedsOwned[this.selectedCrop] = owned - 1;
          tile.stage = 'seeded'; tile.cropType = this.selectedCrop; tile.growth = 0;
          tile.emoji.setText('🌱');
          this._spendEnergy(energyCost);
          audioBus.play('correct');
          this.vocabLearned.add(crop.vocab);
          audioBus.speak(crop.name);
        } else {
          this.promptText.setText(`No ${crop.name} seeds! Buy at shop.`);
          audioBus.play('incorrect');
          return;
        }
      } else {
        this.promptText.setText('Water the soil first!');
        return;
      }
    } else if (tool === 'harvest') {
      if (tile.stage === 'ready' && tile.cropType) {
        const crop = CROPS[tile.cropType];
        this.inventory[tile.cropType] = (this.inventory[tile.cropType] ?? 0) + 1;
        this.vocabLearned.add(crop.vocab);
        this.coins += crop.sellPrice;
        this.harvestCount++;
        // Special crop achievements
        if (tile.cropType === 'starfruit') this._unlockAch('starfruit_grow');
        if (tile.cropType === 'ancient') this._unlockAch('ancient_grow');
        tile.stage = 'empty'; tile.cropType = undefined; tile.growth = 0;
        tile.terrain = 'dirt'; tile.emoji.setText('🟫');
        this._spendEnergy(energyCost);
        audioBus.play('correct');
        audioBus.speak(crop.name);
        this.juice.burst(tile.x, tile.y, 'correct');
        this.juice.scorePopup(tile.x, tile.y - 25, `+${crop.sellPrice}💰`, this.theme.warning);
        this._checkAchievements();
        this._recordHarvest(crop.name, crop.vocab);
      } else {
        this.promptText.setText('Nothing to harvest!');
        return;
      }
    } else if (tool === 'axe') {
      if (tile.terrain === 'tree' && tile.hp !== undefined) {
        tile.hp -= this.toolLevel.axe;
        this._spendEnergy(energyCost);
        audioBus.play('flip');
        if (tile.hp <= 0) {
          this.wood += 3 + this.toolLevel.axe;
          tile.terrain = 'grass'; tile.emoji.setText('🟩'); tile.bg.setFillStyle(0x4a7c3a, 0.75);
          audioBus.speak('Wood collected!');
          this.juice.burst(tile.x, tile.y, 'correct');
          this.vocabLearned.add('wood');
          this._checkAchievements();
        } else {
          this.juice.shake('light');
        }
      } else {
        this.promptText.setText('Chop trees (🌳) with the axe!');
        return;
      }
    } else if (tool === 'pickaxe') {
      if (tile.terrain === 'rock' && tile.hp !== undefined) {
        tile.hp -= this.toolLevel.pickaxe;
        this._spendEnergy(energyCost);
        audioBus.play('flip');
        if (tile.hp <= 0) {
          this.stone += 2 + this.toolLevel.pickaxe;
          if (Math.random() < 0.4) { this.ore++; this._unlockAch('first_ore'); }
          tile.terrain = 'grass'; tile.emoji.setText('🟩'); tile.bg.setFillStyle(0x4a7c3a, 0.75);
          audioBus.speak('Stone mined!');
          this.juice.burst(tile.x, tile.y, 'correct');
          this.vocabLearned.add('stone');
          this._checkAchievements();
        } else {
          this.juice.shake('light');
        }
      } else if (tile.terrain === 'water') {
        // Fishing!
        this._startFishing(tile);
        return;
      } else {
        this.promptText.setText('Mine rocks (🪨) with the pickaxe!');
        return;
      }
    }
    this._updateUI();
  }

  private _spendEnergy(amount: number) {
    this.energy = Math.max(0, this.energy - amount);
  }

  private _collectForage(tile: Tile) {
    const f = Phaser.Utils.Array.GetRandom(FORAGE_ITEMS);
    this.forageInventory[f.name] = (this.forageInventory[f.name] ?? 0) + 1;
    this.coins += f.price;
    audioBus.speak(`Found ${f.name}!`);
    this.vocabLearned.add(f.name.toLowerCase());
    this.juice.scorePopup(tile.x, tile.y - 25, `${f.emoji} +${f.price}💰`, this.theme.success);
  }

  private _recordHarvest(cropName: string, vocab: string) {
    this.recordAnswer({
      term: cropName,
      response: 'harvested',
      success: true,
      coordinate: { x: this.scale.width / 2, y: this.scale.height / 2, t: this.time.now },
    });
  }

  // ===========================================================================
  // ANIMALS
  // ===========================================================================
  private _interactAnimal(animal: Animal) {
    if (!animal.fed) {
      // Feed the animal
      if (this.energy < 3) {
        this.promptText.setText('Too tired to feed!');
        return;
      }
      animal.fed = true;
      this._spendEnergy(3);
      audioBus.play('pop');
      audioBus.speak(`Fed the ${animal.type}!`);
      this.vocabLearned.add(animal.type);
      this.tweens.add({ targets: animal.text, scale: 1.3, duration: 200, yoyo: true });
    } else if (!animal.produceReady) {
      // Check if produce is ready (after feeding, takes time)
      animal.produceReady = true;
      if (animal.type === 'chicken') {
        this.coins += 10;
        this._unlockAch('first_egg');
        audioBus.speak('Egg collected! Plus 10 coins!');
        this.juice.scorePopup(animal.x, animal.y - 30, '🥚 +10💰', this.theme.warning);
        this.vocabLearned.add('egg');
      } else if (animal.type === 'cow') {
        this.coins += 15;
        this._unlockAch('first_milk');
        audioBus.speak('Milk collected! Plus 15 coins!');
        this.juice.scorePopup(animal.x, animal.y - 30, '🥛 +15💰', this.theme.warning);
        this.vocabLearned.add('milk');
      } else if (animal.type === 'sheep') {
        this.coins += 25;
        this._unlockAch('first_wool');
        audioBus.speak('Wool collected! Plus 25 coins!');
        this.juice.scorePopup(animal.x, animal.y - 30, '🧶 +25💰', this.theme.warning);
        this.vocabLearned.add('wool');
      } else if (animal.type === 'pig') {
        this.coins += 40;
        this._unlockAch('first_truffle');
        audioBus.speak('Truffle found! Plus 40 coins!');
        this.juice.scorePopup(animal.x, animal.y - 30, '🍄 +40💰', this.theme.warning);
        this.vocabLearned.add('truffle');
      }
      animal.fed = false;
      this._updateUI();
    }
  }

  // ===========================================================================
  // FISHING MINIGAME
  // ===========================================================================
  private _startFishing(waterTile: Tile) {
    this.fishingActive = true;
    this.promptText.setText('🎣 Fishing... wait for a bite!');
    audioBus.speak('Casting line!');
    this._spendEnergy(5);

    // Wait 2-5 seconds for a bite
    const waitTime = Phaser.Math.Between(2000, 5000);
    this.fishingTimer = this.time.delayedCall(waitTime, () => {
      if (!this.fishingActive) return;
      this._fishingBite(waterTile);
    });
  }

  private _fishingBite(waterTile: Tile) {
    this.promptText.setText('🐟 BITE! Tap the water to reel in!');
    audioBus.play('correct');
    this.juice.scorePopup(waterTile.x, waterTile.y - 30, '🎯 TAP!', this.theme.warning);

    // Player has 1.5s to tap
    let reeled = false;
    const biteTimer = this.time.delayedCall(1500, () => {
      if (!reeled && this.fishingActive) {
        this.fishingActive = false;
        this.promptText.setText('💨 The fish got away!');
        audioBus.play('incorrect');
      }
    });

    // Listen for the next tap (to reel in)
    this.input.once('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.fishingActive) return;
      const dx = p.x - waterTile.x;
      const dy = p.y - waterTile.y;
      if (Math.abs(dx) < 50 && Math.abs(dy) < 50) {
        reeled = true;
        biteTimer.remove();
        this._catchFish(waterTile);
      }
    });
  }

  private _catchFish(waterTile: Tile) {
    this.fishingActive = false;
    const fish = Phaser.Utils.Array.GetRandom(FISH_TYPES);
    this.fishInventory++;
    this.coins += fish.price;
    this._unlockAch('first_fish');
    audioBus.speak(`Caught a ${fish.name}! Plus ${fish.price} coins!`);
    this.juice.burst(waterTile.x, waterTile.y, 'win');
    this.juice.scorePopup(waterTile.x, waterTile.y - 30, `${fish.emoji} +${fish.price}💰`, this.theme.warning);
    this.vocabLearned.add(fish.name.toLowerCase());
    this.promptText.setText(`Caught ${fish.emoji} ${fish.name}!`);
    this._updateUI();
    this._checkAchievements();
  }

  // ===========================================================================
  // GROWTH + DAY CYCLE + SEASONS
  // ===========================================================================
  private _advanceGrowth() {
    if (this.isFinished) return;
    for (let r = 0; r < this.GRID_H; r++) {
      for (let c = 0; c < this.GRID_W; c++) {
        const tile = this.grid[r][c];
        if (tile.stage === 'seeded' || tile.stage === 'sprout' || tile.stage === 'growing') {
          tile.growth++;
          const crop = tile.cropType ? CROPS[tile.cropType] : null;
          if (!crop) continue;
          if (tile.growth >= crop.growTime) {
            tile.stage = 'ready';
            tile.emoji.setText(crop.emoji);
            tile.bg.setFillStyle(this.theme.success, 0.4);
            this.juice.scorePopup(tile.x, tile.y - 25, 'Ready!', this.theme.success);
          } else if (tile.growth >= Math.ceil(crop.growTime * 0.6)) {
            tile.stage = 'growing';
            tile.emoji.setText('🌿');
          } else if (tile.growth >= 1) {
            tile.stage = 'sprout';
            tile.emoji.setText('🌱');
          }
        }
      }
    }
  }

  private _tickDay() {
    if (this.isFinished) return;
    this.dayProgress += 1 / 40;
    if (this.dayProgress >= 1) {
      this._endDay();
    }
    // Sky color
    const t = this.dayProgress;
    let r = 0x87, g = 0xce, b = 0xeb;
    if (t < 0.5) {
      const k = t / 0.5;
      r = Math.floor(0xff * (1 - k) + 0x87 * k);
      g = Math.floor(0xa5 * (1 - k) + 0xce * k);
      b = Math.floor(0x60 * (1 - k) + 0xeb * k);
    } else {
      const k = (t - 0.5) / 0.5;
      r = Math.floor(0x87 * (1 - k) + 0x1a * k);
      g = Math.floor(0xce * (1 - k) + 0x1a * k);
      b = Math.floor(0xeb * (1 - k) + 0x4b * k);
    }
    this.skyRect.setFillStyle((r << 16) | (g << 8) | b, 1);
  }

  private _endDay() {
    this.dayProgress = 0;
    this.day++;
    // Season change every 28 days
    if (this.day % 28 === 1 && this.day > 1) {
      const seasons: Season[] = ['spring', 'summer', 'fall', 'winter'];
      const idx = seasons.indexOf(this.season);
      this.season = seasons[(idx + 1) % 4];
      this._unlockAch('season_master');
      if (this.season === 'spring') this._unlockAch('year_one');
      audioBus.speak(`${SEASON_NAMES[this.season]} has arrived!`);
    }
    // Weather
    this.weather = this.weather === 'rainy' || Math.random() < 0.25 ? (Math.random() < 0.7 ? 'rainy' : 'sunny') : 'sunny';
    if (this.weather === 'rainy') {
      for (let r = 0; r < this.GRID_H; r++) {
        for (let c = 0; c < this.GRID_W; c++) {
          const tile = this.grid[r][c];
          if (tile.stage === 'tilled') {
            tile.stage = 'watered';
            tile.bg.setFillStyle(0x3b82f6, 0.5);
          }
        }
      }
    }
    // Spawn new forage
    this._spawnForage();
    // Reset animals
    this.animals.forEach(a => { a.fed = false; a.produceReady = false; });
    // Check for festival (day 14 or 28 of each season)
    const dayInSeason = ((this.day - 1) % 28) + 1;
    const festival = FESTIVALS.find(f => f.season === this.season && f.day === dayInSeason);
    if (festival) {
      this._showFestival(festival);
    } else {
      this._showDaySummary();
    }
  }

  private _showFestival(festival: Festival) {
    this._unlockAch('festival_first');
    this.coins += festival.reward;
    const c = this._openModal(`${festival.emoji} ${festival.name}!`, 300);
    this._modalText(c, this.scale.width / 2, this.scale.height / 2 - 50,
      `${festival.emoji} ${festival.name}!\n\nThe whole town gathered to celebrate!\n\nYou earned 💰${festival.reward} for participating!\n\nEnjoy the festivities!`,
      16, '#' + this.theme.warning.toString(16).padStart(6, '0')).setOrigin(0.5);
    this.juice.flash(this.theme.warning, 0.5, 500);
    audioBus.speak(`${festival.name}! You earned ${festival.reward} coins!`);
    this.vocabLearned.add(festival.name.toLowerCase().split(' ')[0]);
    const okBtn = this._modalText(c, this.scale.width / 2, this.scale.height / 2 + 100,
      '✓ Celebrate!', 18, '#' + this.theme.success.toString(16).padStart(6, '0')).setOrigin(0.5);
    okBtn.setInteractive({ useHandCursor: true });
    okBtn.on('pointerdown', () => {
      this._closeModal();
      this._updateUI();
    });
  }

  private _spawnForage() {
    for (let i = 0; i < 3; i++) {
      const r = Phaser.Math.Between(3, this.GRID_H - 2);
      const c = Phaser.Math.Between(4, this.GRID_W - 4);
      const tile = this.grid[r][c];
      if (tile.terrain === 'grass' && tile.stage === 'empty') {
        tile.terrain = 'forage';
        const f = Phaser.Utils.Array.GetRandom(FORAGE_ITEMS);
        tile.emoji.setText(f.emoji);
      }
    }
  }

  private _sleep() {
    this.energy = this.maxEnergy;
    this._endDay();
    this.juice.flash(this.theme.accent, 0.4, 400);
    audioBus.speak(`You slept. Day ${this.day}!`);
    this._updateUI();
    this._saveGame();
  }

  // ===========================================================================
  // NPC INTERACTIONS
  // ===========================================================================
  private _openNPC(npc: NPC) {
    if (npc.type === 'shop') this._openShop();
    else if (npc.type === 'quest') this._openQuest(npc);
    else if (npc.type === 'cook') this._openCooking(npc);
    else this._openFriend(npc);
  }

  private _openModal(title: string, height: number): Phaser.GameObjects.Container {
    this.shopOpen = true;
    if (this.modalContainer) this.modalContainer.destroy();
    this.modalContainer = this.add.container(0, 0).setDepth(200);
    const overlay = this.add.rectangle(this.scale.width / 2, this.scale.height / 2,
      this.scale.width, this.scale.height, 0x000000, 0.8).setDepth(199);
    this.modalContainer.add(overlay);
    const panel = this.add.rectangle(this.scale.width / 2, this.scale.height / 2,
      520, height, this.theme.card, 0.95).setStrokeStyle(3, this.theme.accent, 1).setDepth(200);
    this.modalContainer.add(panel);
    const titleText = this.add.text(this.scale.width / 2, this.scale.height / 2 - height / 2 + 20,
      title, {
        fontFamily: 'Inter, sans-serif', fontSize: '18px',
        color: this.hex(this.theme.warning), fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(201);
    this.modalContainer.add(titleText);
    return this.modalContainer;
  }

  private _closeModal() {
    this.shopOpen = false;
    if (this.modalContainer) {
      this.modalContainer.destroy();
      this.modalContainer = undefined;
    }
  }

  private _openShop() {
    const c = this._openModal('🧑‍🌾 Farmer Joe\'s Shop', 420);
    const crops = Object.keys(CROPS) as CropType[];
    let yPos = this.scale.height / 2 - 170;
    // Buy seeds
    this._modalText(c, this.scale.width / 2 - 230, yPos, 'Buy Seeds (season-appropriate):', 13);
    yPos += 22;
    crops.forEach(cropType => {
      const crop = CROPS[cropType];
      const isSeason = crop.seasons.includes(this.season);
      const owned = this.seedsOwned[cropType] ?? 0;
      const btn = this._modalText(c, this.scale.width / 2 - 230, yPos,
        `${crop.emoji} ${crop.name} — 💰${crop.seedPrice} (${owned})${isSeason ? '' : ' ❌'}`,
        isSeason ? 12 : 11, isSeason ? '#ffffff' : '#666666');
      if (isSeason) {
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerdown', () => {
          if (this.coins >= crop.seedPrice) {
            this.coins -= crop.seedPrice;
            this.seedsOwned[cropType] = owned + 1;
            audioBus.play('correct');
            audioBus.speak(`Bought ${crop.name} seed`);
            this._updateUI();
            this._closeModal();
            this._openShop();
          } else {
            audioBus.play('incorrect');
          }
        });
      }
      yPos += 24;
    });

    // Sell crops
    yPos += 10;
    this._modalText(c, this.scale.width / 2 + 20, this.scale.height / 2 - 170, 'Sell Crops:', 13);
    let yPos2 = this.scale.height / 2 - 148;
    crops.forEach(cropType => {
      const crop = CROPS[cropType];
      const count = this.inventory[cropType] ?? 0;
      const btn = this._modalText(c, this.scale.width / 2 + 20, yPos2,
        `${crop.emoji} ${crop.name} (${count}) — 💰${crop.sellPrice}`,
        12, count > 0 ? '#ffffff' : '#666666');
      if (count > 0) {
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerdown', () => {
          this.inventory[cropType] = count - 1;
          this.coins += crop.sellPrice;
          audioBus.speak(`Sold ${crop.name}`);
          this._updateUI();
          this._closeModal();
          this._openShop();
        });
      }
      yPos2 += 24;
    });

    // Tool upgrades
    yPos2 += 10;
    const tools: ToolType[] = ['hoe', 'water', 'axe', 'pickaxe'];
    tools.forEach(t => {
      if (this.toolLevel[t] < 3) {
        const cost = this.toolLevel[t] * 40;
        const btn = this._modalText(c, this.scale.width / 2 + 20, yPos2,
          `⬆️ ${TOOL_EMOJIS[t]} ${TOOL_NAMES[t]} Lv${this.toolLevel[t]}→${this.toolLevel[t] + 1} — 💰${cost}`,
          12, '#ffffff');
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerdown', () => {
          if (this.coins >= cost) {
            this.coins -= cost;
            this.toolLevel[t]++;
            audioBus.speak(`${TOOL_NAMES[t]} upgraded!`);
            if (this.toolLevel[t] >= 3) this._unlockAch('all_tools');
            this._updateUI();
            this._closeModal();
            this._openShop();
          }
        });
        yPos2 += 24;
      }
    });

    // Close
    const closeBtn = this._modalText(c, this.scale.width / 2, this.scale.height / 2 + 180,
      '✕ Close', 16, '#' + this.theme.danger.toString(16).padStart(6, '0'));
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this._closeModal());
  }

  private _modalText(container: Phaser.GameObjects.Container, x: number, y: number, text: string, size: number, color: string = '#ffffff'): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, text, {
      fontFamily: 'Inter, sans-serif', fontSize: size + 'px',
      color: color, fontStyle: 'bold',
      backgroundColor: '#' + this.theme.cardAlt.toString(16).padStart(6, '0'),
      padding: { x: 8, y: 4 },
    }).setOrigin(0, 0.5).setDepth(201);
    container.add(t);
    return t;
  }

  private _openQuest(npc: NPC) {
    const c = this._openModal('👩‍🦰 Mary\'s Daily Quest', 250);
    const questCrops = Object.keys(CROPS).filter(k => CROPS[k as CropType].seasons.includes(this.season)) as CropType[];
    const questCrop = Phaser.Utils.Array.GetRandom(questCrops.length > 0 ? questCrops : Object.keys(CROPS) as CropType[]);
    const crop = CROPS[questCrop];
    this._modalText(c, this.scale.width / 2, this.scale.height / 2 - 30,
      `Harvest a ${crop.emoji} ${crop.name}!\n\nReward: 💰${crop.sellPrice * 2} + 3 ${crop.name} seeds\n\n(Hearts: ${'❤️'.repeat(npc.hearts)}${'🤍'.repeat(5 - npc.hearts)})`,
      14, '#ffffff').setOrigin(0.5);
    const acceptBtn = this._modalText(c, this.scale.width / 2, this.scale.height / 2 + 70,
      '✓ Accept Quest', 16, '#' + this.theme.success.toString(16).padStart(6, '0')).setOrigin(0.5);
    acceptBtn.setInteractive({ useHandCursor: true });
    acceptBtn.on('pointerdown', () => {
      npc.hearts = Math.min(5, npc.hearts + 1);
      if (npc.hearts >= 5) this._unlockAch('five_friends');
      audioBus.speak(`Quest accepted!`);
      this._closeModal();
    });
    const closeBtn = this._modalText(c, this.scale.width / 2, this.scale.height / 2 + 105,
      '✕ Close', 14, '#' + this.theme.danger.toString(16).padStart(6, '0')).setOrigin(0.5);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this._closeModal());
  }

  private _openCooking(npc: NPC) {
    const c = this._openModal('👨‍🍳 Chef Pierre\'s Kitchen', 350);
    this._modalText(c, this.scale.width / 2, this.scale.height / 2 - 140, 'Cook dishes for energy!', 14, '#ffffff').setOrigin(0.5);
    let yPos = this.scale.height / 2 - 100;
    COOKING_RECIPES.forEach(recipe => {
      const have = recipe.ingredients.every(ing => (this.inventory[ing as CropType] ?? 0) > 0);
      const btn = this._modalText(c, this.scale.width / 2 - 220, yPos,
        `${recipe.emoji} ${recipe.name} (+${recipe.energy} energy) — ${recipe.ingredients.map(i => CROPS[i as CropType].emoji).join('+')}`,
        12, have ? '#ffffff' : '#666666');
      if (have) {
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerdown', () => {
          recipe.ingredients.forEach(ing => {
            this.inventory[ing as CropType] = (this.inventory[ing as CropType] ?? 0) - 1;
          });
          this.energy = Math.min(this.maxEnergy, this.energy + recipe.energy);
          this.cookedDishes[recipe.name] = (this.cookedDishes[recipe.name] ?? 0) + 1;
          this._unlockAch('first_dish');
          if (recipe.name === 'Wine') this._unlockAch('wine_make');
          const totalDishes = Object.values(this.cookedDishes).reduce((a, b) => a + b, 0);
          if (totalDishes >= 5) this._unlockAch('five_dishes');
          audioBus.speak(`Cooked ${recipe.name}! Plus ${recipe.energy} energy!`);
          this.vocabLearned.add(recipe.vocab);
          this._updateUI();
          this._closeModal();
          this._openCooking(npc);
        });
      }
      yPos += 28;
    });
    const closeBtn = this._modalText(c, this.scale.width / 2, this.scale.height / 2 + 150,
      '✕ Close', 16, '#' + this.theme.danger.toString(16).padStart(6, '0')).setOrigin(0.5);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this._closeModal());
  }

  private _openFriend(npc: NPC) {
    const c = this._openModal(`${npc.emoji} ${npc.name}`, 220);
    const dialogues = [
      'Hello there, farmer! Nice weather today.',
      'Your farm is looking great! Keep it up!',
      'I heard there are good fish in the pond.',
      'Have you tried Chef Pierre\'s cooking?',
      'The seasons change every 28 days. Plan ahead!',
    ];
    const dialogue = Phaser.Utils.Array.GetRandom(dialogues);
    this._modalText(c, this.scale.width / 2, this.scale.height / 2 - 20,
      `"${dialogue}"\n\nFriendship: ${'❤️'.repeat(npc.hearts)}${'🤍'.repeat(5 - npc.hearts)}`,
      14, '#ffffff').setOrigin(0.5);
    const giftBtn = this._modalText(c, this.scale.width / 2, this.scale.height / 2 + 60,
      '💝 Give a gift (-1 crop, +1 heart)', 13, '#' + this.theme.warning.toString(16).padStart(6, '0')).setOrigin(0.5);
    giftBtn.setInteractive({ useHandCursor: true });
    giftBtn.on('pointerdown', () => {
      const anyCrop = Object.keys(this.inventory).find(k => (this.inventory[k as CropType] ?? 0) > 0);
      if (anyCrop) {
        this.inventory[anyCrop as CropType] = (this.inventory[anyCrop as CropType] ?? 0) - 1;
        npc.hearts = Math.min(5, npc.hearts + 1);
        if (npc.hearts >= 5) this._unlockAch('five_friends');
        audioBus.speak(`${npc.name} loves the gift! Friendship increased!`);
        this._closeModal();
      } else {
        audioBus.play('incorrect');
      }
    });
    const closeBtn = this._modalText(c, this.scale.width / 2, this.scale.height / 2 + 95,
      '✕ Close', 14, '#' + this.theme.danger.toString(16).padStart(6, '0')).setOrigin(0.5);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this._closeModal());
  }

  // ===========================================================================
  // ACHIEVEMENTS
  // ===========================================================================
  private _unlockAch(id: string) {
    const ach = this.achievements.find(a => a.id === id);
    if (ach && !ach.unlocked) {
      ach.unlocked = true;
      this.juice.scorePopup(this.scale.width / 2, 200, `🏆 ${ach.name}!`, this.theme.warning);
      audioBus.speak(`Achievement unlocked: ${ach.name}!`);
    }
  }

  private _checkAchievements() {
    if (this.harvestCount >= 1) this._unlockAch('first_harvest');
    if (this.harvestCount >= 10) this._unlockAch('ten_crops');
    if (this.harvestCount >= 50) this._unlockAch('fifty_crops');
    if (this.coins >= 100) this._unlockAch('hundred_coins');
    if (this.coins >= 1000) this._unlockAch('thousand_coins');
    if (this.fishInventory >= 10) this._unlockAch('ten_fish');
    // Check if all NPCs have 5 hearts
    if (this.npcs.length > 0 && this.npcs.every(n => n.hearts >= 5)) {
      this._unlockAch('all_friends');
    }
  }

  private _showAchievements() {
    const c = this._openModal('🏆 Achievements', 520);
    let yPos = this.scale.height / 2 - 220;
    this.achievements.forEach(ach => {
      const color = ach.unlocked ? '#ffffff' : '#666666';
      const opacity = ach.unlocked ? 1 : 0.5;
      const t = this._modalText(c, this.scale.width / 2 - 230, yPos,
        `${ach.unlocked ? ach.emoji : '🔒'} ${ach.name} — ${ach.desc}`,
        11, color);
      t.setAlpha(opacity);
      yPos += 20;
    });
    const closeBtn = this._modalText(c, this.scale.width / 2, this.scale.height / 2 + 235,
      '✕ Close', 16, '#' + this.theme.danger.toString(16).padStart(6, '0')).setOrigin(0.5);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this._closeModal());
  }

  // ===========================================================================
  // DAY SUMMARY
  // ===========================================================================
  private _showDaySummary() {
    const c = this._openModal(`📋 Day ${this.day - 1} Summary`, 280);
    const earned = this.harvestCount * 20;
    this._modalText(c, this.scale.width / 2, this.scale.height / 2 - 60,
      `🌞 Day ${this.day - 1} complete!\n\n💰 Coins: ${this.coins}\n🌾 Harvests: ${this.harvestCount}\n🪵 Wood: ${this.wood} | 🪨 Stone: ${this.stone} | 💎 Ore: ${this.ore}\n🐟 Fish: ${this.fishInventory}\n📚 Vocab: ${this.vocabLearned.size} words\n\n${SEASON_NAMES[this.season]} · Day ${this.day}`,
      14, '#ffffff').setOrigin(0.5);
    const okBtn = this._modalText(c, this.scale.width / 2, this.scale.height / 2 + 100,
      '✓ Continue', 16, '#' + this.theme.success.toString(16).padStart(6, '0')).setOrigin(0.5);
    okBtn.setInteractive({ useHandCursor: true });
    okBtn.on('pointerdown', () => this._closeModal());
  }

  // ===========================================================================
  // UI
  // ===========================================================================
  private _updateUI() {
    this.coinsText.setText(`💰${this.coins} 🪵${this.wood} 🪨${this.stone} 💎${this.ore} 🐟${this.fishInventory}`);
    this.energyBar.width = 80 * (this.energy / this.maxEnergy);
    this.energyText.setText(`${this.energy}`);
    if (this.energy < 30) this.energyBar.setFillStyle(this.theme.danger, 1);
    else if (this.energy < 60) this.energyBar.setFillStyle(this.theme.warning, 1);
    else this.energyBar.setFillStyle(this.theme.success, 1);
    this.dayText.setText(`Day ${this.day} ${this.dayProgress > 0.5 ? '🌙' : '🌞'}`);
    this.seasonText.setText(SEASON_NAMES[this.season]);
    const wIcon = this.weather === 'sunny' ? '☀️' : '🌧️';
    this.weatherText.setText(`${wIcon} ${this.weather}\n❤️Eggs/🥛Milk`);
  }

  // ===========================================================================
  // SAVE / LOAD
  // ===========================================================================
  private _saveGame() {
    try {
      const save = {
        coins: this.coins, energy: this.energy, day: this.day, season: this.season,
        weather: this.weather, inventory: this.inventory, seedsOwned: this.seedsOwned,
        forageInventory: this.forageInventory, fishInventory: this.fishInventory,
        wood: this.wood, stone: this.stone, ore: this.ore, cookedDishes: this.cookedDishes,
        toolLevel: this.toolLevel, vocabLearned: Array.from(this.vocabLearned),
        harvestCount: this.harvestCount,
        achievements: this.achievements.map(a => ({ id: a.id, unlocked: a.unlocked })),
        npcHearts: this.npcs.map(n => n.hearts),
        grid: this.grid.map(row => row.map(t => ({
          terrain: t.terrain, stage: t.stage, cropType: t.cropType, growth: t.growth, hp: t.hp,
        }))),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (e) {
      console.error('[StarFarm] Save failed:', e);
    }
  }

  private _loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const save = JSON.parse(raw);
      this.coins = save.coins ?? 100;
      this.energy = save.energy ?? 100;
      this.day = save.day ?? 1;
      this.season = save.season ?? 'spring';
      this.weather = save.weather ?? 'sunny';
      this.inventory = save.inventory ?? {};
      this.seedsOwned = save.seedsOwned ?? { parsnip: 5 };
      this.forageInventory = save.forageInventory ?? {};
      this.fishInventory = save.fishInventory ?? 0;
      this.wood = save.wood ?? 0;
      this.stone = save.stone ?? 0;
      this.ore = save.ore ?? 0;
      this.cookedDishes = save.cookedDishes ?? {};
      this.toolLevel = save.toolLevel ?? this.toolLevel;
      this.vocabLearned = new Set(save.vocabLearned ?? []);
      this.harvestCount = save.harvestCount ?? 0;
      if (save.achievements) {
        save.achievements.forEach((s: any) => {
          const ach = this.achievements.find(a => a.id === s.id);
          if (ach) ach.unlocked = s.unlocked;
        });
      }
      if (save.npcHearts) {
        this.npcs.forEach((n, i) => { if (save.npcHearts[i] !== undefined) n.hearts = save.npcHearts[i]; });
      }
      if (save.grid) {
        for (let r = 0; r < this.GRID_H && r < save.grid.length; r++) {
          for (let c = 0; c < this.GRID_W && c < save.grid[r].length; c++) {
            const s = save.grid[r][c];
            const tile = this.grid[r][c];
            tile.terrain = s.terrain;
            tile.stage = s.stage;
            tile.cropType = s.cropType;
            tile.growth = s.growth;
            tile.hp = s.hp;
            this._renderTile(tile);
          }
        }
      }
      this._updateUI();
    } catch (e) {
      console.error('[StarFarm] Load failed:', e);
    }
  }

  private _renderTile(tile: Tile) {
    const t = tile.terrain;
    if (t === 'grass') { tile.emoji.setText('🟩'); tile.bg.setFillStyle(0x4a7c3a, 0.75); }
    else if (t === 'dirt') { tile.emoji.setText('🟫'); tile.bg.setFillStyle(0x8b5a2b, 0.8); }
    else if (t === 'water') { tile.emoji.setText('🌊'); tile.bg.setFillStyle(0x2563eb, 0.75); }
    else if (t === 'path') { tile.emoji.setText('⬜'); tile.bg.setFillStyle(0x8b7355, 0.75); }
    else if (t === 'rock') { tile.emoji.setText('🪨'); tile.bg.setFillStyle(0x6b6b6b, 0.75); }
    else if (t === 'tree') { tile.emoji.setText('🌳'); tile.bg.setFillStyle(0x2d5016, 0.75); }
    else if (t === 'forage') {
      const f = Phaser.Utils.Array.GetRandom(FORAGE_ITEMS);
      tile.emoji.setText(f.emoji);
    }
    if (tile.stage === 'watered') tile.bg.setFillStyle(0x3b82f6, 0.5);
    else if (tile.stage === 'seeded') tile.emoji.setText('🌱');
    else if (tile.stage === 'sprout') tile.emoji.setText('🌱');
    else if (tile.stage === 'growing') tile.emoji.setText('🌿');
    else if (tile.stage === 'ready' && tile.cropType) {
      tile.emoji.setText(CROPS[tile.cropType].emoji);
      tile.bg.setFillStyle(this.theme.success, 0.4);
    }
  }

  protected finishGame(won: boolean) {
    this._saveGame();
    super.finishGame(won);
  }
}
