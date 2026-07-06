'use client';
import { useEffect, useState } from 'react';
import { loadStarDust, loadGarden, plantSeed, waterPlant, getCurrentEvolution, getNextEvolution, PLANT_CATALOG, type StarDustProfile, type StarGardenPlant } from '@/lib/stardust';
import { audioBus } from '@/lib/audio';

export default function StarGarden({ onClose }: { onClose: () => void }) {
  const [profile, setProfile] = useState<StarDustProfile>({ total: 0, available: 0, perGame: 0, history: [] });
  const [garden, setGarden] = useState<StarGardenPlant[]>([]);
  const [showShop, setShowShop] = useState(false);
  useEffect(() => { setProfile(loadStarDust()); setGarden(loadGarden()); }, []);
  const evo = getCurrentEvolution(profile.total);
  const nextEvo = getNextEvolution(profile.total);
  const progress = nextEvo ? Math.min(100, ((profile.total - evo.minStarDust) / (nextEvo.minStarDust - evo.minStarDust)) * 100) : 100;
  const stageEmoji = ['🌱', '🌿', '🌳', '🌸'];
  const stageNames = ['Seed', 'Sprout', 'Grown', 'Bloomed'];

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)' }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div><div className="text-xs uppercase tracking-widest opacity-60">Star Garden</div><div className="font-black text-2xl">✨ Your Progression</div></div>
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: 'color-mix(in oklab, var(--brand-accent) 20%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)' }}>← Back</button>
        </div>
        <div className="rounded-3xl p-6 mb-4 text-center" style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(168,85,247,0.15))', border: '2px solid rgba(251,191,36,0.4)' }}>
          <div className="text-5xl mb-2">⭐</div>
          <div className="text-xs uppercase tracking-widest opacity-60">Star Dust Available</div>
          <div className="text-4xl font-black" style={{ color: '#fbbf24' }}>{profile.available}</div>
          <div className="text-xs opacity-70 mt-1">{profile.perGame} earned this session · {profile.total} total all-time</div>
        </div>
        <div className="rounded-3xl p-6 mb-4" style={{ background: 'color-mix(in oklab, var(--brand-card) 80%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)' }}>
          <div className="flex items-center gap-4 mb-3">
            <div className="text-6xl">{evo.emoji}</div>
            <div className="flex-1">
              <div className="text-xs uppercase tracking-widest opacity-60">Cloud Dog — Level {evo.level}</div>
              <div className="font-black text-xl">{evo.name} {evo.accessory}</div>
              <div className="text-xs opacity-70">{evo.description}</div>
            </div>
          </div>
          {nextEvo && (
            <div>
              <div className="flex justify-between text-xs mb-1"><span>Progress to {nextEvo.name} {nextEvo.emoji}</span><span>{profile.total} / {nextEvo.minStarDust} ⭐</span></div>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)' }}>
                <div className="h-full rounded-full" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #fbbf24, #a855f7, #ec4899)' }} />
              </div>
            </div>
          )}
        </div>
        <div className="rounded-3xl p-6 mb-4" style={{ background: 'color-mix(in oklab, var(--brand-card) 60%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 20%, transparent)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="font-bold text-lg">🌱 Your Garden ({garden.length})</div>
            <button onClick={() => { setShowShop(!showShop); audioBus.play('tap'); }} className="rounded-xl px-4 py-2 text-sm font-bold" style={{ background: 'var(--brand-accent)', color: 'var(--brand-bg)' }}>{showShop ? '← Back to Garden' : '🛒 Plant Shop'}</button>
          </div>
          {showShop ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {PLANT_CATALOG.map(plant => (
                <button key={plant.name} onClick={() => { const p = plantSeed(plant); if (p) { setProfile(loadStarDust()); setGarden(loadGarden()); audioBus.play('correct'); } else { audioBus.play('incorrect'); alert('Not enough Star Dust!'); } }}
                  disabled={profile.available < plant.cost} className="rounded-2xl p-4 text-center disabled:opacity-30" style={{ background: profile.available >= plant.cost ? 'color-mix(in oklab, var(--brand-accent) 15%, transparent)' : 'rgba(0,0,0,0.2)', border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)' }}>
                  <div className="text-4xl mb-2">{plant.emoji}</div><div className="text-xs font-bold">{plant.name}</div><div className="text-xs mt-1" style={{ color: '#fbbf24' }}>{plant.cost} ⭐</div>
                </button>
              ))}
            </div>
          ) : garden.length === 0 ? (
            <div className="text-center py-12 opacity-50"><div className="text-5xl mb-3">🪴</div><div className="text-sm">Your garden is empty. Visit the Plant Shop!</div></div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {garden.map(plant => (
                <div key={plant.id} className="rounded-2xl p-3 text-center" style={{ background: 'color-mix(in oklab, var(--brand-accent) 8%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 20%, transparent)' }}>
                  <div className="text-4xl mb-1">{stageEmoji[plant.stage]}</div>
                  <div className="text-[10px] font-bold truncate">{plant.name}</div>
                  <div className="text-[9px] opacity-60">{stageNames[plant.stage]}</div>
                  <div className="h-1.5 rounded-full overflow-hidden mt-1" style={{ background: 'rgba(0,0,0,0.3)' }}><div className="h-full rounded-full" style={{ width: `${plant.growthProgress}%`, background: '#22c55e' }} /></div>
                  {plant.stage < 3 && <button onClick={() => { waterPlant(plant.id); setGarden(loadGarden()); audioBus.play('tap'); }} className="mt-2 rounded-lg px-2 py-1 text-[10px] font-bold w-full" style={{ background: 'rgba(34,197,94,0.3)', border: '1px solid rgba(34,197,94,0.4)' }}>💧 Water</button>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
