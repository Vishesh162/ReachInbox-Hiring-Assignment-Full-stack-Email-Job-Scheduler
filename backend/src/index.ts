import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import apiRouter from './routes/index.js';
import { setupQueueDashboard } from './queues/queueDashboard.js';
import { startEmailWorker, stopEmailWorker } from './workers/emailWorker.js';
import { ensureDefaultSenders } from './services/mailerService.js';
import { initializeElasticsearchIndex } from './services/elasticsearchService.js';
import { reconcileDatabaseAndRedis } from './services/reconciliationService.js';
import { prisma } from './db/client.js';
import { redisConnection } from './config/redis.js';

const app = express();

// Middleware
app.use(
  cors({
    origin: [env.FRONTEND_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Bull Board Queue Dashboard UI mounted at /admin/queues
const queueRouter = setupQueueDashboard();
app.use('/admin/queues', queueRouter);

// API Routes
app.use('/api', apiRouter);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Unhandled Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

async function bootstrap() {
  try {
    console.log('----------------------------------------------------');
    console.log('🚀 ReachInbox Email Job Scheduler Server Starting...');
    console.log('----------------------------------------------------');

    // 1. Ensure default Ethereal sender accounts exist
    try {
      await ensureDefaultSenders();
    } catch (err: any) {
      console.warn('[Bootstrap Warning] Could not ensure senders:', err.message);
    }

    // 2. Initialize Elasticsearch index if reachable
    try {
      await initializeElasticsearchIndex();
    } catch (err: any) {
      console.warn('[Bootstrap Warning] Elasticsearch init skipped:', err.message);
    }

    // 3. Start the BullMQ Worker
    startEmailWorker();

    // 4. Run Boot-Time Reconciliation (DB <-> Redis sync)
    try {
      await reconcileDatabaseAndRedis();
    } catch (err: any) {
      console.warn('[Bootstrap Warning] Boot reconciliation skipped:', err.message);
    }

    // 5. Start HTTP Server
    const server = app.listen(env.PORT, () => {
      console.log(`✅ Server listening on http://localhost:${env.PORT}`);
      console.log(`📊 Live BullMQ Queue Dashboard: http://localhost:${env.PORT}/admin/queues`);
      console.log(`🔌 API Endpoints root: http://localhost:${env.PORT}/api`);
    });

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n[Shutdown] Received ${signal}. Closing server, worker, and connections...`);
      server.close();
      await stopEmailWorker();
      await redisConnection.quit();
      await prisma.$disconnect();
      console.log('[Shutdown] Clean shutdown completed.');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err: any) {
    console.error('❌ Fatal error during bootstrap:', err);
    process.exit(1);
  }
}

bootstrap();

export default app;
