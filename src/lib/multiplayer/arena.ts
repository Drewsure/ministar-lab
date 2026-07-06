// ============================================================================
// MiniStar Arena — 1v1 Duels + Tournaments
// ============================================================================
// Built on top of the multiplayer room system. Adds:
//   - 1v1 duel mode (2 players, head-to-head)
//   - Sabotage power-ups (freeze opponent, swap their answers, blind them)
//   - Tournament brackets (4/8/16 players, single-elim)
//   - Ranked ladder (ELO-style rating)
// ============================================================================

import type { GameModeId, ThemeId, TermItem } from '@/lib/types';

export interface DuelPlayer {
  id: string;
  nickname: string;
  avatar: string;
  score: number;
  health: number; // 100 HP, wrong answer = -20, correct = +5 heal
  effects: PlayerEffect[]; // active sabotage effects
  ready: boolean;
}

export interface PlayerEffect {
  type: 'freeze' | 'blind' | 'swap' | 'slow';
  expiresAt: number; // timestamp
  appliedBy: string; // player id who cast it
}

export interface ArenaRoom {
  code: string;
  mode: 'duel' | 'tournament';
  players: Map<string, DuelPlayer>;
  config: ArenaGameConfig;
  status: 'lobby' | 'playing' | 'finished';
  winner?: string;
  bracket?: BracketNode; // for tournaments
  currentRound: number;
  createdAt: number;
  subscribers: Set<ReadableStreamDefaultController<Uint8Array>>;
  powerUpCooldowns: Map<string, number>; // playerId → last cast time
}

export interface ArenaGameConfig {
  gameMode: GameModeId;
  theme: ThemeId;
  terms: TermItem[];
  unit: string;
  maxQuestions: number;
}

export interface BracketNode {
  player1?: DuelPlayer;
  player2?: DuelPlayer;
  winner?: DuelPlayer;
  next?: BracketNode;
}

export interface ArenaSnapshot {
  code: string;
  mode: 'duel' | 'tournament';
  status: ArenaRoom['status'];
  players: Array<Omit<DuelPlayer, 'effects'>>;
  currentRound: number;
  maxRounds: number;
  winner?: string;
  bracket?: any;
  powerUpsAvailable: PowerUpType[];
}

export type PowerUpType = 'freeze' | 'blind' | 'swap' | 'slow' | 'heal';

export const POWER_UPS: Record<PowerUpType, {
  name: string;
  emoji: string;
  description: string;
  cooldownMs: number;
  cost: number; // tokens
}> = {
  freeze: { name: 'Freeze', emoji: '❄️', description: 'Freeze opponent for 3 seconds', cooldownMs: 15000, cost: 30 },
  blind: { name: 'Blind', emoji: '🌫️', description: "Blur opponent's screen for 4 seconds", cooldownMs: 20000, cost: 40 },
  swap: { name: 'Swap', emoji: '🔄', description: 'Swap two of opponent\'s answer options', cooldownMs: 25000, cost: 50 },
  slow: { name: 'Slow', emoji: '🐌', description: "Slow opponent's timer by 50% for 5 seconds", cooldownMs: 18000, cost: 35 },
  heal: { name: 'Heal', emoji: '💚', description: 'Restore 30 HP to yourself', cooldownMs: 20000, cost: 25 },
};

// ============================
// In-memory store
// ============================
const arenaRooms = new Map<string, ArenaRoom>();

function generateCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code: string;
  do {
    code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (arenaRooms.has(code));
  return code;
}

export function createDuel(opts: {
  nickname: string;
  avatar: string;
  config: ArenaGameConfig;
}): { code: string; playerId: string } {
  const code = generateCode();
  const playerId = `duel_${Math.random().toString(36).slice(2, 12)}`;
  const player: DuelPlayer = {
    id: playerId,
    nickname: opts.nickname,
    avatar: opts.avatar,
    score: 0,
    health: 100,
    effects: [],
    ready: false,
  };
  const room: ArenaRoom = {
    code,
    mode: 'duel',
    players: new Map([[playerId, player]]),
    config: opts.config,
    status: 'lobby',
    currentRound: 0,
    createdAt: Date.now(),
    subscribers: new Set(),
    powerUpCooldowns: new Map(),
  };
  arenaRooms.set(code, room);
  return { code, playerId };
}

export function joinDuel(opts: {
  code: string;
  nickname: string;
  avatar: string;
}): { playerId: string; snapshot: ArenaSnapshot } | { error: string } {
  const room = arenaRooms.get(opts.code.toUpperCase().trim());
  if (!room) return { error: 'Arena not found' };
  if (room.mode !== 'duel') return { error: 'Not a duel room' };
  if (room.players.size >= 2) return { error: 'Duel is full (max 2 players)' };
  if (room.status !== 'lobby') return { error: 'Duel already started' };

  const playerId = `duel_${Math.random().toString(36).slice(2, 12)}`;
  const player: DuelPlayer = {
    id: playerId,
    nickname: opts.nickname,
    avatar: opts.avatar,
    score: 0,
    health: 100,
    effects: [],
    ready: false,
  };
  room.players.set(playerId, player);
  broadcastArena(room, { type: 'player-joined', playerId });
  return { playerId, snapshot: arenaSnapshot(room) };
}

