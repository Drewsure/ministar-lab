'use client';

import { useEffect, useState } from 'react';
import { audioBus } from '@/lib/audio';

// ============================================================================
// Cinematic Loading Screen
// ============================================================================
// Shows a polished animated loader while Phaser boots the scene.
// - Animated mascot (procedurally drawn with CSS)
// - Progress bar that fills over ~1.2s
// - Per-theme tagline
// - Tap anywhere to start audio (mobile unlock)
// ============================================================================

interface Props {
  gameName: string;
  gameEmoji: string;
  themeName: string;
  themeEmoji: string;
  onReady: () => void;
}

const TAGLINES = [
  'Warming up the engines...',
  'Polishing the pixels...',
  'Tuning the sound effects...',
  'Loading the magic...',
  'Gathering the words...',
  'Calibrating the fun...',
];

export default function LoadingScreen({ gameName, gameEmoji, themeName, themeEmoji, onReady }: Props) {
  const [progress, setProgress] = useState(0);
  const [taglineIdx, setTaglineIdx] = useState(0);

  useEffect(() => {
    audioBus.init();
    audioBus.startMusic();

    const start = Date.now();
    const duration = 1400;

    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setProgress(pct);
      if (pct < 100) {
        requestAnimationFrame(tick);
      } else {
        setTimeout(onReady, 200);
      }
    };
    requestAnimationFrame(tick);

    // Rotate taglines every 350ms
    const tagInterval = setInterval(() => {
      setTaglineIdx(i => (i + 1) % TAGLINES.length);
    }, 350);

    return () => clearInterval(tagInterval);
  }, [onReady]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at center, #1a0f3e 0%, #0a0420 60%, #000 100%)',
        color: '#fff',
      }}
    >
      {/* Floating background particles */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${2 + Math.random() * 4}px`,
              height: `${2 + Math.random() * 4}px`,
              background: `rgba(255, 255, 255, ${0.2 + Math.random() * 0.5})`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${3 + Math.random() * 4}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(${Math.random() * 40 - 20}px, ${Math.random() * 40 - 20}px); }
        }
        @keyframes pulse-glow {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 20px rgba(168,85,247,0.6)); }
          50% { transform: scale(1.08); filter: drop-shadow(0 0 40px rgba(168,85,247,0.9)); }
        }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      {/* Mascot — animated emoji with glow */}
      <div
        className="text-7xl mb-6 relative"
        style={{ animation: 'pulse-glow 1.6s ease-in-out infinite' }}
      >
        {gameEmoji}
        {/* Spinning ring around the mascot */}
        <div
          className="absolute inset-0 -m-6 rounded-full border-4 border-transparent"
          style={{
            borderTopColor: 'rgba(168,85,247,0.6)',
            borderRightColor: 'rgba(236,72,153,0.4)',
            animation: 'spin-slow 2s linear infinite',
          }}
        />
      </div>

      {/* Game name */}
      <h1 className="text-3xl font-black mb-2 text-center bg-gradient-to-r from-purple-400 via-pink-400 to-orange-300 bg-clip-text text-transparent">
        {gameName}
      </h1>

      {/* Theme badge */}
      <div className="text-sm opacity-70 mb-8">
        {themeEmoji} {themeName}
      </div>

      {/* Progress bar */}
      <div className="w-64 h-3 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <div
          className="h-full rounded-full transition-all duration-100"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #a855f7, #ec4899, #f59e0b, #a855f7)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 2s linear infinite',
          }}
        />
      </div>

      {/* Percentage + tagline */}
      <div className="text-xs opacity-60 font-mono mb-1">{Math.floor(progress)}%</div>
      <div className="text-sm opacity-80 h-5">{TAGLINES[taglineIdx]}</div>
    </div>
  );
}
