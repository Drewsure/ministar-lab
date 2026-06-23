'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { GameModeId, ThemeId, TermItem, GameLaunchConfig } from '@/lib/types';
import { GAME_MODE_MAP } from '@/lib/gameModes';
import { THEMES } from '@/lib/themes';
import GameCanvas from './GameCanvas';
import { audioBus } from '@/lib/audio';
import { POWER_UPS, type PowerUpType } from '@/lib/multiplayer/arena';

// ============================================================================
// MiniStar Arena — 1v1 Duels + Power-Ups
// ============================================================================

interface DuelPlayer {
  id: string;
  nickname: string;
  avatar: string;
  score: number;
  health: number;
}

interface ArenaSnapshot {
  code: string;
  mode: 'duel' | 'tournament';
  status: 'lobby' | 'playing' | 'finished';
  players: DuelPlayer[];
  currentRound: number;
  maxRounds: number;
  winner?: string;
  powerUpsAvailable: PowerUpType[];
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

export default function LiveArena({ mode, theme, terms, unit, tenantId, onExit }: Props) {
  const [role, setRole] = useState<'choose' | 'host' | 'join'>('choose');
  const [roomCode, setRoomCode] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [snapshot, setSnapshot] = useState<ArenaSnapshot | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeEffects, setActiveEffects] = useState<string[]>([]);

