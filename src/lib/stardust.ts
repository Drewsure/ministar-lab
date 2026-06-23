// ============================================================================
// Star Dust — The universal progression currency
// ============================================================================
// Students earn Star Dust by completing educational tasks correctly.
// Star Dust is spent in the Star Garden to grow plants/elements.
// Cumulative Star Dust determines Cloud Dog evolution stage.
// ============================================================================

export interface StarDustProfile {
  total: number;            // total ever earned (for evolution)
  available: number;        // unspent (for Star Garden)
  perGame: number;          // earned this game
  history: { date: string; amount: number; game: string }[];
}

const STORAGE_KEY = 'ministar_stardust';

export function loadStarDust(): StarDustProfile {
  if (typeof window === 'undefined') {
    return { total: 0, available: 0, perGame: 0, history: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        total: 0,
        available: 0,
        perGame: 0,
        history: [],
        ...parsed,
        perGame: 0, // always reset perGame on load
      };
    }
  } catch {}
  return { total: 0, available: 0, perGame: 0, history: [] };
}

export function saveStarDust(profile: StarDustProfile) {
  if (typeof window === 'undefined') return;
  try {
    // Keep history to last 50 entries
    profile.history = profile.history.slice(-50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {}
}

export function earnStarDust(amount: number, gameMode: string): StarDustProfile {
  const profile = loadStarDust();
  profile.total += amount;
  profile.available += amount;
  profile.perGame += amount;
  profile.history.push({
    date: new Date().toISOString(),
    amount,
    game: gameMode,
  });
  saveStarDust(profile);
  return profile;
}

export function spendStarDust(amount: number): StarDustProfile | null {
  const profile = loadStarDust();
  if (profile.available < amount) return null;
  profile.available -= amount;
  saveStarDust(profile);
  return profile;
}

// ============================================================================
// Cloud Dog Evolution Stages
// ============================================================================

export interface EvolutionStage {
  level: number;
  name: string;
  emoji: string;
  accessory: string;
  minStarDust: number;
  description: string;
}

export const EVOLUTION_STAGES: EvolutionStage[] = [
  { level: 1, name: 'Pup', emoji: '🐶', accessory: '', minStarDust: 0, description: 'A fluffy cloud pup just starting its journey.' },
  { level: 2, name: 'Scout', emoji: '🐕', accessory: '🧢', minStarDust: 100, description: 'Earned a scout cap for bravery!' },
  { level: 3, name: 'Explorer', emoji: '🦮', accessory: '👓', minStarDust: 300, description: 'Got explorer glasses to see hidden words!' },
  { level: 4, name: 'Scholar', emoji: '🐩', accessory: '🎓', minStarDust: 600, description: 'Graduated with a scholar graduation cap!' },
  { level: 5, name: 'Hero', emoji: '🦸', accessory: '🦸‍♂️', minStarDust: 1000, description: 'A true vocabulary superhero!' },
  { level: 6, name: 'Wizard', emoji: '🧙', accessory: '🪄', minStarDust: 1500, description: 'Mastered the magic of words!' },
  { level: 7, name: 'Legend', emoji: '👑', accessory: '👑', minStarDust: 2500, description: 'A legendary cloud dog, crowned by the stars.' },
  { level: 8, name: 'Cosmic', emoji: '✨', accessory: '🌌', minStarDust: 5000, description: 'Transcended to cosmic form — one with the universe.' },
];

export function getCurrentEvolution(totalStarDust: number): EvolutionStage {
  let current = EVOLUTION_STAGES[0];
  for (const stage of EVOLUTION_STAGES) {
    if (totalStarDust >= stage.minStarDust) {
      current = stage;
    } else {
      break;
    }
  }
  return current;
}

export function getNextEvolution(totalStarDust: number): EvolutionStage | null {
  for (const stage of EVOLUTION_STAGES) {
    if (totalStarDust < stage.minStarDust) {
      return stage;
    }
  }
  return null; // max evolution reached
}

// ============================================================================
// Star Garden — plants/elements that grow with Star Dust
// ============================================================================

export interface StarGardenPlant {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  stage: number;        // 0 = seed, 1 = sprout, 2 = grown, 3 = bloomed
  plantedAt: string;    // ISO date
  lastWatered: string;  // ISO date
  growthProgress: number; // 0-100
}

export const PLANT_CATALOG: Omit<StarGardenPlant, 'id' | 'stage' | 'plantedAt' | 'lastWatered' | 'growthProgress'>[] = [
  { name: 'Star Flower', emoji: '🌸', cost: 20 },
  { name: 'Cosmic Tree', emoji: '🌳', cost: 50 },
  { name: 'Crystal Mushroom', emoji: '🍄', cost: 35 },
  { name: 'Rainbow Cactus', emoji: '🌵', cost: 40 },
  { name: 'Moon Lotus', emoji: ' Lotus', cost: 60 },
  { name: 'Sun Sprout', emoji: '🌻', cost: 25 },
  { name: 'Cloud Bush', emoji: '☁️', cost: 30 },
  { name: 'Galaxy Vine', emoji: '🌿', cost: 45 },
  { name: 'Meteor Bloom', emoji: '☄️', cost: 80 },
  { name: 'Nebula Fern', emoji: '🌿', cost: 55 },
];

const GARDEN_KEY = 'ministar_garden';

export function loadGarden(): StarGardenPlant[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(GARDEN_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveGarden(plants: StarGardenPlant[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GARDEN_KEY, JSON.stringify(plants));
  } catch {}
}

export function plantSeed(plantType: typeof PLANT_CATALOG[0]): StarGardenPlant | null {
  const profile = spendStarDust(plantType.cost);
  if (!profile) return null;
  const plant: StarGardenPlant = {
    id: `plant-${Date.now()}`,
    name: plantType.name,
    emoji: plantType.emoji,
    cost: plantType.cost,
    stage: 0,
    plantedAt: new Date().toISOString(),
    lastWatered: new Date().toISOString(),
    growthProgress: 0,
  };
  const garden = loadGarden();
  garden.push(plant);
  saveGarden(garden);
  return plant;
}

export function waterPlant(plantId: string): StarGardenPlant | null {
  const garden = loadGarden();
  const plant = garden.find(p => p.id === plantId);
  if (!plant) return null;
  plant.lastWatered = new Date().toISOString();
  plant.growthProgress = Math.min(100, plant.growthProgress + 10);
  if (plant.growthProgress >= 25 && plant.stage < 1) plant.stage = 1;
  if (plant.growthProgress >= 50 && plant.stage < 2) plant.stage = 2;
  if (plant.growthProgress >= 100 && plant.stage < 3) plant.stage = 3;
  saveGarden(garden);
  return plant;
}
