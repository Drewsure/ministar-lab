import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyTelemetry } from '@/lib/telemetry';
import type { XapiEvent, TelemetryVerifyResult } from '@/lib/types';

// POST /api/telemetry/verify
// Server-authoritative dual-verification gate.
// Persists every xAPI event to the Neon (or local SQLite) database.
// If an anomaly is flagged, the score is quarantined for teacher review.
export async function POST(req: NextRequest) {
  let event: XapiEvent;
  try {
    event = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  // Extract context for DB persistence
  const tenantId =
    (event.context?.extensions?.['https://ministar.lab/xapi/tenantId'] as string | undefined) ??
    'demo-tenant';
  const gameMode =
    (event.context?.extensions?.['https://ministar.lab/xapi/gameMode'] as string | undefined) ??
    event.object.id.split('/').pop() ??
    'unknown';

  // Build a verify input from the single event (single-shot verification
  // for the "answered" events; the "completed" event carries final score).
  const isCompleted = event.verb.id === 'https://w3id.org/xapi/verbs/completed';
  const totalQuestions = event.result?.score?.max ?? 0;
  const correct = event.result?.score?.raw ?? 0;
  const durationStr = event.result?.duration ?? 'PT0S';
  const durationMs = parseIsoDurationMs(durationStr);

  let verify: TelemetryVerifyResult = { status: 'ok', finalScore: correct };
  if (isCompleted && totalQuestions > 0) {
    // Run dual-verification gate
    verify = verifyTelemetry({
      events: [event],
      totalQuestions,
      durationMs,
    });
  }

  // Persist (skip silently if no DB is configured — e.g. on Vercel without DATABASE_URL)
  try {
    if (db) {
      // Ensure tenant row exists (foreign key constraint)
      await db.tenant.upsert({
        where: { id: tenantId },
        create: {
          id: tenantId,
          subdomain: tenantId,
          displayName: tenantId,
        },
        update: {},
      });
      await db.telemetryEvent.create({
        data: {
          tenantId,
          gameMode,
          unit: event.object.id.includes('/units/')
            ? event.object.id.split('/units/')[1].split('/')[0]
            : 'unit-1',
          payload: JSON.stringify(event),
          score: correct,
          durationMs,
          status: verify.status,
          anomalyReason: verify.anomalyReason ?? null,
        },
      });
    }
  } catch (e) {
    console.error('[telemetry] DB write failed:', e);
    // DB write must never block the game
  }

  return NextResponse.json({ ok: true, ...verify });
}

// GET /api/telemetry/verify?tenantId=...
// Returns recent telemetry events for the dashboard.
export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') || 'demo-tenant';
  if (!db) {
    return NextResponse.json({ events: [], note: 'No database configured on this deployment.' });
  }
  const events = await db.telemetryEvent.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  return NextResponse.json({ events });
}

function parseIsoDurationMs(d: string): number {
  const m = d.match(/^PT(?:(\d+\.?\d*)S)?(?:(\d+\.?\d*)M)?(?:(\d+\.?\d*)H)?$/);
  if (!m) return 0;
  const s = parseFloat(m[1] ?? '0');
  const mi = parseFloat(m[2] ?? '0');
  const h = parseFloat(m[3] ?? '0');
  return (h * 3600 + mi * 60 + s) * 1000;
}