  const hostDuel = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/arena/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname || 'Player 1', avatar, gameMode: mode, theme, terms, unit, maxQuestions: 10 }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setRoomCode(data.code);
      setPlayerId(data.playerId);
      setRole('host');
      audioBus.play('launch');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const joinDuel = async () => {
    if (!roomCode || !nickname) { setError('Need code and nickname'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/arena/join', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: roomCode, nickname, avatar }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setPlayerId(data.playerId);
      setSnapshot(data.snapshot);
      audioBus.play('tap');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const startDuel = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/arena/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: roomCode, playerId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      audioBus.play('correct');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const castPowerUp = async (pu: PowerUpType) => {
    try {
      const res = await fetch('/api/arena/powerup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: roomCode, playerId, powerUp: pu }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      audioBus.play('launch');
      setActiveEffects(e => [...e, pu]);
      setTimeout(() => setActiveEffects(e => e.filter(x => x !== pu)), POWER_UPS[pu].cooldownMs);
    } catch {}
  };

  // SSE subscription
  useEffect(() => {
    if (!roomCode) return;
    const es = new EventSource(`/api/arena/stream?code=${roomCode}`);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.snapshot) setSnapshot(data.snapshot);
        if (data.type === 'duel-started') audioBus.play('launch');
        if (data.type === 'duel-finished') {
          audioBus.play(data.winner === playerId ? 'win' : 'lose');
        }
        if (data.type === 'power-up-cast' && data.target === playerId) {
          // I've been sabotaged!
          audioBus.play('incorrect');
          setActiveEffects(e => [...e, data.powerUp]);
          const dur = data.powerUp === 'freeze' ? 3000 : data.powerUp === 'blind' ? 4000 : 5000;
          setTimeout(() => setActiveEffects(e => e.filter(x => x !== data.powerUp)), dur);
        }
      } catch {}
    };
    return () => { es.close(); };
  }, [roomCode, playerId]);

  const submitAnswer = useCallback(async (success: boolean, term: string, response: string) => {
    if (!playerId || !roomCode) return;
    try {
      await fetch('/api/arena/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: roomCode, playerId, success, term, response }),
      });
    } catch {}
  }, [playerId, roomCode]);

  // CHOOSE ROLE
  if (role === 'choose') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)' }}>
        <div className="max-w-md w-full rounded-3xl p-8 shadow-2xl"
          style={{ background: 'color-mix(in oklab, var(--brand-card) 80%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)' }}>
          <div className="text-center mb-6">
            <div className="text-5xl mb-2">⚔️</div>
            <h1 className="text-2xl font-black mb-1">Arena — 1v1 Duel</h1>
            <p className="text-sm opacity-70">{GAME_MODE_MAP[mode].emoji} {GAME_MODE_MAP[mode].name}</p>
          </div>
          <button onClick={() => { setRole('host'); audioBus.init(); audioBus.play('tap'); }}
            className="w-full mb-3 rounded-2xl p-4 font-bold text-left"
            style={{ background: 'linear-gradient(135deg, #ef4444, #f59e0b)', color: '#fff' }}>
            ⚔️ Create Duel<br/>
            <span className="text-xs opacity-80 font-normal">Get a code, share with opponent</span>
          </button>
          <button onClick={() => { setRole('join'); audioBus.init(); audioBus.play('tap'); }}
            className="w-full rounded-2xl p-4 font-bold text-left"
            style={{ background: 'color-mix(in oklab, var(--brand-accent) 18%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)' }}>
            🤝 Join Duel<br/>
            <span className="text-xs opacity-70 font-normal">Enter a 6-digit code</span>
          </button>
          <button onClick={onExit} className="w-full mt-4 text-xs opacity-60">← Back to library</button>
        </div>
      </div>
    );
  }

  // SETUP SCREEN (host or join)
  if ((role === 'host' && !roomCode) || (role === 'join' && !playerId)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)' }}>
        <div className="max-w-md w-full rounded-3xl p-8 shadow-2xl"
          style={{ background: 'color-mix(in oklab, var(--brand-card) 80%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)' }}>
          <h2 className="text-2xl font-black mb-4 text-center">{role === 'host' ? '⚔️ Create Duel' : '🤝 Join Duel'}</h2>
          {role === 'join' && (
            <input value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} placeholder="ROOM CODE" maxLength={6}
              className="w-full mb-3 rounded-xl px-4 py-3 text-2xl text-center font-mono font-bold tracking-[0.3em]"
              style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)', border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)' }} />
          )}
          <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Your nickname" maxLength={20}
            className="w-full mb-3 rounded-xl px-4 py-3 text-sm"
            style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)', border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)' }} />
          <div className="mb-4">
            <div className="text-xs opacity-60 mb-2">Pick your avatar</div>
            <div className="grid grid-cols-6 gap-2">
              {AVATARS.map(a => (
                <button key={a} onClick={() => setAvatar(a)} className="text-2xl p-2 rounded-xl"
                  style={{ background: avatar === a ? 'var(--brand-accent)' : 'color-mix(in oklab, var(--brand-card) 60%, transparent)', transform: avatar === a ? 'scale(1.1)' : 'scale(1)' }}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          {error && <div className="text-sm mb-3" style={{ color: '#fca5a5' }}>⚠ {error}</div>}
          <button onClick={role === 'host' ? hostDuel : joinDuel} disabled={loading || (role === 'join' && (!roomCode || !nickname))}
            className="w-full rounded-xl p-3 font-bold disabled:opacity-40"
            style={{ background: 'var(--brand-accent)', color: 'var(--brand-bg)' }}>
            {loading ? '...' : role === 'host' ? '⚔️ Create Duel' : '🤝 Join Duel'}
          </button>
          <button onClick={() => setRole('choose')} className="w-full mt-3 text-xs opacity-60">← Back</button>
        </div>
      </div>
    );
  }

  // LOBBY (waiting for opponent)
  if (snapshot?.status === 'lobby') {
    const playerCount = snapshot.players.length;
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)' }}>
        <div className="max-w-md w-full rounded-3xl p-8 text-center shadow-2xl"
          style={{ background: 'color-mix(in oklab, var(--brand-card) 80%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)' }}>
          <div className="text-6xl mb-3 animate-bounce">{avatar}</div>
          <div className="text-xl font-bold mb-1">Hi, {nickname}!</div>
          <div className="text-sm opacity-70 mb-4">Duel code: <span className="font-mono font-bold" style={{ color: 'var(--brand-accent)' }}>{roomCode}</span></div>
          <div className="rounded-xl p-4 mb-4" style={{ background: 'color-mix(in oklab, var(--brand-accent) 10%, transparent)' }}>
            <div className="grid grid-cols-2 gap-2">
              {snapshot.players.map(p => (
                <div key={p.id} className="rounded-lg p-2" style={{ background: 'color-mix(in oklab, var(--brand-accent) 20%, transparent)' }}>
                  <div className="text-3xl">{p.avatar}</div>
                  <div className="text-xs font-bold">{p.nickname}</div>
                </div>
              ))}
              {Array.from({ length: 2 - snapshot.players.length }).map((_, i) => (
                <div key={i} className="rounded-lg p-2 opacity-40" style={{ border: '2px dashed color-mix(in oklab, var(--brand-accent) 30%, transparent)' }}>
                  <div className="text-3xl">?</div>
                  <div className="text-xs">Waiting...</div>
                </div>
              ))}
            </div>
          </div>
          {role === 'host' && playerCount === 2 ? (
            <button onClick={startDuel} disabled={loading}
              className="w-full rounded-xl p-4 font-bold text-lg"
              style={{ background: 'var(--brand-accent)', color: 'var(--brand-bg)' }}>
              {loading ? 'Starting...' : '⚔️ Start Duel!'}
            </button>
          ) : (
            <div className="text-sm opacity-60 animate-pulse">⏳ Waiting for opponent...</div>
          )}
          {error && <div className="text-sm mt-2" style={{ color: '#fca5a5' }}>⚠ {error}</div>}
          <button onClick={onExit} className="mt-4 text-xs opacity-60">← Leave</button>
        </div>
      </div>
    );
  }

  // PLAYING
  if (snapshot?.status === 'playing' && snapshot.players.length === 2) {
    const me = snapshot.players.find(p => p.id === playerId)!;
    const opp = snapshot.players.find(p => p.id !== playerId)!;
    const config: GameLaunchConfig = {
      mode, theme, terms, unit, tenantId,
      multiplayer: { playerId, roomCode, submitAnswer, currentQuestionIndex: snapshot.currentRound },
    } as any;

    return (
      <div className="min-h-screen p-2 sm:p-4" style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)' }}>
        <div className="max-w-6xl mx-auto">
          {/* Versus bar */}
          <div className="grid grid-cols-3 gap-2 mb-3 items-center">
            <PlayerCard player={me} isMe align="left" />
            <div className="text-center">
              <div className="text-3xl font-black" style={{ color: 'var(--brand-accent)' }}>VS</div>
              <div className="text-xs opacity-60">Round {snapshot.currentRound}/{snapshot.maxRounds}</div>
            </div>
            <PlayerCard player={opp} align="right" />
          </div>

          <div className="grid lg:grid-cols-[1fr_180px] gap-3">
            {/* Game canvas with sabotage overlay */}
            <div className="relative rounded-2xl overflow-hidden shadow-2xl"
              style={{ border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)' }}>
              <GameCanvas config={config} onExit={onExit} />
              {/* Sabotage overlays */}
              {activeEffects.includes('freeze') && (
                <div className="absolute inset-0 pointer-events-none z-40 flex items-center justify-center"
                  style={{ background: 'rgba(125, 211, 252, 0.4)', backdropFilter: 'blur(2px)' }}>
                  <div className="text-6xl animate-pulse">❄️</div>
                </div>
              )}
              {activeEffects.includes('blind') && (
                <div className="absolute inset-0 pointer-events-none z-40"
                  style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} />
              )}
              {activeEffects.includes('slow') && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 rounded-full px-3 py-1 text-xs font-bold"
                  style={{ background: 'rgba(245, 158, 11, 0.9)', color: '#000' }}>🐌 SLOWED!</div>
              )}
            </div>

            {/* Power-up sidebar */}
            <div className="rounded-2xl p-3 shadow-xl"
              style={{ background: 'color-mix(in oklab, var(--brand-card) 80%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)' }}>
              <div className="font-bold text-sm mb-2">⚡ Power-Ups</div>
              <div className="space-y-2">
                {(Object.keys(POWER_UPS) as PowerUpType[]).map(pu => {
                  const meta = POWER_UPS[pu];
                  const active = activeEffects.includes(pu);
                  return (
                    <button key={pu} onClick={() => castPowerUp(pu)} disabled={active}
                      className="w-full rounded-xl p-2 text-left transition-all disabled:opacity-30"
                      style={{ background: active ? 'color-mix(in oklab, var(--brand-accent) 10%, transparent)' : 'color-mix(in oklab, var(--brand-accent) 20%, transparent)' }}
                      title={meta.description}>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{meta.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold">{meta.name}</div>
                          <div className="text-[10px] opacity-70 truncate">{meta.description}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // FINISHED
  if (snapshot?.status === 'finished') {
    const won = snapshot.winner === playerId;
    const me = snapshot.players.find(p => p.id === playerId);
    const winner = snapshot.players.find(p => p.id === snapshot.winner);
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)' }}>
        <div className="max-w-md w-full rounded-3xl p-8 text-center shadow-2xl"
          style={{ background: 'color-mix(in oklab, var(--brand-card) 80%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)' }}>
          <div className="text-6xl mb-3">{won ? '🏆' : '💀'}</div>
          <div className="text-2xl font-black mb-1">{won ? 'VICTORY!' : 'DEFEATED'}</div>
          <div className="text-sm opacity-70 mb-4">
            {winner?.avatar} {winner?.nickname} won with {winner?.score} points
          </div>
          <div className="rounded-xl p-4 mb-4" style={{ background: 'color-mix(in oklab, var(--brand-accent) 10%, transparent)' }}>
            <div className="text-xs opacity-70">Your score</div>
            <div className="text-3xl font-black" style={{ color: 'var(--brand-accent)' }}>{me?.score ?? 0}</div>
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

function PlayerCard({ player, isMe, align }: { player: DuelPlayer; isMe?: boolean; align: 'left' | 'right' }) {
  return (
    <div className="rounded-2xl p-3"
      style={{
        background: isMe ? 'color-mix(in oklab, var(--brand-accent) 20%, transparent)' : 'color-mix(in oklab, var(--brand-card) 80%, transparent)',
        border: '1px solid ' + (isMe ? 'var(--brand-accent)' : 'color-mix(in oklab, var(--brand-accent) 20%, transparent)'),
        textAlign: align,
      }}>
      <div className="flex items-center gap-2" style={{ flexDirection: align === 'right' ? 'row-reverse' : 'row' }}>
        <span className="text-3xl">{player.avatar}</span>
        <div style={{ textAlign: align === 'right' ? 'right' : 'left' }}>
          <div className="font-bold text-sm">{player.nickname}{isMe && ' (You)'}</div>
          <div className="text-xs opacity-70">{player.score} pts</div>
        </div>
      </div>
      {/* Health bar */}
      <div className="mt-2 h-3 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.4)' }}>
        <div className="h-full transition-all"
          style={{
            width: `${Math.max(0, player.health)}%`,
            background: player.health > 60 ? 'linear-gradient(90deg, #22c55e, #16a34a)' : player.health > 30 ? 'linear-gradient(90deg, #f59e0b, #d97706)' : 'linear-gradient(90deg, #ef4444, #dc2626)',
            marginLeft: align === 'right' ? 'auto' : 0,
          }} />
      </div>
    </div>
  );
}
