'use client';

import { useEffect, useState } from 'react';
import {
  loadStarDust, loadGarden, plantSeed, waterPlant,
  getCurrentEvolution, getNextEvolution,
  PLANT_CATALOG, type StarDustProfile, type StarGardenPlant,
} from '@/lib/stardust';
import { audioBus } from '@/lib/audio';

// ============================================================================
// StarGarden — Visual dashboard where Star Dust grows plants
// ============================================================================

interface Props {
  onClose: () => void;
}

export default function StarGarden({ onClose }: Props) {
  const [profile, setProfile] = useState<StarDustProfile>({ total: 0, available: 0, perGame: 0, history: [] });
  const [garden, setGarden] = useState<StarGardenPlant[]>([]);
  const [showShop, setShowShop] = useState(false);

  useEffect(() => {
    setProfile(loadStarDust());
    setGarden(loadGarden());
  }, []);

  const evolution = getCurrentEvolution(profile.total);
  const nextEvo = getNextEvolution(profile.total);
  const progressToNext = nextEvo
    ? Math.min(100, ((profile.total - evolution.minStarDust) / (nextEvo.minStarDust - evolution.minStarDust)) * 100)
    : 100;

  const handlePlant = (plantType: typeof PLANT_CATALOG[0]) => {
    audioBus.init();
    const plant = plantSeed(plantType);
    if (plant) {
      setProfile(loadStarDust());
      setGarden(loadGarden());
      audioBus.play('correct');
    } else {
      audioBus.play('incorrect');
      alert('Not enough Star Dust!');
    }
  };

  const handleWater = (plantId: string) => {
    const plant = waterPlant(plantId);
    if (plant) {
      setGarden(loadGarden());
      audioBus.play('tap');
      if (plant.growthProgress >= 100) {
        audioBus.play('win');
      }
    }
  };

  const stageEmoji = ['🌱', '🌿', '🌳', '🌸'];
  const stageNames = ['Seed', 'Sprout', 'Grown', 'Bloomed'];

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)' }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div>
            <div className="text-xs uppercase tracking-widest opacity-60">Star Garden</div>
            <div className="font-black text-2xl">✨ Your Progression</div>
          </div>
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold"
            style={{ background: 'color-mix(in oklab, var(--brand-accent) 20%, transparent)', border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)' }}>
            ← Back to Library
          </button>
        </div>

        {/* Star Dust balance */}
        <div className="rounded-3xl p-6 mb-4 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(168,85,247,0.15))',
            border: '2px solid rgba(251,191,36,0.4)',
          }}>
          <div className="text-5xl mb-2">⭐</div>
          <div className="text-xs uppercase tracking-widest opacity-60">Star Dust Available</div>
          <div className="text-4xl font-black" style={{ color: '#fbbf24' }}>{profile.available}</div>
          <div className="text-xs opacity-70 mt-1">{profile.perGame} earned this session · {profile.total} total all-time</div>
        </div>

        {/* Cloud Dog Evolution */}
        <div className="rounded-3xl p-6 mb-4"
          style={{
            background: 'color-mix(in oklab, var(--brand-card) 80%, transparent)',
            border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)',
          }}>
          <div className="flex items-center gap-4 mb-3">
            <div className="text-6xl">{evolution.emoji}</div>
            <div className="flex-1">
              <div className="text-xs uppercase tracking-widest opacity-60">Cloud Dog — Level {evolution.level}</div>
              <div className="font-black text-xl">{evolution.name} {evolution.accessory}</div>
              <div className="text-xs opacity-70">{evolution.description}</div>
            </div>
          </div>
          {nextEvo && (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Progress to {nextEvo.name} {nextEvo.emoji}</span>
                <span>{profile.total} / {nextEvo.minStarDust} ⭐</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)' }}>
                <div className="h-full rounded-full transition-all"
                  style={{
                    width: `${progressToNext}%`,
                    background: 'linear-gradient(90deg, #fbbf24, #a855f7, #ec4899)',
                  }} />
              </div>
            </div>
          )}
        </div>

        {/* Garden */}
        <div className="rounded-3xl p-6 mb-4"
          style={{
            background: 'color-mix(in oklab, var(--brand-card) 60%, transparent)',
            border: '1px solid color-mix(in oklab, var(--brand-accent) 20%, transparent)',
          }}>
          <div className="flex items-center justify-between mb-4">
            <div className="font-bold text-lg">🌱 Your Garden ({garden.length})</div>
            <button onClick={() => { setShowShop(!showShop); audioBus.play('tap'); }}
              className="rounded-xl px-4 py-2 text-sm font-bold"
              style={{ background: 'var(--brand-accent)', color: 'var(--brand-bg)' }}>
              {showShop ? '← Back to Garden' : '🛒 Plant Shop'}
            </button>
          </div>

          {showShop ? (
            // SHOP VIEW
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {PLANT_CATALOG.map(plant => (
                <button key={plant.name} onClick={() => handlePlant(plant)}
                  disabled={profile.available < plant.cost}
                  className="rounded-2xl p-4 text-center transition-all disabled:opacity-30"
                  style={{
                    background: profile.available >= plant.cost
                      ? 'color-mix(in oklab, var(--brand-accent) 15%, transparent)'
                      : 'rgba(0,0,0,0.2)',
                    border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)',
                  }}>
                  <div className="text-4xl mb-2">{plant.emoji}</div>
                  <div className="text-xs font-bold">{plant.name}</div>
                  <div className="text-xs mt-1" style={{ color: '#fbbf24' }}>{plant.cost} ⭐</div>
                </button>
              ))}
            </div>
          ) : (
            // GARDEN VIEW
            garden.length === 0 ? (
              <div className="text-center py-12 opacity-50">
                <div className="text-5xl mb-3">🪴</div>
                <div className="text-sm">Your garden is empty. Visit the Plant Shop to grow something!</div>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {garden.map(plant => (
                  <div key={plant.id} className="rounded-2xl p-3 text-center"
                    style={{
                      background: 'color-mix(in oklab, var(--brand-accent) 8%, transparent)',
                      border: '1px solid color-mix(in oklab, var(--brand-accent) 20%, transparent)',
                    }}>
                    <div className="text-4xl mb-1">{stageEmoji[plant.stage]}</div>
                    <div className="text-[10px] font-bold truncate">{plant.name}</div>
                    <div className="text-[9px] opacity-60">{stageNames[plant.stage]}</div>
                    <div className="h-1.5 rounded-full overflow-hidden mt-1" style={{ background: 'rgba(0,0,0,0.3)' }}>
                      <div className="h-full rounded-full"
                        style={{ width: `${plant.growthProgress}%`, background: '#22c55e' }} />
                    </div>
                    {plant.stage < 3 && (
                      <button onClick={() => handleWater(plant.id)}
                        className="mt-2 rounded-lg px-2 py-1 text-[10px] font-bold w-full"
                        style={{ background: 'rgba(34,197,94,0.3)', border: '1px solid rgba(34,197,94,0.4)' }}>
                        💧 Water
                      </button>
                    )}
                    {plant.stage >= 3 && (
                      <div className="mt-2 text-[10px] font-bold" style={{ color: '#fbbf24' }}>✨ Bloomed!</div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Recent earnings history */}
        {profile.history.length > 0 && (
          <div className="rounded-3xl p-6"
            style={{
              background: 'color-mix(in oklab, var(--brand-card) 60%, transparent)',
              border: '1px solid color-mix(in oklab, var(--brand-accent) 20%, transparent)',
            }}>
            <div className="font-bold text-sm mb-3">📊 Recent Star Dust Earned</div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {profile.history.slice(-10).reverse().map((h, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span>{h.game.replace('Scene', '')}</span>
                  <span style={{ color: '#fbbf24' }}>+{h.amount} ⭐</span>
                  <span className="opacity-50">{new Date(h.date).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
