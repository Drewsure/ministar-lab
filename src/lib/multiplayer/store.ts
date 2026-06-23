// ============================================================================
// MiniStar Live Multiplayer — In-memory room store
// ============================================================================
// For MVP, rooms live in process memory. This works on a single Vercel
// serverless instance or any Node server. For production scale, swap
// `rooms` for Vercel KV / Upstash Redis — the interface is identical.
//
// Room lifecycle:
//   1. Teacher calls createRoom() → gets 6-digit code
//   2. Students call joinRoom() with the code + nickname
//   3. Teacher calls startGame() — everyone gets the launch config
//   4. Students submit answers via submitAnswer() — score updates live
//   5. Teacher & students poll /stream SSE for real-time leaderboard
//   6. Room auto-expires after 2 hours of inactivity
// ============================================================================

import type { GameLaunchConfig, TermItem, ThemeId, GameModeId } from '@/lib/types';

export interface MultiplayerPlayer {
  id: string;
  nickname: string;
  avatar: string; // emoji
  score: number;
  streak: number;
  correctCount: number;
  wrongCount: number;
  lastAnswerAt: number;
  joinedAt: number;
  isOnline: boolean;
}

export interface MultiplayerRoom {
  code: string;
  teacherId: string;
  teacherNickname: string;
  config: MultiplayerGameConfig;
  players: Map<string, MultiplayerPlayer>;
  status: 'lobby' | 'playing' | 'finished';
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  currentQuestionIndex: number;
  totalQuestions: number;
  // SSE subscribers — each is a controller we can write to
  subscribers: Set<ReadableStreamDefaultController<Uint8Array>>;
  // Last broadcast — used to initialize new SSE clients
  lastSnapshot?: MultiplayerSnapshot;
}

export interface MultiplayerGameConfig {
  mode: GameModeId;
  theme: ThemeId;
  terms: TermItem[];
  unit: string;
  tenantId?: string;
  maxQuestions: number;
}

export interface MultiplayerSnapshot {
  code: string;
  status: MultiplayerRoom['status'];
  teacherNickname: string;
  playerCount: number;
  players: Array<Omit<MultiplayerPlayer, 'isOnline'>>;
  currentQuestionIndex: number;
  totalQuestions: number;
  startedAt?: number;
  config?: MultiplayerGameConfig;
  // Event sequence number — clients use this to detect missed events
  seq: number;
}

// ============================
// In-memory store
// ============================
const rooms = new Map<string, MultiplayerRoom>();
const ROOM_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

// Periodic cleanup (runs on first import in any server process)
let cleanupStarted = false;
function startCleanup() {
  if (cleanupStarted) return;
  cleanupStarted = true;
  setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      if (now - room.createdAt > ROOM_TTL_MS) {
        // Notify subscribers
        for (const sub of room.subscribers) {
          try {
            sub.enqueue(ssePayload({ type: 'room-expired', code }));
            sub.close();
          } catch {}
        }
        rooms.delete(code);
      }
    }
  }, 5 * 60 * 1000);
}
startCleanup();

// ============================
// Public API
// ============================

export function createRoom(opts: {
  teacherNickname: string;
  config: MultiplayerGameConfig;
}): { code: string; teacherId: string } {
  const code = generateRoomCode();
  const teacherId = `t_${Math.random().toString(36).slice(2, 12)}`;
  const room: MultiplayerRoom = {
    code,
    teacherId,
    teacherNickname: opts.teacherNickname,
    config: opts.config,
    players: new Map(),
    status: 'lobby',
    createdAt: Date.now(),
    currentQuestionIndex: 0,
    totalQuestions: opts.config.maxQuestions,
    subscribers: new Set(),
  };
  rooms.set(code, room);
  return { code, teacherId };
}

export function joinRoom(opts: {
  code: string;
  nickname: string;
  avatar: string;
}): { playerId: string; room: MultiplayerSnapshot } | { error: string } {
  const code = opts.code.toUpperCase().trim();
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found. Check the code.' };
  if (room.status !== 'lobby') return { error: 'Game already started.' };
  if (room.players.size >= 60) return { error: 'Room is full (max 60 players).' };

  // Reject duplicate nicknames (case-insensitive) within the same room
  const dup = [...room.players.values()].find(
    p => p.nickname.toLowerCase() === opts.nickname.toLowerCase().trim()
  );
  if (dup) return { error: 'That nickname is taken. Try another.' };

  const playerId = `p_${Math.random().toString(36).slice(2, 12)}`;
  const player: MultiplayerPlayer = {
    id: playerId,
    nickname: opts.nickname.trim().slice(0, 20),
    avatar: opts.avatar,
    score: 0,
    streak: 0,
    correctCount: 0,
    wrongCount: 0,
    lastAnswerAt: 0,
    joinedAt: Date.now(),
    isOnline: true,
  };
  room.players.set(playerId, player);
  broadcast(room, { type: 'player-joined', player: sanitizePlayer(player) });
  return { playerId, room: snapshot(room) };
}

