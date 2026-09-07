import { Queue, JobsOptions } from 'bullmq';
import { redisConnection } from '../config/redis.js';

export const EMAIL_QUEUE_NAME = 'email-scheduler-queue';

export interface EmailJobPayload {
  emailJobId: string;
}

export const emailQueue = new Queue<EmailJobPayload>(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: false, // Keep in Redis for history and inspection
    removeOnFail: false,
  },
});

/**
 * Deterministic helper to derive BullMQ job ID from EmailJob ID
 */
export function getDeterministicJobId(emailJobId: string): string {
  return `emailjob_${emailJobId}`;
}

/**
 * Enqueue an email job with explicit delayed timestamp
 */
export async function enqueueDelayedEmail(
  emailJobId: string,
  delayMs: number,
  customJobId?: string
) {
  const deterministicJobId = customJobId || getDeterministicJobId(emailJobId);

  const jobOptions: JobsOptions = {
    jobId: deterministicJobId,
    delay: Math.max(0, delayMs),
  };

  return await emailQueue.add(
    'send-email',
    { emailJobId },
    jobOptions
  );
}
