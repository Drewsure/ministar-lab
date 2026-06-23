'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { GameModeId, ThemeId, TermItem, GameLaunchConfig } from '@/lib/types';
import { GAME_MODE_MAP } from '@/lib/gameModes';
import { THEMES } from '@/lib/themes';
import GameCanvas from './GameCanvas';
import { audioBus } from '@/lib/audio';

// ============================================================================
// MiniStar Live — Real-time classroom multiplayer
// ============================================================================
// Teacher flow:
//   1. Pick game mode + theme → click "Host Live"
//   2. Get 6-digit room code + QR (rendered as a URL students visit)
//   3. Watch live leaderboard as students join
//   4. Click "Start Game" — all students launch the same game simultaneously
//   5. Watch real-time scores stream in
//
// Student flow:
//   1. Visit /?room=XXXXXX (or click "Join Live" button)
//   2. Enter nickname + pick avatar emoji
//   3. Wait in lobby until teacher starts
//   4. Play the game — each correct answer streams to the leaderboard
//   5. See final ranking at the end
// ============================================================================

interface Player {
  id: string;
  nickname: string;
  avatar: string;
  score: number;
  streak: number;
  correctCount: number;
  wrongCount: number;
}

interface RoomSnapshot {
  code: string;
  status: 'lobby' | 'playing' | 'finished';
  teacherNickname: string;
  playerCount: number;
  players: Player[];
  currentQuestionIndex: number;
  totalQuestions: number;
  startedAt?: number;
  config?: {
    mode: GameModeId;
    theme: ThemeId;
    terms: TermItem[];
    unit: string;
    tenantId?: string;
    maxQuestions: number;
  };
  seq: number;
}

const AVATARS = ['🦊', '🐼', '🦄', '🐸', '🐯', '🦉', '🐙', '🦋', '🐝', '🦖', '🐬', '🦚'];

interface Props {
  mode: GameModeId;
  theme: ThemeId;
  terms: TermItem[];
  unit: string;
  tenantId?: string;
  onExit: () => void;
}