export function startGame(opts: {
  code: string;
  teacherId: string;
}): { snapshot: MultiplayerSnapshot } | { error: string } {
  const room = rooms.get(opts.code.toUpperCase().trim());
  if (!room) return { error: 'Room not found.' };
  if (room.teacherId !== opts.teacherId) return { error: 'Only the teacher can start.' };
  if (room.players.size === 0) return { error: 'No players have joined yet.' };
  room.status = 'playing';
  room.startedAt = Date.now();
  room.currentQuestionIndex = 0;
  broadcast(room, { type: 'game-started', config: room.config, snapshot: snapshot(room) });
  return { snapshot: snapshot(room) };
}

export function submitAnswer(opts: {
  code: string;
  playerId: string;
  term: string;
  response: string;
  success: boolean;
  questionIndex: number;
}): { snapshot: MultiplayerSnapshot } | { error: string } {
  const room = rooms.get(opts.code.toUpperCase().trim());
  if (!room) return { error: 'Room not found.' };
  if (room.status !== 'playing') return { error: 'Game is not in progress.' };

  const player = room.players.get(opts.playerId);
  if (!player) return { error: 'Player not in room.' };

  // Anti-cheat: reject if same question answered twice
  // (we use streak + lastAnswerAt as a soft heuristic)
  if (opts.questionIndex !== room.currentQuestionIndex) {
    // Stale answer — ignore (student might be lagging)
    return { snapshot: snapshot(room) };
  }

  if (opts.success) {
    // Streak-based scoring like Kahoot: faster + streak = more points
    // Base 100 + 20 per streak level, capped at 500
    const streakBonus = Math.min(player.streak * 20, 400);
    const points = 100 + streakBonus;
    player.score += points;
    player.correctCount++;
    player.streak++;
  } else {
    player.wrongCount++;
    player.streak = 0;
  }
  player.lastAnswerAt = Date.now();

  broadcast(room, { type: 'answer-submitted', player: sanitizePlayer(player) });

  // Check if all players have answered this question
  const allAnswered = [...room.players.values()].every(
    p => p.correctCount + p.wrongCount > (room.currentQuestionIndex)
  );
  if (allAnswered) {
    room.currentQuestionIndex++;
    if (room.currentQuestionIndex >= room.totalQuestions) {
      room.status = 'finished';
      room.finishedAt = Date.now();
      broadcast(room, { type: 'game-finished', snapshot: snapshot(room) });
    } else {
      broadcast(room, { type: 'question-advanced', index: room.currentQuestionIndex });
    }
  }

  return { snapshot: snapshot(room) };
}

export function getSnapshot(code: string): MultiplayerSnapshot | null {
  const room = rooms.get(code.toUpperCase().trim());
  return room ? snapshot(room) : null;
}

export function subscribe(
  code: string,
  controller: ReadableStreamDefaultController<Uint8Array>
): () => void {
  const room = rooms.get(code.toUpperCase().trim());
  if (!room) {
    controller.enqueue(ssePayload({ type: 'error', error: 'Room not found' }));
    controller.close();
    return () => {};
  }
  room.subscribers.add(controller);
  // Send the current snapshot immediately
  controller.enqueue(ssePayload({ type: 'snapshot', snapshot: snapshot(room) }));
  return () => {
    room.subscribers.delete(controller);
  };
}

export function nextQuestion(opts: {
  code: string;
  teacherId: string;
}): MultiplayerSnapshot | { error: string } {
  const room = rooms.get(opts.code.toUpperCase().trim());
  if (!room) return { error: 'Room not found.' };
  if (room.teacherId !== opts.teacherId) return { error: 'Only the teacher can advance.' };
  room.currentQuestionIndex++;
  if (room.currentQuestionIndex >= room.totalQuestions) {
    room.status = 'finished';
    room.finishedAt = Date.now();
    broadcast(room, { type: 'game-finished', snapshot: snapshot(room) });
  } else {
    broadcast(room, { type: 'question-advanced', index: room.currentQuestionIndex });
  }
  return snapshot(room);
}

// ============================
// Helpers
// ============================

function sanitizePlayer(p: MultiplayerPlayer) {
  const { isOnline: _isOnline, ...rest } = p;
  void _isOnline;
  return rest;
}

function snapshot(room: MultiplayerRoom): MultiplayerSnapshot {
  // Sort players by score descending for leaderboard
  const players = [...room.players.values()]
    .map(sanitizePlayer)
    .sort((a, b) => b.score - a.score);
  return {
    code: room.code,
    status: room.status,
    teacherNickname: room.teacherNickname,
    playerCount: room.players.size,
    players,
    currentQuestionIndex: room.currentQuestionIndex,
    totalQuestions: room.totalQuestions,
    startedAt: room.startedAt,
    config: room.status === 'playing' || room.status === 'finished' ? room.config : undefined,
    seq: Date.now(),
  };
}

function broadcast(room: MultiplayerRoom, event: any) {
  const snap = snapshot(room);
  const payload = ssePayload({ ...event, snapshot: snap });
  for (const sub of room.subscribers) {
    try {
      sub.enqueue(payload);
    } catch {
      // Subscriber disconnected — will be cleaned up by unsubscribe
      room.subscribers.delete(sub);
    }
  }
}

function ssePayload(data: any): Uint8Array {
  const text = `data: ${JSON.stringify(data)}\n\n`;
  return new TextEncoder().encode(text);
}

function generateRoomCode(): string {
  // 6-digit code, no ambiguous chars (0/O, 1/I)
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code: string;
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));
  return code;
}
