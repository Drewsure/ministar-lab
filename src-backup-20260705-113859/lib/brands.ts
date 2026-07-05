import type { BrandManifest } from './types';

// White-label brand manifests. In production these are fetched from
// /brand/<subdomain>.json based on window.location.origin. For the
// reference deployment we ship four sample purchasers so the white-label
// demo is fully testable without DNS configuration.

export const BRANDS: Record<string, BrandManifest> = {
  'ministar-lab': {
    id: 'brand-ministar',
    subdomain: 'ministar-lab',
    displayName: 'MiniStar English Global Lab',
    logoText: 'MiniStar',
    logoSvg: `<svg viewBox="0 0 120 40" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#e879f9"/></linearGradient></defs><path d="M12 4l2.6 5.6 6.1.6-4.6 4 1.4 6L12 17.6 6.5 20.2l1.4-6L3.3 10.2l6.1-.6L12 4z" fill="url(#g)"/><text x="30" y="28" font-family="Inter, sans-serif" font-size="22" font-weight="800" fill="currentColor">MiniStar</text></svg>`,
    primaryColor: '#7c3aed',
    accentColor: '#22d3ee',
    bgTone: '#05030f',
    radius: 20,
    fontDisplay: 'Inter, system-ui, sans-serif',
    defaultTheme: 'space',
    tagline: 'Living Textbook — English Global Lab',
  },
  'brightpath-academy': {
    id: 'brand-brightpath',
    subdomain: 'brightpath-academy',
    displayName: 'BrightPath Academy',
    logoText: 'BrightPath',
    logoSvg: `<svg viewBox="0 0 160 40" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="14" fill="#facc15"/><path d="M14 22 L20 10 L26 22 L20 18 Z" fill="#15803d"/><text x="44" y="28" font-family="Inter, sans-serif" font-size="22" font-weight="800" fill="currentColor">BrightPath</text></svg>`,
    primaryColor: '#15803d',
    accentColor: '#facc15',
    bgTone: '#062014',
    radius: 16,
    fontDisplay: 'Inter, system-ui, sans-serif',
    defaultTheme: 'jungle',
    tagline: 'Where bright minds find their path.',
  },
  'festival-lingua': {
    id: 'brand-festival',
    subdomain: 'festival-lingua',
    displayName: 'Festival Lingua',
    logoText: 'Festival',
    logoSvg: `<svg viewBox="0 0 140 40" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="6" fill="#fbbf24"/><circle cx="32" cy="14" r="4" fill="#fb7185"/><circle cx="32" cy="26" r="4" fill="#c026d3"/><path d="M20 26 L14 36 L26 36 Z" fill="#34d399"/><text x="48" y="28" font-family="Inter, sans-serif" font-size="22" font-weight="800" fill="currentColor">Festival</text></svg>`,
    primaryColor: '#c026d3',
    accentColor: '#fbbf24',
    bgTone: '#1a0626',
    radius: 24,
    fontDisplay: 'Inter, system-ui, sans-serif',
    defaultTheme: 'festival',
    tagline: 'A celebration of every new word.',
  },
  'metro-english': {
    id: 'brand-metro',
    subdomain: 'metro-english',
    displayName: 'Metro English Institute',
    logoText: 'Metro',
    logoSvg: `<svg viewBox="0 0 140 40" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="28" height="28" rx="6" fill="none" stroke="#22d3ee" stroke-width="3"/><rect x="12" y="12" width="6" height="6" fill="#f472b6"/><rect x="22" y="12" width="6" height="6" fill="#22d3ee"/><rect x="12" y="22" width="6" height="6" fill="#22d3ee"/><rect x="22" y="22" width="6" height="6" fill="#f472b6"/><text x="44" y="28" font-family="Inter, sans-serif" font-size="22" font-weight="800" fill="currentColor">Metro</text></svg>`,
    primaryColor: '#0ea5e9',
    accentColor: '#f472b6',
    bgTone: '#0a0e1a',
    radius: 12,
    fontDisplay: 'Inter, system-ui, sans-serif',
    defaultTheme: 'cityscape',
    tagline: 'City-smart English for tomorrow.',
  },
};

export const DEFAULT_BRAND_KEY = 'ministar-lab';

export function resolveBrandFromOrigin(origin: string | undefined): BrandManifest {
  if (!origin) return BRANDS[DEFAULT_BRAND_KEY];
  const host = origin.replace(/^https?:\/\//, '').split(':')[0];
  // Match by subdomain prefix in host (e.g. brightpath-academy.example.com)
  const match = Object.values(BRANDS).find((b) => host.startsWith(b.subdomain));
  return match ?? BRANDS[DEFAULT_BRAND_KEY];
}

export function getBrandByKey(key: string): BrandManifest {
  return BRANDS[key] ?? BRANDS[DEFAULT_BRAND_KEY];
}
