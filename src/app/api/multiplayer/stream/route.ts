import { NextRequest } from 'next/server';
import { subscribe } from '@/lib/multiplayer/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Server-Sent Events endpoint for real-time leaderboard updates
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) {
    return new Response('code required', { status: 400 });
  }

  const stream = new ReadableStream({
    start(controller) {
      // SSE headers
      const unsubscribe = subscribe(code, controller);

      // Heartbeat every 15s to keep the connection alive on Vercel
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      // Clean up on close
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        unsubscribe();
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // disable proxy buffering
    },
  });
}
