'use client';

import { useState } from 'react';
import { BRANDS } from '@/lib/brands';
import type { BrandManifest } from '@/lib/types';

interface BrandHeaderProps {
  brand: BrandManifest;
  onSwitchBrand: (key: string) => void;
  onOpenTeacher?: () => void;
  isTeacherOpen?: boolean;
}

export function BrandHeader({ brand, onSwitchBrand, onOpenTeacher, isTeacherOpen }: BrandHeaderProps) {
  const [switcherOpen, setSwitcherOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-40 w-full backdrop-blur-xl border-b"
      style={{
        background: 'color-mix(in oklab, var(--brand-bg) 75%, transparent)',
        borderColor: 'color-mix(in oklab, var(--brand-accent) 25%, transparent)',
      }}
    >
      <div className="mx-auto max-w-7xl flex items-center justify-between px-4 sm:px-6 py-3 gap-4">
        {/* Logo + name */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, var(--brand-primary), var(--brand-accent))`,
              boxShadow: '0 4px 14px -2px color-mix(in oklab, var(--brand-primary) 60%, transparent)',
            }}
          >
            <span className="text-white font-black text-lg" style={{ fontFamily: 'var(--font-display)' }}>
              {brand.logoText.charAt(0)}
            </span>
          </div>
          <div className="min-w-0">
            <div
              className="font-bold text-base sm:text-lg leading-tight truncate"
              style={{ color: 'var(--brand-text)', fontFamily: 'var(--font-display)' }}
            >
              {brand.displayName}
            </div>
            <div className="text-xs opacity-70 leading-tight truncate" style={{ color: 'var(--brand-text)' }}>
              {brand.tagline}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onOpenTeacher && (
            <button
              onClick={onOpenTeacher}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: isTeacherOpen
                  ? 'color-mix(in oklab, var(--brand-accent) 20%, transparent)'
                  : 'transparent',
                color: 'var(--brand-text)',
                border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)',
              }}
            >
              <span>📚</span>
              <span>Teacher</span>
            </button>
          )}

          {/* White-label brand switcher */}
          <div className="relative">
            <button
              onClick={() => setSwitcherOpen(o => !o)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: 'transparent',
                color: 'var(--brand-text)',
                border: '1px solid color-mix(in oklab, var(--brand-accent) 40%, transparent)',
              }}
              aria-haspopup="listbox"
              aria-expanded={switcherOpen}
            >
              <span>🏷️</span>
              <span className="hidden sm:inline">Brand</span>
              <span className="text-xs opacity-60">▾</span>
            </button>
            {switcherOpen && (
              <div
                className="absolute right-0 mt-2 w-64 rounded-2xl shadow-2xl overflow-hidden z-50"
                style={{
                  background: 'color-mix(in oklab, var(--brand-bg) 95%, black)',
                  border: '1px solid color-mix(in oklab, var(--brand-accent) 30%, transparent)',
                }}
              >
                <div className="px-4 py-3 text-xs uppercase tracking-wide opacity-60" style={{ color: 'var(--brand-text)' }}>
                  White-label purchasers
                </div>
                {Object.values(BRANDS).map(b => (
                  <button
                    key={b.id}
                    onClick={() => {
                      onSwitchBrand(b.subdomain);
                      setSwitcherOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition"
                    style={{ color: 'var(--brand-text)' }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center font-black text-white text-sm"
                      style={{ background: `linear-gradient(135deg, ${b.primaryColor}, ${b.accentColor})` }}
                    >
                      {b.logoText.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{b.displayName}</div>
                      <div className="text-xs opacity-60 truncate">{b.subdomain}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