export default function LiveMultiplayer({ mode, theme, terms, unit, tenantId, onExit }: Props) {
  const [role, setRole] = useState<'choose' | 'teacher' | 'student'>('choose');
  const [roomCode, setRoomCode] = useState<string>('');
  const [teacherId, setTeacherId] = useState<string>('');
  const [playerId, setPlayerId] = useState<string>('');
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // --- Teacher: create room ---
  const hostRoom = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/multiplayer/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherNickname: nickname || 'Teacher',
          mode, theme, terms, unit, tenantId,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setRoomCode(data.code);
      setTeacherId(data.teacherId);
      setRole('teacher');
      audioBus.init();
      audioBus.play('launch');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Student: join room ---
  const joinRoom = async () => {
    if (!roomCode || !nickname) { setError('Need room code and nickname'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/multiplayer/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: roomCode, nickname, avatar }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setPlayerId(data.playerId);
      setSnapshot(data.room);
      setRole('student');
      audioBus.init();
      audioBus.play('tap');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Teacher: start game ---
  const startGame = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/multiplayer/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: roomCode, teacherId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      audioBus.play('correct');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // --- SSE subscription (both teacher & student) ---
  useEffect(() => {
    if (!roomCode || role === 'choose') return;
    const es = new EventSource(`/api/multiplayer/stream?code=${roomCode}`);
    eventSourceRef.current = es;
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.snapshot) setSnapshot(data.snapshot);
        if (data.type === 'game-started' && role === 'student') {
          audioBus.play('launch');
        }
        if (data.type === 'game-finished') {
          audioBus.play(data.snapshot?.players[0]?.id === playerId ? 'win' : 'lose');
        }
      } catch {}
    };
    return () => { es.close(); };
  }, [roomCode, role, playerId]);

  // --- Student: submit answer (called from GameCanvas wrapper) ---
  const submitAnswer = useCallback(async (success: boolean, term: string, response: string) => {
    if (!playerId || !roomCode || !snapshot) return;
    try {
      await fetch('/api/multiplayer/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: roomCode,
          playerId,
          term, response, success,
          questionIndex: snapshot.currentQuestionIndex,
        }),
      });
    } catch {}
  }, [playerId, roomCode, snapshot]);

  // ===========================================================================
  // CHOOSE ROLE SCREEN
  // ===========================================================================
  if (role === 'choose') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)' }}>
        <div className="max-w-md w-full rounded-3xl p-8 shadow-2xl"
          style={{
            background: 'color-mix(in oklab, var(--brand-card) 80%, transparent)',
            border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)',
          }}>
          <div className="text-center mb-6">
            <div className="text-5xl mb-2">🎮</div>
            <h1 className="text-2xl font-black mb-1">Live Multiplayer</h1>
            <p className="text-sm opacity-70">{GAME_MODE_MAP[mode].emoji} {GAME_MODE_MAP[mode].name}</p>
          </div>
          <button
            onClick={() => { setRole('teacher'); audioBus.init(); audioBus.play('tap'); }}
            className="w-full mb-3 rounded-2xl p-4 font-bold text-left transition-all hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg, var(--brand-accent), color-mix(in oklab, var(--brand-accent) 70%, var(--brand-primary)))', color: 'var(--brand-bg)' }}>
              👨‍🏫 Host as Teacher<br/>
              <span className="text-xs opacity-80 font-normal">Create a room, students join with code</span>
            </button>
          <button
            onClick={() => { setRole('student'); audioBus.init(); audioBus.play('tap'); }}
            className="w-full rounded-2xl p-4 font-bold text-left transition-all hover:scale-[1.02]"
            style={{ background: 'color-mix(in oklab, var(--brand-accent) 18%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)', color: 'var(--brand-text)' }}>
              ✋ Join as Student<br/>
              <span className="text-xs opacity-70 font-normal">Enter a 6-digit room code</span>
            </button>
          <button onClick={onExit} className="w-full mt-4 text-xs opacity-60 hover:opacity-100">← Back to library</button>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // TEACHER FLOW
  // ===========================================================================
  if (role === 'teacher') {
    return (
      <TeacherView
        roomCode={roomCode}
        nickname={nickname}
        setNickname={setNickname}
        snapshot={snapshot}
        loading={loading}
        error={error}
        onHost={hostRoom}
        onStart={startGame}
        onExit={onExit}
      />
    );
  }

  // ===========================================================================
  // STUDENT FLOW
  // ===========================================================================
  return (
    <StudentView
      roomCode={roomCode}
      setRoomCode={setRoomCode}
      nickname={nickname}
      setNickname={setNickname}
      avatar={avatar}
      setAvatar={setAvatar}
      snapshot={snapshot}
      playerId={playerId}
      loading={loading}
      error={error}
      onJoin={joinRoom}
      onSubmitAnswer={submitAnswer}
      onExit={onExit}
    />
  );
}

