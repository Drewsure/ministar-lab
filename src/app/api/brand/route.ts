import { NextRequest, NextResponse } from 'next/server';
import { BRANDS, DEFAULT_BRAND_KEY } from '@/lib/brands';

// GET /api/brand
// Resolves the purchaser's brand_manifest based on origin host.
// In production this hits Neon DB; here we resolve from the in-memory map.
export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin') || req.headers.get('host') || '';
  const host = origin.replace(/^https?:\/\//, '').split(':')[0];

  // Match by subdomain prefix
  const match = Object.values(BRANDS).find(b => host.startsWith(b.subdomain));

  // Allow ?brandKey= override for demo
  const overrideKey = req.nextUrl.searchParams.get('brandKey');
  const brandKey = overrideKey ?? match?.subdomain ?? DEFAULT_BRAND_KEY;

  return NextResponse.json({ brandKey, host, brand: BRANDS[brandKey] ?? BRANDS[DEFAULT_BRAND_KEY] });
}
