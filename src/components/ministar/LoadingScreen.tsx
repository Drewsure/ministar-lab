'use client';

import { useEffect, useState, useRef } from 'react';
import { audioBus } from '@/lib/audio';

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
  'Loading the magic...',
  'Gathering the words...',
  'Calibrating the fun...',
];

export default function LoadingScreen({ gameName, gameEmoji, themeName, onReady }: Props) {
  const [progress, setProgress] = useState(0);
  const [taglineIdx, setTaglineIdx] = useState(0);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    try { audioBus.init(); audioBus.startMusic(); } catch {}
    const start = Date.now();
    const duration = 1200;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      setProgress(t * 100);
      if (t < 1) requestAnimationFrame(tick);
      else { setProgress(100); setTimeout(() => onReadyRef.current(), 200); }
    };
    requestAnimationFrame(tick);
    const tagInterval = setInterval(() => setTaglineIdx(i => (i + 1) % TAGLINES.length), 350);
    return () => clearInterval(tagInterval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at center, #1a0f3e 0%, #0a0420 60%, #000 100%)', color: '#fff' }}>
      <div className="text-6xl mb-4" style={{ animation: 'ld-pulse 1.2s ease-in-out infinite', filter: 'drop-shadow(0 0 20px rgba(168,85,247,0.8))' }}>{gameEmoji}</div>
      <h1 className="text-2xl font-black mb-2" style={{ background: 'linear-gradient(90deg, #a855f7, #ec4899, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{gameName}</h1>
      <div className="text-sm opacity-70 mb-6">{themeName}</div>
      <div className="w-56 h-3 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <div className="h-full rounded-full" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #a855f7, #ec4899, #f59e0b)', boxShadow: '0 0 12px rgba(168,85,247,0.8)' }} />
      </div>
      <div className="text-xs opacity-60 font-mono mb-1">{Math.floor(progress)}%</div>
      <div className="text-sm opacity-80 h-5">{TAGLINES[taglineIdx]}</div>
      <style>{`@keyframes ld-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }`}</style>
    </div>
  );
}
