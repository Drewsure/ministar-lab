'use client';
import { useState, useEffect, useCallback } from 'react';
import type { GameModeId, ThemeId, TermItem, GameLaunchConfig } from '@/lib/types';
import { GAME_MODE_MAP } from '@/lib/gameModes';
import { THEMES } from '@/lib/themes';
import GameCanvas from './GameCanvas';
import { audioBus } from '@/lib/audio';

interface Player { id: string; nickname: string; avatar: string; score: number; streak: number; correctCount: number; wrongCount: number; }
interface RoomSnapshot { code: string; status: 'lobby' | 'playing' | 'finished'; teacherNickname: string; playerCount: number; players: Player[]; currentQuestionIndex: number; totalQuestions: number; config?: any; seq: number; }

const AVATARS = ['🦊','🐼','🦄','🐸','🐯','🦉','🐙','🦋','🐝','🦖','🐬','🦚'];

export default function LiveMultiplayer({ mode, theme, terms, unit, tenantId, onExit }: { mode: GameModeId; theme: ThemeId; terms: TermItem[]; unit: string; tenantId?: string; onExit: () => void }) {
  const [role, setRole] = useState<'choose' | 'teacher' | 'student'>('choose');
  const [roomCode, setRoomCode] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hostRoom = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/multiplayer/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacherNickname: nickname || 'Teacher', mode, theme, terms, unit, maxQuestions: 10 }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setRoomCode(data.code); setPlayerId(data.teacherId); setRole('teacher'); audioBus.play('launch');
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  const joinRoom = async () => {
    if (!roomCode || !nickname) { setError('Need code and nickname'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/multiplayer/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: roomCode, nickname, avatar }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setPlayerId(data.playerId); setSnapshot(data.room); audioBus.play('tap');
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  const startGame = async () => {
    setLoading(true);
    try { await fetch('/api/multiplayer/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: roomCode, teacherId: playerId }) }); audioBus.play('correct'); } catch {} finally { setLoading(false); }
  };
  const submitAnswer = useCallback(async (success: boolean, term: string, response: string) => {
    if (!playerId || !roomCode || !snapshot) return;
    try { await fetch('/api/multiplayer/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: roomCode, playerId, term, response, success, questionIndex: snapshot.currentQuestionIndex }) }); } catch {}
  }, [playerId, roomCode, snapshot]);

  useEffect(() => {
    if (!roomCode) return;
    const es = new EventSource(`/api/multiplayer/stream?code=${roomCode}`);
    es.onmessage = (ev) => { try { const data = JSON.parse(ev.data); if (data.snapshot) setSnapshot(data.snapshot); if (data.type === 'game-started' && role === 'student') audioBus.play('launch'); if (data.type === 'game-finished') audioBus.play(data.snapshot?.players[0]?.id === playerId ? 'win' : 'lose'); } catch {} };
    return () => { es.close(); };
  }, [roomCode, role, playerId]);

  if (role === 'choose') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)' }}>
        <div className="max-w-md w-full rounded-3xl p-8 shadow-2xl" style={{ background: 'color-mix(in oklab, var(--brand-card) 80%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)' }}>
          <div className="text-center mb-6"><div className="text-5xl mb-2">🎮</div><h1 className="text-2xl font-black mb-1">Live Multiplayer</h1><p className="text-sm opacity-70">{GAME_MODE_MAP[mode]?.emoji ?? '🎮'} {GAME_MODE_MAP[mode]?.name ?? 'Game'}</p></div>
          <button onClick={() => { setRole('teacher'); audioBus.init(); audioBus.play('tap'); }} className="w-full mb-3 rounded-2xl p-4 font-bold text-left" style={{ background: 'linear-gradient(135deg, #ef4444, #f59e0b)', color: '#fff' }}>👨‍🏫 Host as Teacher<br/><span className="text-xs opacity-80 font-normal">Create a room, students join with code</span></button>
          <button onClick={() => { setRole('student'); audioBus.init(); audioBus.play('tap'); }} className="w-full rounded-2xl p-4 font-bold text-left" style={{ background: 'color-mix(in oklab, var(--brand-accent) 18%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)', color: 'var(--brand-text)' }}>✋ Join as Student<br/><span className="text-xs opacity-70 font-normal">Enter a 6-digit room code</span></button>
          <button onClick={onExit} className="w-full mt-4 text-xs opacity-60">← Back to library</button>
        </div>
      </div>
    );
  }

  if ((role === 'teacher' && !roomCode) || (role === 'student' && !playerId)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)' }}>
        <div className="max-w-md w-full rounded-3xl p-8 shadow-2xl" style={{ background: 'color-mix(in oklab, var(--brand-card) 80%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)' }}>
          <h2 className="text-2xl font-black mb-4 text-center">{role === 'teacher' ? '👨‍🏫 Host a Live Game' : '✋ Join Live Game'}</h2>
          {role === 'student' && <input value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} placeholder="ROOM CODE" maxLength={6} className="w-full mb-3 rounded-xl px-4 py-3 text-2xl text-center font-mono font-bold tracking-[0.3em]" style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)', border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)' }} />}
          <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Your nickname" maxLength={20} className="w-full mb-3 rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)', border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)' }} />
          <div className="mb-4"><div className="text-xs opacity-60 mb-2">Pick your avatar</div><div className="grid grid-cols-6 gap-2">{AVATARS.map(a => <button key={a} onClick={() => setAvatar(a)} className="text-2xl p-2 rounded-xl" style={{ background: avatar === a ? 'var(--brand-accent)' : 'rgba(255,255,255,0.05)', transform: avatar === a ? 'scale(1.1)' : 'scale(1)' }}>{a}</button>)}</div></div>
          {error && <div className="text-sm mb-3" style={{ color: '#fca5a5' }}>⚠ {error}</div>}
          <button onClick={role === 'teacher' ? hostRoom : joinRoom} disabled={loading || (role === 'student' && (!roomCode || !nickname))} className="w-full rounded-xl p-3 font-bold disabled:opacity-40" style={{ background: 'var(--brand-accent)', color: 'var(--brand-bg)' }}>{loading ? '...' : role === 'teacher' ? '⚔️ Create Room' : '🤝 Join Game'}</button>
          <button onClick={() => setRole('choose')} className="w-full mt-3 text-xs opacity-60">← Back</button>
        </div>
      </div>
    );
  }

  if (snapshot?.status === 'lobby') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)' }}>
        <div className="max-w-md w-full rounded-3xl p-8 text-center shadow-2xl" style={{ background: 'color-mix(in oklab, var(--brand-card) 80%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)' }}>
          <div className="text-6xl mb-3 animate-bounce">{avatar}</div>
          <div className="text-xl font-bold mb-1">Hi, {nickname}!</div>
          <div className="text-sm opacity-70 mb-4">Room code: <span className="font-mono font-bold" style={{ color: 'var(--brand-accent)' }}>{roomCode}</span></div>
          <div className="rounded-xl p-4 mb-4" style={{ background: 'color-mix(in oklab, var(--brand-accent) 10%, transparent)' }}>
            <div className="grid grid-cols-2 gap-2">
              {snapshot.players.map(p => <div key={p.id} className="rounded-lg p-2" style={{ background: 'color-mix(in oklab, var(--brand-accent) 20%, transparent)' }}><div className="text-3xl">{p.avatar}</div><div className="text-xs font-bold">{p.nickname}</div></div>)}
              {Array.from({ length: Math.max(0, 2 - snapshot.players.length) }).map((_, i) => <div key={i} className="rounded-lg p-2 opacity-40" style={{ border: '2px dashed color-mix(in oklab, var(--brand-accent) 30%, transparent)' }}><div className="text-3xl">?</div><div className="text-xs">Waiting...</div></div>)}
            </div>
          </div>
          {role === 'teacher' && snapshot.playerCount >= 1 ? <button onClick={startGame} disabled={loading} className="w-full rounded-xl p-4 font-bold text-lg" style={{ background: 'var(--brand-accent)', color: 'var(--brand-bg)' }}>{loading ? 'Starting...' : '🚀 Start Game!'}</button> : <div className="text-sm opacity-60 animate-pulse">⏳ Waiting for teacher...</div>}
          {error && <div className="text-sm mt-2" style={{ color: '#fca5a5' }}>⚠ {error}</div>}
          <button onClick={onExit} className="mt-4 text-xs opacity-60">← Leave</button>
        </div>
      </div>
    );
  }

  if (snapshot?.status === 'playing' && snapshot.config) {
    const config: GameLaunchConfig = { mode, theme, terms: snapshot.config.terms ?? terms, unit, tenantId, multiplayer: { playerId, roomCode, submitAnswer, currentQuestionIndex: snapshot.currentQuestionIndex } } as any;
    return (
      <div className="min-h-screen p-2 sm:p-4" style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-2"><div className="text-sm font-bold">Room {roomCode} · Q{snapshot.currentQuestionIndex + 1}/{snapshot.totalQuestions}</div><div className="text-xs opacity-60">{nickname} {avatar}</div></div>
          <div className="grid lg:grid-cols-[1fr_200px] gap-3">
            <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)' }}><GameCanvas config={config} onExit={onExit} /></div>
            <div className="rounded-2xl p-3" style={{ background: 'color-mix(in oklab, var(--brand-card) 80%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)' }}>
              <div className="font-bold text-sm mb-2">📊 Leaderboard</div>
              {[...snapshot.players].sort((a, b) => b.score - a.score).slice(0, 5).map((p, i) => <div key={p.id} className="flex items-center gap-2 text-xs mb-1" style={{ fontWeight: p.id === playerId ? 'bold' : 'normal' }}><span>#{i + 1}</span><span className="text-lg">{p.avatar}</span><span className="flex-1 truncate">{p.nickname}</span><span className="font-mono" style={{ color: 'var(--brand-accent)' }}>{p.score}</span></div>)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (snapshot?.status === 'finished') {
    const won = snapshot.players[0]?.id === playerId;
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)' }}>
        <div className="max-w-md w-full rounded-3xl p-8 text-center shadow-2xl" style={{ background: 'color-mix(in oklab, var(--brand-card) 80%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)' }}>
          <div className="text-6xl mb-3">{won ? '🏆' : '🎮'}</div>
          <div className="text-2xl font-black mb-1">{won ? 'You Won!' : 'Game Over'}</div>
          <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">{[...snapshot.players].sort((a, b) => b.score - a.score).map((p, i) => <div key={p.id} className="flex items-center justify-between rounded-lg p-2 text-sm" style={{ background: p.id === playerId ? 'color-mix(in oklab, var(--brand-accent) 20%, transparent)' : 'transparent' }}><span>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`} {p.avatar} {p.nickname}</span><span className="font-bold">{p.score}</span></div>)}</div>
          <button onClick={onExit} className="w-full rounded-xl p-3 font-bold" style={{ background: 'var(--brand-accent)', color: 'var(--brand-bg)' }}>← Back to Library</button>
        </div>
      </div>
    );
  }
  return null;
}
