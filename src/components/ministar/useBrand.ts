'use client';

import { useEffect, useState } from 'react';
import type { BrandManifest } from '@/lib/types';
import { BRANDS, DEFAULT_BRAND_KEY } from '@/lib/brands';

// White-label brand context.
// In production this fetches /api/brand?origin=<host> to resolve the
// purchaser's brand_manifest.json. For the demo we resolve locally so
// the white-label switcher is testable without DNS.

export function useBrand(): { brand: BrandManifest; setBrandKey: (k: string) => void } {
  const [brand, setBrand] = useState<BrandManifest>(BRANDS[DEFAULT_BRAND_KEY]);

  useEffect(() => {
    // Try to resolve from origin (production would hit /api/brand)
    fetch('/api/brand')
      .then(r => r.json())
      .then((data: { brandKey: string }) => {
        const key = data.brandKey ?? DEFAULT_BRAND_KEY;
        const resolved = BRANDS[key] ?? BRANDS[DEFAULT_BRAND_KEY];
        setBrand(resolved);
        applyBrandCss(resolved);
      })
      .catch(() => {
        applyBrandCss(BRANDS[DEFAULT_BRAND_KEY]);
      });
  }, []);

  const setBrandKey = (k: string) => {
    const next = BRANDS[k] ?? BRANDS[DEFAULT_BRAND_KEY];
    setBrand(next);
    applyBrandCss(next);
    // Persist to localStorage so SSR + client agree on reload
    try { localStorage.setItem('ministar.brandKey', k); } catch {}
  };

  return { brand, setBrandKey };
}

function applyBrandCss(b: BrandManifest) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--brand-primary', b.primaryColor);
  root.style.setProperty('--brand-accent', b.accentColor);
  root.style.setProperty('--brand-bg', b.bgTone);
  root.style.setProperty('--brand-card', b.bgTone);
  root.style.setProperty('--brand-text', '#f8fafc');
  root.style.setProperty('--ui-radius', `${b.radius}px`);
  root.style.setProperty('--font-display', b.fontDisplay);
  root.setAttribute('data-brand', b.subdomain);
}
