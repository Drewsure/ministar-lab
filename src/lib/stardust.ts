// Star Dust — progression currency + Cloud Dog evolution + Star Garden

export interface StarDustProfile { total: number; available: number; perGame: number; history: { date: string; amount: number; game: string }[]; }
const KEY = 'ministar_stardust';
export function loadStarDust(): StarDustProfile {
  if (typeof window === 'undefined') return { total: 0, available: 0, perGame: 0, history: [] };
  try { const raw = localStorage.getItem(KEY); if (raw) return { total: 0, available: 0, perGame: 0, history: [], ...JSON.parse(raw), perGame: 0 }; } catch {}
  return { total: 0, available: 0, perGame: 0, history: [] };
}
export function saveStarDust(p: StarDustProfile) { if (typeof window === 'undefined') return; try { localStorage.setItem(KEY, JSON.stringify({ ...p, history: p.history.slice(-50) })); } catch {} }
export function earnStarDust(amount: number, game: string): StarDustProfile {
  const p = loadStarDust(); p.total += amount; p.available += amount; p.perGame += amount;
  p.history.push({ date: new Date().toISOString(), amount, game }); saveStarDust(p); return p;
}
export function spendStarDust(amount: number): StarDustProfile | null {
  const p = loadStarDust(); if (p.available < amount) return null; p.available -= amount; saveStarDust(p); return p;
}

export interface EvolutionStage { level: number; name: string; emoji: string; accessory: string; minStarDust: number; description: string; }
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
export function getCurrentEvolution(total: number): EvolutionStage { let c = EVOLUTION_STAGES[0]; for (const s of EVOLUTION_STAGES) { if (total >= s.minStarDust) c = s; else break; } return c; }
export function getNextEvolution(total: number): EvolutionStage | null { for (const s of EVOLUTION_STAGES) { if (total < s.minStarDust) return s; } return null; }

export interface StarGardenPlant { id: string; name: string; emoji: string; cost: number; stage: number; plantedAt: string; lastWatered: string; growthProgress: number; }
export const PLANT_CATALOG = [
  { name: 'Star Flower', emoji: '🌸', cost: 20 }, { name: 'Cosmic Tree', emoji: '🌳', cost: 50 },
  { name: 'Crystal Mushroom', emoji: '🍄', cost: 35 }, { name: 'Rainbow Cactus', emoji: '🌵', cost: 40 },
  { name: 'Sun Sprout', emoji: '🌻', cost: 25 }, { name: 'Cloud Bush', emoji: '☁️', cost: 30 },
  { name: 'Galaxy Vine', emoji: '🌿', cost: 45 }, { name: 'Meteor Bloom', emoji: '☄️', cost: 80 },
];
const GARDEN_KEY = 'ministar_garden';
export function loadGarden(): StarGardenPlant[] { if (typeof window === 'undefined') return []; try { const raw = localStorage.getItem(GARDEN_KEY); if (raw) return JSON.parse(raw); } catch {} return []; }
export function saveGarden(plants: StarGardenPlant[]) { if (typeof window === 'undefined') return; try { localStorage.setItem(GARDEN_KEY, JSON.stringify(plants)); } catch {} }
export function plantSeed(pt: typeof PLANT_CATALOG[0]): StarGardenPlant | null {
  const p = spendStarDust(pt.cost); if (!p) return null;
  const plant: StarGardenPlant = { id: `plant-${Date.now()}`, name: pt.name, emoji: pt.emoji, cost: pt.cost, stage: 0, plantedAt: new Date().toISOString(), lastWatered: new Date().toISOString(), growthProgress: 0 };
  const g = loadGarden(); g.push(plant); saveGarden(g); return plant;
}
export function waterPlant(id: string): StarGardenPlant | null {
  const g = loadGarden(); const p = g.find(x => x.id === id); if (!p) return null;
  p.lastWatered = new Date().toISOString(); p.growthProgress = Math.min(100, p.growthProgress + 10);
  if (p.growthProgress >= 25 && p.stage < 1) p.stage = 1; if (p.growthProgress >= 50 && p.stage < 2) p.stage = 2; if (p.growthProgress >= 100 && p.stage < 3) p.stage = 3;
  saveGarden(g); return p;
}
