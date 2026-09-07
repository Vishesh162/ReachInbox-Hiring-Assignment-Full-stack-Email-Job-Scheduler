import { prisma } from '../db/client.js';
import { emailQueue, enqueueDelayedEmail } from '../queues/emailQueue.js';

/**
 * On worker/server boot: Reconciles PostgreSQL with Redis.
 * Queries DB for scheduled/rescheduled jobs whose BullMQ job is missing from Redis,
 * and re-adds them. Never re-adds ones already present or already sent.
 */
export async function reconcileDatabaseAndRedis(): Promise<{
  checked: number;
  reEnqueued: number;
  alreadyPresent: number;
}> {
  console.log('[Reconciliation] Starting DB ↔ Redis boot reconciliation...');

  // Reset any orphaned 'processing' jobs that crashed mid-send back to 'scheduled'
  const resetResult = await prisma.emailJob.updateMany({
    where: {
      status: 'processing',
    },
    data: {
      status: 'scheduled',
    },
  });

  if (resetResult.count > 0) {
    console.log(`[Reconciliation] Recovered ${resetResult.count} orphaned processing jobs back to 'scheduled'`);
  }

  // Find all scheduled or rescheduled jobs
  const pendingJobs = await prisma.emailJob.findMany({
    where: {
      status: { in: ['scheduled', 'rescheduled'] },
    },
  });

  let reEnqueued = 0;
  let alreadyPresent = 0;

  for (const job of pendingJobs) {
    const bullJobId = (job.bullJobId || '').replace(/:/g, '_');
    if (job.bullJobId !== bullJobId) {
      await prisma.emailJob.update({
        where: { id: job.id },
        data: { bullJobId },
      });
    }

    // Check if the deterministic BullMQ job exists in Redis
    const existingBullJob = await emailQueue.getJob(bullJobId);

    if (existingBullJob) {
      // Job is already safely registered in Redis delayed/wait set
      alreadyPresent++;
    } else {
      // Job was lost from Redis or never enqueued due to mid-enqueue crash
      const delayMs = Math.max(0, job.scheduledFor.getTime() - Date.now());
      console.log(
        `[Reconciliation] Re-enqueuing missing job: ${job.id} (BullId: ${bullJobId}, delay: ${delayMs}ms)`
      );
      await enqueueDelayedEmail(job.id, delayMs, bullJobId);
      reEnqueued++;
    }
  }

  console.log(
    `[Reconciliation Complete] Checked: ${pendingJobs.length}, Already in Redis: ${alreadyPresent}, Re-enqueued: ${reEnqueued}`
  );

  return {
    checked: pendingJobs.length,
    reEnqueued,
    alreadyPresent,
  };
}
