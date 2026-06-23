'use client';

import { useState, useEffect } from 'react';
import type { GameModeId, ThemeId } from '@/lib/types';
import { GAME_MODE_MAP } from '@/lib/gameModes';
import { THEMES } from '@/lib/themes';
import { audioBus } from '@/lib/audio';

// ============================================================================
// LaunchCard — QR code / magic link for instant classroom game launch
// ============================================================================
// Teacher displays a QR code or short URL. Kids scan/click → instantly
// dropped into the exact game. No menus, no navigation, no login.
// ============================================================================

interface Props {
  open: boolean;
  onClose: () => void;
  onLaunch: (mode: GameModeId, theme: ThemeId) => void;
  defaultMode?: GameModeId;
  defaultTheme?: ThemeId;
}

export default function LaunchCard({ open, onClose, onLaunch, defaultMode = 'quiz', defaultTheme = 'space' }: Props) {
  const [mode, setMode] = useState<GameModeId>(defaultMode);
  const [theme, setTheme] = useState<ThemeId>(defaultTheme);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(defaultMode);
      setTheme(defaultTheme);
    }
  }, [open, defaultMode, defaultTheme]);

  if (!open) return null;

  // Generate the launch URL
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ministar.lab';
  const launchUrl = `${baseUrl}/?game=${mode}&theme=${theme}&auto=1`;

  // Simple QR code using a public API (for MVP — in production, generate locally)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(launchUrl)}`;

  const copyLink = () => {
    try {
      navigator.clipboard.writeText(launchUrl);
      setCopied(true);
      audioBus.play('tap');
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      <div
        className="max-w-lg w-full rounded-3xl p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: '#1a1535', border: '1px solid rgba(168,85,247,0.4)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="font-bold text-lg" style={{ color: '#fff' }}>🚀 Launch Card</div>
          <button onClick={onClose} className="rounded-lg p-2 text-sm opacity-70 hover:opacity-100" style={{ color: '#fff', background: 'rgba(255,255,255,0.1)' }}>✕</button>
        </div>

        {/* Game selector */}
        <div className="mb-4">
          <div className="text-xs opacity-60 mb-2" style={{ color: '#fff' }}>Game</div>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(GAME_MODE_MAP).slice(0, 12).map(([id, meta]) => (
              <button
                key={id}
                onClick={() => { setMode(id as GameModeId); audioBus.play('tap'); }}
                className="rounded-xl p-2 text-center text-xs transition-all"
                style={{
                  background: mode === id ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.05)',
                  border: mode === id ? '1px solid rgba(168,85,247,0.6)' : '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                }}
              >
                <div className="text-xl">{meta.emoji}</div>
                <div className="truncate">{meta.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Theme selector */}
        <div className="mb-4">
          <div className="text-xs opacity-60 mb-2" style={{ color: '#fff' }}>World</div>
          <div className="grid grid-cols-5 gap-2">
            {(Object.keys(THEMES) as ThemeId[]).map(t => (
              <button
                key={t}
                onClick={() => { setTheme(t); audioBus.play('tap'); }}
                className="rounded-xl p-2 text-center text-[10px] transition-all"
                style={{
                  background: theme === t
                    ? `#${THEMES[t].accent.toString(16).padStart(6, '0')}`
                    : 'rgba(255,255,255,0.05)',
                  color: theme === t ? '#000' : '#fff',
                  border: theme === t ? `2px solid #${THEMES[t].accent.toString(16).padStart(6, '0')}` : '1px solid rgba(255,255,255,0.1)',
                }}
              >
                {THEMES[t].name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* QR Code */}
        <div className="text-center mb-4">
          <div className="inline-block rounded-2xl p-3" style={{ background: '#fff' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="QR Code" width={250} height={250} />
          </div>
          <div className="text-xs opacity-60 mt-2" style={{ color: '#fff' }}>
            📱 Students scan this to launch instantly
          </div>
        </div>

        {/* Magic link */}
        <div className="mb-4">
          <div className="text-xs opacity-60 mb-1" style={{ color: '#fff' }}>Or share this link:</div>
          <div className="flex gap-2">
            <input
              readOnly
              value={launchUrl}
              className="flex-1 rounded-lg px-3 py-2 text-xs font-mono"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)', color: '#a5f3fc' }}
              onClick={e => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={copyLink}
              className="rounded-lg px-3 py-2 text-xs font-bold whitespace-nowrap"
              style={{ background: copied ? 'rgba(34,197,94,0.4)' : 'rgba(168,85,247,0.4)', color: '#fff' }}
            >
              {copied ? '✓' : '📋 Copy'}
            </button>
          </div>
        </div>

        {/* Launch now button */}
        <button
          onClick={() => { onLaunch(mode, theme); onClose(); }}
          className="w-full rounded-xl p-3 font-bold text-sm"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)', color: '#fff' }}
        >
          ▶ Launch Now
        </button>
      </div>
    </div>
  );
}
