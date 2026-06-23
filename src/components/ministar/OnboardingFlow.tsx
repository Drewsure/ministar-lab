'use client';

import { useState, useEffect, useRef } from 'react';
import { audioBus } from '@/lib/audio';

// ============================================================================
// OnboardingFlow — Invisible "Show, Don't Tell" onboarding for kindergarteners
// ============================================================================
// 4 steps:
// 1. Welcome — Cloud Dog greets the child (fast animation, no text)
// 2. First Interaction — Tap the glowing Star Treat to "feed" Cloud Dog
// 3. First Mini-Mission — Tap the "Super-Jump" star (first educational task)
// 4. First Reward — Star Dust added to garden, Secret Base unlocked
//
// No text menus. No instructions. Just tap, see, hear, learn.
// ============================================================================

interface Props {
  onComplete: () => void;
}

type Step = 'welcome' | 'feed' | 'mission' | 'reward';

export default function OnboardingFlow({ onComplete }: Props) {
  const [step, setStep] = useState<Step>('welcome');
  const [cloudDogX, setCloudDogX] = useState(50); // percentage
  const [cloudDogMood, setCloudDogMood] = useState<'sleeping' | 'happy' | 'excited' | 'celebrating'>('sleeping');
  const [treatVisible, setTreatVisible] = useState(false);
  const [starVisible, setStarVisible] = useState(false);
  const [starDustCount, setStarDustCount] = useState(0);
  const [confetti, setConfetti] = useState<{ id: number; x: number; emoji: string }[]>([]);

  // Initialize audio on first render
  useEffect(() => {
    audioBus.init();
    audioBus.startMusic();
  }, []);

  // Step 1: Welcome — after 2s, Cloud Dog wakes up
  useEffect(() => {
    if (step === 'welcome') {
      const t = setTimeout(() => {
        setCloudDogMood('happy');
        audioBus.speak('Hi friend! I am Cloud Dog!');
        setTimeout(() => {
          setStep('feed');
        }, 2000);
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [step]);

  // Step 2: Feed — show the glowing treat
  useEffect(() => {
    if (step === 'feed') {
      setCloudDogMood('happy');
      setTreatVisible(true);
      audioBus.speak("I'm hungry! Tap the star to feed me!");
    }
  }, [step]);

  // Step 3: Mission — show the super-jump star
  useEffect(() => {
    if (step === 'mission') {
      setCloudDogMood('excited');
      setStarVisible(true);
      audioBus.speak('Wow! Now tap the super jump star!');
    }
  }, [step]);

  // Step 4: Reward — celebrate
  useEffect(() => {
    if (step === 'reward') {
      setCloudDogMood('celebrating');
      audioBus.speak('Yay! You earned Star Dust! Let us play!');
      // Spawn confetti
      const newConfetti = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        emoji: ['⭐', '✨', '🎉', '🌟'][Math.floor(Math.random() * 4)],
      }));
      setConfetti(newConfetti);
      // Count up star dust
      let count = 0;
      const interval = setInterval(() => {
        count += 5;
        setStarDustCount(count);
        audioBus.play('correct', { freq: 660 + count });
        if (count >= 50) {
          clearInterval(interval);
          setTimeout(() => {
            onComplete();
          }, 1500);
        }
      }, 100);
    }
  }, [step, onComplete]);

  const handleFeedTreat = () => {
    if (step !== 'feed') return;
    setTreatVisible(false);
    audioBus.play('correct');
    audioBus.speak('Yum! Thank you!');
    setCloudDogMood('excited');
    // Burst effect
    setConfetti(Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: 50 + (Math.random() - 0.5) * 30,
      emoji: '⭐',
    })));
    setTimeout(() => setConfetti([]), 1000);
    setTimeout(() => setStep('mission'), 1500);
  };

  const handleJumpStar = () => {
    if (step !== 'mission') return;
    setStarVisible(false);
    audioBus.play('launch');
    audioBus.speak('Super jump!');
    // Cloud Dog jumps
    setCloudDogMood('celebrating');
    setTimeout(() => setStep('reward'), 1000);
  };

  // =====================================================================
  // RENDER — no text, just visuals + emojis + animations
  // =====================================================================
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at center, #1a0f3e 0%, #05030f 100%)',
      }}
    >
      {/* Confetti */}
      {confetti.map(c => (
        <div
          key={c.id}
          className="absolute text-3xl"
          style={{
            left: `${c.x}%`,
            top: '-50px',
            animation: 'fall 2s ease-in forwards',
          }}
        >
          {c.emoji}
        </div>
      ))}
      <style>{`
        @keyframes fall {
          to { transform: translateY(100vh) rotate(360deg); }
        }
        @keyframes bounce-cloud {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
        @keyframes pulse-glow {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.8; }
        }
        @keyframes wiggle {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
        }
      `}</style>

      {/* Cloud Dog — the companion */}
      <div
        className="absolute"
        style={{
          left: `${cloudDogX}%`,
          top: '40%',
          transform: 'translate(-50%, -50%)',
          fontSize: '120px',
          animation: cloudDogMood === 'sleeping'
            ? 'none'
            : cloudDogMood === 'celebrating'
            ? 'wiggle 0.3s ease-in-out infinite'
            : 'bounce-cloud 1s ease-in-out infinite',
          filter: `drop-shadow(0 0 30px ${cloudDogMood === 'excited' ? '#fbbf24' : '#a855f7'})`,
          transition: 'left 0.5s ease',
        }}
      >
        {cloudDogMood === 'sleeping' ? '😴' :
         cloudDogMood === 'happy' ? '🐶' :
         cloudDogMood === 'excited' ? '🤩' :
         '🎉'}
      </div>

      {/* Step 2: Glowing Star Treat */}
      {treatVisible && (
        <button
          onClick={handleFeedTreat}
          className="absolute"
          style={{
            left: '50%',
            top: '65%',
            transform: 'translate(-50%, -50%)',
            fontSize: '64px',
            animation: 'pulse-glow 1s ease-in-out infinite',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            filter: 'drop-shadow(0 0 20px #fbbf24)',
          }}
          aria-label="Feed Cloud Dog"
        >
          ⭐
        </button>
      )}

      {/* Step 3: Super-Jump Star */}
      {starVisible && (
        <button
          onClick={handleJumpStar}
          className="absolute"
          style={{
            left: '50%',
            top: '30%',
            transform: 'translate(-50%, -50%)',
            fontSize: '72px',
            animation: 'pulse-glow 0.8s ease-in-out infinite',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            filter: 'drop-shadow(0 0 25px #22d3ee)',
          }}
          aria-label="Super Jump"
        >
          🚀
        </button>
      )}

      {/* Step 4: Star Dust counter */}
      {step === 'reward' && (
        <div
          className="absolute"
          style={{
            left: '50%',
            top: '70%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '48px' }}>⭐</div>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#fbbf24' }}>
            +{starDustCount}
          </div>
        </div>
      )}

      {/* Skip button (tiny, for parents) */}
      <button
        onClick={onComplete}
        className="absolute bottom-4 right-4 text-xs opacity-20 hover:opacity-60"
        style={{ color: '#fff', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        skip
      </button>
    </div>
  );
}
