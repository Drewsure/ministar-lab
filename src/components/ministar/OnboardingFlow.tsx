'use client';
import { useState, useEffect } from 'react';
import { audioBus } from '@/lib/audio';

export default function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<'welcome' | 'feed' | 'mission' | 'reward'>('welcome');
  const [mascotMood, setMascotMood] = useState<'sleeping' | 'happy' | 'excited' | 'celebrating'>('sleeping');
  const [treatVisible, setTreatVisible] = useState(false);
  const [starVisible, setStarVisible] = useState(false);

  useEffect(() => {
    try { audioBus.init(); audioBus.startMusic(); } catch {}
    if (step === 'welcome') { const t = setTimeout(() => { setMascotMood('happy'); try { audioBus.speak('Hi friend! I am Cloud Dog!'); } catch {}; setTimeout(() => setStep('feed'), 2000); }, 1500); return () => clearTimeout(t); }
    if (step === 'feed') { setMascotMood('happy'); setTreatVisible(true); try { audioBus.speak("I'm hungry! Tap the star to feed me!"); } catch {} }
    if (step === 'mission') { setMascotMood('excited'); setStarVisible(true); try { audioBus.speak('Now tap the super jump star!'); } catch {} }
    if (step === 'reward') { setMascotMood('celebrating'); try { audioBus.speak('Yay! You earned Star Dust! Let us play!'); } catch {}; const t = setTimeout(onComplete, 2000); return () => clearTimeout(t); }
  }, [step, onComplete]);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center" style={{ background: 'radial-gradient(ellipse at center, #1a0f3e 0%, #05030f 100%)' }}>
      <div className="text-7xl mb-6" style={{ animation: mascotMood === 'celebrating' ? 'ob-wiggle 0.3s infinite' : mascotMood !== 'sleeping' ? 'ob-bounce 1s infinite' : 'none', filter: `drop-shadow(0 0 30px ${mascotMood === 'excited' ? '#fbbf24' : '#a855f7'})` }}>
        {mascotMood === 'sleeping' ? '😴' : mascotMood === 'happy' ? '🐶' : mascotMood === 'excited' ? '🤩' : '🎉'}
      </div>
      {treatVisible && <button onClick={() => { setTreatVisible(false); try { audioBus.play('correct'); audioBus.speak('Yum! Thank you!'); } catch {}; setMascotMood('excited'); setTimeout(() => setStep('mission'), 1500); }} className="text-6xl mb-6" style={{ animation: 'ob-pulse 1s infinite' }}>⭐</button>}
      {starVisible && <button onClick={() => { setStarVisible(false); try { audioBus.play('launch'); audioBus.speak('Super jump!'); } catch {}; setTimeout(() => setStep('reward'), 1000); }} className="text-7xl mb-6" style={{ animation: 'ob-pulse 0.8s infinite' }}>🚀</button>}
      {step === 'reward' && <div className="text-4xl font-black" style={{ color: '#fbbf24' }}>+50 ⭐</div>}
      <button onClick={onComplete} className="absolute bottom-4 right-4 text-xs opacity-20">skip</button>
      <style>{`@keyframes ob-bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-15px); } } @keyframes ob-wiggle { 0%,100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } } @keyframes ob-pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.8; } }`}</style>
    </div>
  );
}