export function startDuel(opts: {
  code: string;
  playerId: string;
}): ArenaSnapshot | { error: string } {
  const room = arenaRooms.get(opts.code.toUpperCase().trim());
  if (!room) return { error: 'Arena not found' };
  if (room.players.size !== 2) return { error: 'Need exactly 2 players' };
  room.status = 'playing';
  room.currentRound = 1;
  broadcastArena(room, { type: 'duel-started' });
  return arenaSnapshot(room);
}

export function submitDuelAnswer(opts: {
  code: string;
  playerId: string;
  success: boolean;
  term: string;
  response: string;
}): ArenaSnapshot | { error: string } {
  const room = arenaRooms.get(opts.code.toUpperCase().trim());
  if (!room) return { error: 'Arena not found' };
  if (room.status !== 'playing') return { error: 'Duel not in progress' };

  const player = room.players.get(opts.playerId);
  if (!player) return { error: 'Player not in duel' };

  // Check if player is frozen
  const now = Date.now();
  const frozen = player.effects.some(e => e.type === 'freeze' && e.expiresAt > now);
  if (frozen) return { error: 'You are frozen!' };

  if (opts.success) {
    player.score += 100;
    player.health = Math.min(100, player.health + 5);
  } else {
    player.health = Math.max(0, player.health - 20);
  }

  // Check win condition: opponent at 0 HP OR score >= max
  const opponent = [...room.players.values()].find(p => p.id !== opts.playerId);
  if (opponent && opponent.health <= 0) {
    room.status = 'finished';
    room.winner = opts.playerId;
    broadcastArena(room, { type: 'duel-finished', winner: opts.playerId });
  } else if (player.score >= room.config.maxQuestions * 100) {
    room.status = 'finished';
    room.winner = opts.playerId;
    broadcastArena(room, { type: 'duel-finished', winner: opts.playerId });
  } else {
    broadcastArena(room, { type: 'answer-submitted', playerId: opts.playerId });
  }

  return arenaSnapshot(room);
}

export function castPowerUp(opts: {
  code: string;
  playerId: string;
  powerUp: PowerUpType;
}): ArenaSnapshot | { error: string } {
  const room = arenaRooms.get(opts.code.toUpperCase().trim());
  if (!room) return { error: 'Arena not found' };
  if (room.status !== 'playing') return { error: 'Duel not in progress' };

  const player = room.players.get(opts.playerId);
  if (!player) return { error: 'Player not in duel' };

  // Check cooldown
  const lastCast = room.powerUpCooldowns.get(opts.playerId + opts.powerUp) ?? 0;
  const cooldown = POWER_UPS[opts.powerUp].cooldownMs;
  if (Date.now() - lastCast < cooldown) {
    return { error: 'Power-up on cooldown' };
  }
  room.powerUpCooldowns.set(opts.playerId + opts.powerUp, Date.now());

  const opponent = [...room.players.values()].find(p => p.id !== opts.playerId);
  if (!opponent) return { error: 'No opponent' };

  const now = Date.now();
  switch (opts.powerUp) {
    case 'freeze':
      opponent.effects.push({ type: 'freeze', expiresAt: now + 3000, appliedBy: opts.playerId });
      break;
    case 'blind':
      opponent.effects.push({ type: 'blind', expiresAt: now + 4000, appliedBy: opts.playerId });
      break;
    case 'swap':
      opponent.effects.push({ type: 'swap', expiresAt: now + 5000, appliedBy: opts.playerId });
      break;
    case 'slow':
      opponent.effects.push({ type: 'slow', expiresAt: now + 5000, appliedBy: opts.playerId });
      break;
    case 'heal':
      player.health = Math.min(100, player.health + 30);
      break;
  }

  broadcastArena(room, { type: 'power-up-cast', by: opts.playerId, target: opts.powerUp === 'heal' ? opts.playerId : opponent.id, powerUp: opts.powerUp });
  return arenaSnapshot(room);
}

export function getArenaSnapshot(code: string): ArenaSnapshot | null {
  const room = arenaRooms.get(code.toUpperCase().trim());
  return room ? arenaSnapshot(room) : null;
}

export function subscribeArena(
  code: string,
  controller: ReadableStreamDefaultController<Uint8Array>
): () => void {
  const room = arenaRooms.get(code.toUpperCase().trim());
  if (!room) {
    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'error', error: 'Arena not found' })}\n\n`));
    controller.close();
    return () => {};
  }
  room.subscribers.add(controller);
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'snapshot', snapshot: arenaSnapshot(room) })}\n\n`));
  return () => { room.subscribers.delete(controller); };
}

// ============================
// Helpers
// ============================
function arenaSnapshot(room: ArenaRoom): ArenaSnapshot {
  const players = [...room.players.values()].map(p => {
    const { effects: _effects, ...rest } = p;
    void _effects;
    return rest;
  });
  return {
    code: room.code,
    mode: room.mode,
    status: room.status,
    players,
    currentRound: room.currentRound,
    maxRounds: room.config.maxQuestions,
    winner: room.winner,
    powerUpsAvailable: ['freeze', 'blind', 'swap', 'slow', 'heal'],
  };
}

function broadcastArena(room: ArenaRoom, event: any) {
  const snap = arenaSnapshot(room);
  const payload = new TextEncoder().encode(`data: ${JSON.stringify({ ...event, snapshot: snap })}\n\n`);
  for (const sub of room.subscribers) {
    try { sub.enqueue(payload); } catch { room.subscribers.delete(sub); }
  }
}
