import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Vercel/serverless-safe: only instantiate PrismaClient when a real
// DATABASE_URL is configured. Otherwise export `null` and callers fall
// back to in-memory defaults (the app still runs — just without persistence).
export const db = (() => {
  const url = process.env.DATABASE_URL;
  if (!url || url.startsWith('file:')) {
    // Local SQLite file mode OR no DB configured — return null.
    // In local dev with a real file:// URL, we still want Prisma to work,
    // so check if we're on a writable filesystem.
    if (url && url.startsWith('file:') && process.env.NODE_ENV !== 'production') {
      return globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
    }
    return null as unknown as PrismaClient;
  }
  // Real PostgreSQL (e.g. Neon) — use the connection pool.
  return globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
})();

if (process.env.NODE_ENV !== 'production' && db) {
  globalForPrisma.prisma = db
}