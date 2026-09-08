import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'stdout', level: 'warn' },
  ],
});

// Suppress benign serverless idle socket closure notifications from Neon/PgBouncer
// Prisma automatically reconnects on demand for subsequent queries.
(prisma as any).$on('error', (e: any) => {
  const msg = typeof e === 'string' ? e : e?.message || '';
  if (msg.includes('kind: Closed') || msg.includes('Connection closed')) {
    return;
  }
  console.error('[Prisma Error]', e);
});

export default prisma;

