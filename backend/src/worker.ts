import { startEmailWorker } from './workers/emailWorker.js';
import { prisma } from './db/client.js';
import { redisConnection } from './config/redis.js';
import { env } from './config/env.js';

console.log('[Worker] Email Queue Worker Starting...');
console.log(`[Worker] Concurrency: ${env.WORKER_CONCURRENCY}, Min Delay: ${env.MIN_DELAY_BETWEEN_SENDS_MS}ms`);

const worker = startEmailWorker();

async function handleShutdown(signal: string) {
  console.log(`[Worker] Received ${signal}. Shutting down worker process gracefully...`);
  try {
    if (worker) {
      await worker.close();
    }
    await redisConnection.quit();
    await prisma.$disconnect();
    console.log('[Worker] Graceful shutdown complete.');
    process.exit(0);
  } catch (err: any) {
    console.error('[Worker Shutdown Error]', err.message);
    process.exit(1);
  }
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
