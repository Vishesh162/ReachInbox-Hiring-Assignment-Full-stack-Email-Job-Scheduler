import { Worker } from 'bullmq';
import { EMAIL_QUEUE_NAME, EmailJobPayload } from '../queues/emailQueue.js';
import { redisConnection } from '../config/redis.js';
import { processEmailJob } from './emailProcessor.js';
import { env } from '../config/env.js';

let emailWorker: Worker<EmailJobPayload> | null = null;

export function startEmailWorker() {
  if (emailWorker) {
    return emailWorker;
  }

  console.log(`[Worker Init] Starting Email Worker with concurrency: ${env.WORKER_CONCURRENCY}`);

  emailWorker = new Worker<EmailJobPayload>(
    EMAIL_QUEUE_NAME,
    async (job) => {
      await processEmailJob(job);
    },
    {
      connection: redisConnection,
      concurrency: env.WORKER_CONCURRENCY,
    }
  );

  emailWorker.on('completed', (job) => {
    console.log(`[Worker Event] Job completed: ${job.id}`);
  });

  emailWorker.on('failed', (job, err) => {
    console.error(`[Worker Event] Job failed: ${job?.id}, Reason: ${err.message}`);
  });

  emailWorker.on('error', (err) => {
    console.error('[Worker Error]', err.message);
  });

  return emailWorker;
}

export async function stopEmailWorker() {
  if (emailWorker) {
    console.log('[Worker] Shutting down gracefully...');
    await emailWorker.close();
    emailWorker = null;
  }
}
