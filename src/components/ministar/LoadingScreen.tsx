'use client';

import { useEffect, useState } from 'react';
import { audioBus } from '@/lib/audio';

// ============================================================================
// AAA Loading Screen — cinematic, multi-layer, particle-rich
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
  'Summoning Cloud Dog...',
  'Aligning the stars...',
];

export default function LoadingScreen({ gameName, gameEmoji, themeName, themeEmoji, onReady }: Props) {
  const [progress, setProgress] = useState(0);
  const [taglineIdx, setTaglineIdx] = useState(0);
  const [mascotY, setMascotY] = useState(0);

  useEffect(() => {
    audioBus.init();
    audioBus.startMusic();

    const start = Date.now();
    const duration = 1600;

    const tick = () => {
      const elapsed = Date.now() - start;
      // AAA easing — expo out (fast start, slow settle)
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(2, -10 * t);
      setProgress(eased * 100);
      if (eased < 1) {
        requestAnimationFrame(tick);
      } else {
        setTimeout(onReady, 300);
      }
    };
    requestAnimationFrame(tick);

    // Rotate taglines every 400ms
    const tagInterval = setInterval(() => {
      setTaglineIdx(i => (i + 1) % TAGLINES.length);
    }, 400);

    // Mascot float animation (sine wave)
    let mascotT = 0;
    const mascotInterval = setInterval(() => {
      mascotT += 0.05;
      setMascotY(Math.sin(mascotT) * 12);
    }, 16);

    return () => {
      clearInterval(tagInterval);
      clearInterval(mascotInterval);
    };
  }, [onReady]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at center, #1a0f3e 0%, #0a0420 60%, #000 100%)',
        color: '#fff',
      }}
    >
      {/* Layer 1: Floating background particles (depth field) */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${1 + Math.random() * 4}px`,
              height: `${1 + Math.random() * 4}px`,
              background: `rgba(255, 255, 255, ${0.1 + Math.random() * 0.4})`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `aaa-float ${4 + Math.random() * 6}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 4}s`,
              boxShadow: `0 0 ${4 + Math.random() * 8}px rgba(168,85,247,${0.3 + Math.random() * 0.4})`,
            }}
          />
        ))}
      </div>

      {/* Layer 2: Light rays from center (dramatic reveal) */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              width: '3px',
              height: '60vh',
              background: `linear-gradient(to bottom, transparent, rgba(168,85,247,0.15), transparent)`,
              transform: `rotate(${i * 30}deg)`,
              animation: `aaa-rays 8s linear infinite`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      {/* Layer 3: Mascot with glow + orbit ring + float */}
      <div className="relative mb-6" style={{ transform: `translateY(${mascotY}px)` }}>
        {/* Outer glow */}
        <div
          className="absolute inset-0 -m-12 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(168,85,247,0.4) 0%, transparent 70%)',
            animation: 'aaa-pulse-glow 1.6s ease-in-out infinite',
          }}
        />
        {/* Orbit ring 1 (clockwise) */}
        <div
          className="absolute inset-0 -m-8 rounded-full border-2 border-transparent"
          style={{
            borderTopColor: 'rgba(168,85,247,0.6)',
            borderRightColor: 'rgba(236,72,153,0.4)',
            animation: 'aaa-spin-cw 2s linear infinite',
          }}
        />
        {/* Orbit ring 2 (counter-clockwise) */}
        <div
          className="absolute inset-0 -m-4 rounded-full border-2 border-transparent"
          style={{
            borderBottomColor: 'rgba(34,211,238,0.5)',
            borderLeftColor: 'rgba(251,191,36,0.3)',
            animation: 'aaa-spin-ccw 1.5s linear infinite',
          }}
        />
        {/* Mascot emoji */}
        <div
          className="text-7xl relative"
          style={{
            animation: 'aaa-mascot-pulse 1.6s ease-in-out infinite',
            filter: 'drop-shadow(0 0 20px rgba(168,85,247,0.8))',
          }}
        >
          {gameEmoji}
        </div>
      </div>

      {/* Layer 4: Game name with gradient shimmer */}
      <h1
        className="text-3xl font-black mb-2 text-center"
        style={{
          background: 'linear-gradient(90deg, #a855f7, #ec4899, #fbbf24, #a855f7)',
          backgroundSize: '200% 100%',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          animation: 'aaa-shimmer 2s linear infinite',
        }}
      >
        {gameName}
      </h1>

      {/* Theme badge */}
      <div className="text-sm opacity-70 mb-8 flex items-center gap-2">
        <span className="text-lg">{themeEmoji}</span>
        <span>{themeName}</span>
      </div>

      {/* Layer 5: Progress bar with glow + shimmer */}
      <div
        className="w-64 h-3 rounded-full overflow-hidden mb-3 relative"
        style={{
          background: 'rgba(255,255,255,0.1)',
          boxShadow: 'inset 0 0 8px rgba(0,0,0,0.5)',
        }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #a855f7, #ec4899, #f59e0b, #a855f7)',
            backgroundSize: '200% 100%',
            animation: 'aaa-bar-shimmer 1.5s linear infinite',
            boxShadow: '0 0 12px rgba(168,85,247,0.8), 0 0 24px rgba(236,72,153,0.4)',
          }}
        />
      </div>

      {/* Percentage + tagline */}
      <div className="text-xs opacity-60 font-mono mb-1">{Math.floor(progress)}%</div>
      <div className="text-sm opacity-80 h-5" style={{ animation: 'aaa-fade 0.4s ease' }} key={taglineIdx}>
        {TAGLINES[taglineIdx]}
      </div>

      <style>{`
        @keyframes aaa-float {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(${Math.random() * 30 - 15}px, ${Math.random() * 30 - 15}px); }
          66% { transform: translate(${Math.random() * 30 - 15}px, ${Math.random() * 30 - 15}px); }
        }
        @keyframes aaa-rays {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes aaa-pulse-glow {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.15); opacity: 0.7; }
        }
        @keyframes aaa-spin-cw {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes aaa-spin-ccw {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes aaa-mascot-pulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 20px rgba(168,85,247,0.8)); }
          50% { transform: scale(1.08); filter: drop-shadow(0 0 35px rgba(236,72,153,0.9)); }
        }
        @keyframes aaa-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes aaa-bar-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes aaa-fade {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 0.8; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
