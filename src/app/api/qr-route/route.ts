import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/qr-route
// Create or update a QR route (slug → game/theme/unit).
// bakeIn=true permanently locks the route so admins can't change it later.
export async function POST(req: NextRequest) {
  let body: {
    slug: string;
    unit: string;
    gameMode: string;
    themeId: string;
    bakeIn: boolean;
    tenantId?: string;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  if (!body.slug) {
    return NextResponse.json({ error: 'slug required' }, { status: 400 });
  }

  // No database configured (e.g. Vercel without DATABASE_URL) — return a stub
  if (!db) {
    return NextResponse.json({
      route: { ...body, slug: body.slug, active: true, id: 'stub' },
      note: 'No database configured — returning in-memory stub.',
    });
  }

  // If route exists and is bakeIn-locked, refuse updates
  const existing = await db.qrRoute.findUnique({ where: { slug: body.slug } });
  if (existing?.bakeIn) {
    return NextResponse.json({ error: 'route is bake-in locked', route: existing }, { status: 409 });
  }

  const route = await db.qrRoute.upsert({
    where: { slug: body.slug },
    create: {
      slug: body.slug,
      unit: body.unit,
      gameMode: body.gameMode,
      themeId: body.themeId,
      bakeIn: body.bakeIn,
      active: true,
      tenantId: body.tenantId ?? 'demo-tenant',
    },
    update: {
      unit: body.unit,
      gameMode: body.gameMode,
      themeId: body.themeId,
      bakeIn: body.bakeIn,
    },
  });

  return NextResponse.json({ route });
}

// GET /api/qr-route?slug=unit-3
// Used by the QR scanner app to resolve a printed QR code → game session.
export async function GET(req: NextRequest) {
  if (!db) {
    return NextResponse.json({ routes: [], note: 'No database configured on this deployment.' });
  }
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) {
    const all = await db.qrRoute.findMany({ take: 50 });
    return NextResponse.json({ routes: all });
  }
  const route = await db.qrRoute.findUnique({ where: { slug } });
  if (!route || !route.active) {
    return NextResponse.json({ error: 'route not found' }, { status: 404 });
  }
  return NextResponse.json({ route });
}