// =========================================================================
// TEACHER VIEW
// =========================================================================
function TeacherView(props: any) {
  const { roomCode, nickname, setNickname, snapshot, loading, error, onHost, onStart, onExit } = props;
  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/?room=${roomCode}` : '';

  if (!roomCode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)' }}>
        <div className="max-w-md w-full rounded-3xl p-8 shadow-2xl"
          style={{ background: 'color-mix(in oklab, var(--brand-card) 80%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)' }}>
          <h2 className="text-2xl font-black mb-4 text-center">👨‍🏫 Host a Live Game</h2>
          <input
            value={nickname} onChange={e => setNickname(e.target.value)}
            placeholder="Your name (optional)"
            className="w-full mb-3 rounded-xl px-4 py-3 text-sm"
            style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)', border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)' }}
          />
          {error && <div className="text-sm mb-3" style={{ color: '#fca5a5' }}>⚠ {error}</div>}
          <button onClick={onHost} disabled={loading}
            className="w-full rounded-xl p-3 font-bold"
            style={{ background: 'var(--brand-accent)', color: 'var(--brand-bg)' }}>
            {loading ? 'Creating...' : '🎯 Create Room'}
          </button>
          <button onClick={onExit} className="w-full mt-3 text-xs opacity-60">← Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)' }}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase tracking-widest opacity-60">Live Room · Teacher view</div>
            <div className="font-black text-2xl">Room Code: {roomCode}</div>
          </div>
          <button onClick={onExit} className="rounded-xl px-4 py-2 text-sm font-semibold"
            style={{ background: 'color-mix(in oklab, var(--brand-accent) 20%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)' }}>
            ← End Session
          </button>
        </div>

        {/* Lobby / Playing / Finished */}
        {snapshot?.status === 'lobby' && (
          <div className="grid md:grid-cols-2 gap-4">
            {/* Left: Join instructions */}
            <div className="rounded-3xl p-6 text-center"
              style={{ background: 'color-mix(in oklab, var(--brand-card) 80%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)' }}>
              <div className="text-xs uppercase tracking-widest opacity-60 mb-2">Students visit</div>
              <div className="font-mono text-lg font-bold mb-3 break-all" style={{ color: 'var(--brand-accent)' }}>
                {joinUrl}
              </div>
              <div className="text-xs opacity-70 mb-4">Or enter code manually:</div>
              <div className="text-5xl font-black tracking-[0.3em] mb-4" style={{ color: 'var(--brand-accent)' }}>
                {roomCode}
              </div>
              <div className="text-2xl mb-1">{snapshot.playerCount} 👥 joined</div>
              <div className="text-xs opacity-60">Waiting for students...</div>
            </div>

            {/* Right: Player list + start button */}
            <div className="rounded-3xl p-6"
              style={{ background: 'color-mix(in oklab, var(--brand-card) 80%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)' }}>
              <div className="font-bold mb-3">Players</div>
              <div className="space-y-2 max-h-72 overflow-y-auto mb-4">
                {snapshot.players.length === 0 && (
                  <div className="text-sm opacity-50 italic">No one yet — share the code!</div>
                )}
                {snapshot.players.map((p: Player, i: number) => (
                  <div key={p.id} className="flex items-center gap-2 text-sm">
                    <span className="text-2xl">{p.avatar}</span>
                    <span className="font-semibold">{p.nickname}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={onStart}
                disabled={loading || snapshot.playerCount === 0}
                className="w-full rounded-xl p-4 font-bold text-lg disabled:opacity-40"
                style={{ background: 'var(--brand-accent)', color: 'var(--brand-bg)' }}>
                {snapshot.playerCount === 0 ? 'Waiting for players...' : '🚀 Start Game!'}
              </button>
              {error && <div className="text-sm mt-2" style={{ color: '#fca5a5' }}>⚠ {error}</div>}
            </div>
          </div>
        )}

        {snapshot?.status === 'playing' && (
          <LiveLeaderboard snapshot={snapshot} />
        )}

        {snapshot?.status === 'finished' && (
          <LiveLeaderboard snapshot={snapshot} finished />
        )}
      </div>
    </div>
  );
}

// =========================================================================
// STUDENT VIEW
// =========================================================================
function StudentView(props: any) {
  const { roomCode, setRoomCode, nickname, setNickname, avatar, setAvatar, snapshot, playerId, loading, error, onJoin, onSubmitAnswer, onExit } = props;

  // Pre-join screen
  if (!playerId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)' }}>
        <div className="max-w-md w-full rounded-3xl p-8 shadow-2xl"
          style={{ background: 'color-mix(in oklab, var(--brand-card) 80%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)' }}>
          <h2 className="text-2xl font-black mb-4 text-center">✋ Join Live Game</h2>
          <input
            value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())}
            placeholder="ROOM CODE"
            maxLength={6}
            className="w-full mb-3 rounded-xl px-4 py-3 text-2xl text-center font-mono font-bold tracking-[0.3em]"
            style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)', border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)' }}
          />
          <input
            value={nickname} onChange={e => setNickname(e.target.value)}
            placeholder="Your nickname"
            maxLength={20}
            className="w-full mb-3 rounded-xl px-4 py-3 text-sm"
            style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)', border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)' }}
          />
          <div className="mb-4">
            <div className="text-xs opacity-60 mb-2">Pick your avatar</div>
            <div className="grid grid-cols-6 gap-2">
              {AVATARS.map(a => (
                <button key={a} onClick={() => setAvatar(a)}
                  className="text-2xl p-2 rounded-xl transition-all"
                  style={{
                    background: avatar === a ? 'var(--brand-accent)' : 'color-mix(in oklab, var(--brand-card) 60%, transparent)',
                    transform: avatar === a ? 'scale(1.1)' : 'scale(1)',
                  }}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          {error && <div className="text-sm mb-3" style={{ color: '#fca5a5' }}>⚠ {error}</div>}
          <button onClick={onJoin} disabled={loading || !roomCode || !nickname}
            className="w-full rounded-xl p-3 font-bold disabled:opacity-40"
            style={{ background: 'var(--brand-accent)', color: 'var(--brand-bg)' }}>
            {loading ? 'Joining...' : '🚀 Join Game'}
          </button>
          <button onClick={onExit} className="w-full mt-3 text-xs opacity-60">← Back</button>
        </div>
      </div>
    );
  }

  // Lobby — waiting for teacher
  if (snapshot?.status === 'lobby') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)' }}>
        <div className="max-w-md w-full rounded-3xl p-8 text-center shadow-2xl"
          style={{ background: 'color-mix(in oklab, var(--brand-card) 80%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)' }}>
          <div className="text-6xl mb-3 animate-bounce">{avatar}</div>
          <div className="text-xl font-bold mb-1">Hi, {nickname}!</div>
          <div className="text-sm opacity-70 mb-4">In room <span className="font-mono font-bold" style={{ color: 'var(--brand-accent)' }}>{roomCode}</span></div>
          <div className="rounded-xl p-4 mb-4" style={{ background: 'color-mix(in oklab, var(--brand-accent) 10%, transparent)' }}>
            <div className="text-3xl mb-1">{snapshot.playerCount}</div>
            <div className="text-xs opacity-70">players waiting</div>
          </div>
          <div className="text-sm opacity-60">
            <span className="inline-block animate-pulse">⏳ Waiting for teacher to start...</span>
          </div>
          <button onClick={onExit} className="mt-4 text-xs opacity-60">← Leave room</button>
        </div>
      </div>
    );
  }

  // Playing — show game canvas + mini leaderboard
  if (snapshot?.status === 'playing' && snapshot.config) {
    const config: GameLaunchConfig = {
      mode: snapshot.config.mode,
      theme: snapshot.config.theme,
      terms: snapshot.config.terms,
      unit: snapshot.config.unit,
      tenantId: snapshot.config.tenantId,
      // Pass multiplayer context so the game can submit answers
      multiplayer: {
        playerId,
        roomCode,
        submitAnswer: onSubmitAnswer,
        currentQuestionIndex: snapshot.currentQuestionIndex,
      },
    } as any;

    return (
      <div className="min-h-screen p-2 sm:p-4" style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="text-sm font-bold">Room {roomCode} · Question {snapshot.currentQuestionIndex + 1}/{snapshot.totalQuestions}</div>
            <div className="text-xs opacity-60">{nickname} {avatar}</div>
          </div>
          <div className="grid lg:grid-cols-[1fr_240px] gap-3">
            <div className="rounded-2xl overflow-hidden shadow-2xl"
              style={{ border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)' }}>
              <GameCanvas config={config} onExit={onExit} />
            </div>
            <MiniLeaderboard snapshot={snapshot} playerId={playerId} />
          </div>
        </div>
      </div>
    );
  }

  // Finished — show final ranking
  if (snapshot?.status === 'finished') {
    const myRank = snapshot.players.findIndex(p => p.id === playerId) + 1;
    const isWinner = myRank === 1;
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)' }}>
        <div className="max-w-md w-full rounded-3xl p-8 text-center shadow-2xl"
          style={{ background: 'color-mix(in oklab, var(--brand-card) 80%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)' }}>
          <div className="text-6xl mb-3">{isWinner ? '🏆' : myRank <= 3 ? '🥈' : '🎮'}</div>
          <div className="text-2xl font-black mb-1">
            {isWinner ? 'You Won!' : `You came #${myRank}!`}
          </div>
          <div className="text-sm opacity-70 mb-4">
            Score: <span className="font-bold" style={{ color: 'var(--brand-accent)' }}>
              {snapshot.players.find(p => p.id === playerId)?.score ?? 0}
            </span>
          </div>
          <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
            {snapshot.players.map((p: Player, i: number) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg p-2 text-sm"
                style={{
                  background: p.id === playerId ? 'color-mix(in oklab, var(--brand-accent) 20%, transparent)' : 'transparent',
                  border: p.id === playerId ? '1px solid var(--brand-accent)' : '1px solid transparent',
                }}>
                <span>#{i + 1} {p.avatar} {p.nickname}</span>
                <span className="font-bold">{p.score}</span>
              </div>
            ))}
          </div>
          <button onClick={onExit} className="w-full rounded-xl p-3 font-bold"
            style={{ background: 'var(--brand-accent)', color: 'var(--brand-bg)' }}>
            ← Back to Library
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// =========================================================================
// Live Leaderboard (teacher projector view)
// =========================================================================
function LiveLeaderboard({ snapshot, finished }: { snapshot: RoomSnapshot; finished?: boolean }) {
  const topPlayers = [...snapshot.players].sort((a, b) => b.score - a.score).slice(0, 10);
  return (
    <div className="rounded-3xl p-6 shadow-2xl"
      style={{ background: 'color-mix(in oklab, var(--brand-card) 80%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-black">
          {finished ? '🏆 Final Rankings' : '📊 Live Leaderboard'}
        </h2>
        <div className="text-sm opacity-70">
          Q {snapshot.currentQuestionIndex + 1}/{snapshot.totalQuestions} · {snapshot.playerCount} players
        </div>
      </div>
      <div className="space-y-2">
        {topPlayers.map((p, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
          return (
            <div key={p.id} className="flex items-center gap-3 rounded-xl p-3 transition-all"
              style={{
                background: i < 3 ? 'color-mix(in oklab, var(--brand-accent) 15%, transparent)' : 'transparent',
                border: '1px solid color-mix(in oklab, var(--brand-accent) 20%, transparent)',
                fontSize: i < 3 ? '1.1rem' : '0.95rem',
              }}>
              <span className="text-2xl w-12 text-center">{medal}</span>
              <span className="text-3xl">{p.avatar}</span>
              <span className="font-bold flex-1">{p.nickname}</span>
              <span className="font-mono font-bold text-lg" style={{ color: 'var(--brand-accent)' }}>{p.score}</span>
            </div>
          );
        })}
        {topPlayers.length === 0 && <div className="text-center opacity-50 py-8">No scores yet</div>}
      </div>
    </div>
  );
}

// =========================================================================
// Mini Leaderboard (student side panel while playing)
// =========================================================================
function MiniLeaderboard({ snapshot, playerId }: { snapshot: RoomSnapshot; playerId: string }) {
  const top = [...snapshot.players].sort((a, b) => b.score - a.score).slice(0, 5);
  const myRank = snapshot.players.findIndex(p => p.id === playerId) + 1;
  const me = snapshot.players.find(p => p.id === playerId);
  return (
    <div className="rounded-2xl p-3 shadow-xl"
      style={{ background: 'color-mix(in oklab, var(--brand-card) 80%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)' }}>
      <div className="font-bold text-sm mb-2">📊 Top 5</div>
      <div className="space-y-1 mb-3">
        {top.map((p, i) => (
          <div key={p.id} className="flex items-center gap-2 text-xs"
            style={{ opacity: p.id === playerId ? 1 : 0.85, fontWeight: p.id === playerId ? 'bold' : 'normal' }}>
            <span className="w-4">#{i + 1}</span>
            <span className="text-lg">{p.avatar}</span>
            <span className="flex-1 truncate">{p.nickname}</span>
            <span className="font-mono" style={{ color: 'var(--brand-accent)' }}>{p.score}</span>
          </div>
        ))}
      </div>
      {me && myRank > 5 && (
        <div className="border-t pt-2 mt-2 text-xs flex items-center gap-2"
          style={{ borderColor: 'color-mix(in oklab, var(--brand-accent) 20%, transparent)' }}>
          <span>#{myRank}</span>
          <span className="text-lg">{me.avatar}</span>
          <span className="flex-1 truncate">You</span>
          <span className="font-mono" style={{ color: 'var(--brand-accent)' }}>{me.score}</span>
        </div>
      )}
    </div>
  );
}
