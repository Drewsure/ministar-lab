import { NextRequest } from 'next/server';
import { subscribeArena } from '@/lib/multiplayer/arena';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) return new Response('code required', { status: 400 });

  const stream = new ReadableStream({
    start(controller) {
      const unsubscribe = subscribeArena(code, controller);
      const heartbeat = setInterval(() => {
        try { controller.enqueue(new TextEncoder().encode(': heartbeat\n\n')); }
        catch { clearInterval(heartbeat); }
      }, 15000);
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
      'X-Accel-Buffering': 'no',
    },
  });
}
