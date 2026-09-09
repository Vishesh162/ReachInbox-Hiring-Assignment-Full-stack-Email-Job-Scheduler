import { Job } from 'bullmq';
import { prisma } from '../db/client.js';
import { EmailJobPayload, enqueueDelayedEmail } from '../queues/emailQueue.js';
import {
  checkAndIncrementRateLimit,
  getNextHourWindowDate,
  markSlackNotificationSent,
} from './rateLimiter.js';
import { sendEmail } from '../services/mailerService.js';
import { sendRateLimitSlackAlert } from '../services/slackService.js';
import { indexEmailDocument } from '../services/elasticsearchService.js';
import { env } from '../config/env.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function processEmailJob(job: Job<EmailJobPayload>) {
  const { emailJobId } = job.data;
  console.log(`[Worker] Starting processing job ${job.id} for EmailJob: ${emailJobId}`);

  // Lookup target job and associated sender info
  const emailJob = await prisma.emailJob.findUnique({
    where: { id: emailJobId },
    include: {
      campaign: true,
      sender: true,
    },
  });

  if (!emailJob) {
    console.warn(`[Worker] EmailJob ${emailJobId} not found in database. Skipping.`);
    return;
  }

  // Atomic state guard to guarantee idempotency across concurrent workers
  const updateResult = await prisma.emailJob.updateMany({
    where: {
      id: emailJobId,
      status: { in: ['scheduled', 'rescheduled'] },
    },
    data: {
      status: 'processing',
      attempts: { increment: 1 },
    },
  });

  if (updateResult.count === 0) {
    console.log(
      `[Worker Idempotency Guard] EmailJob ${emailJobId} is already in state '${emailJob.status}'. No-op.`
    );
    return;
  }

  // Check rate limits against current hour window using atomic Redis Lua script
  const hourlyLimit = emailJob.campaign?.hourlyLimit || env.MAX_EMAILS_PER_HOUR_PER_SENDER;
  const rateLimitResult = await checkAndIncrementRateLimit(emailJob.senderId, hourlyLimit);

  if (!rateLimitResult.allowed) {
    console.warn(
      `[Worker Rate Limit] Sender ${emailJob.sender.email} exceeded hourly limit (${rateLimitResult.currentCount}/${hourlyLimit}) in window ${rateLimitResult.window}. Rescheduling to next window.`
    );

    const nextWindowDate = getNextHourWindowDate();
    const delayUntilNextWindow = Math.max(1000, nextWindowDate.getTime() - Date.now());

    const rescheduledJobId = `emailjob_${emailJobId}_rescheduled_${nextWindowDate.getTime()}`;
    await enqueueDelayedEmail(emailJobId, delayUntilNextWindow, rescheduledJobId);

    // Defer to start of next UTC hour and update bullJobId
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: 'rescheduled',
        scheduledFor: nextWindowDate,
        bullJobId: rescheduledJobId,
        error: `Rate limit hit in window ${rateLimitResult.window}. Deferred to ${nextWindowDate.toISOString()}`,
      },
    });

    await indexEmailDocument({
      id: emailJob.id,
      campaignId: emailJob.campaignId,
      senderId: emailJob.senderId,
      recipient: emailJob.recipientEmail,
      subject: emailJob.subject,
      body: emailJob.body,
      status: 'rescheduled',
      scheduledFor: nextWindowDate.toISOString(),
      error: `Rate limit exceeded in window ${rateLimitResult.window}`,
      createdAt: emailJob.createdAt.toISOString(),
    });

    // Notify Slack once per hourly window per sender
    const isFirstNotification = await markSlackNotificationSent(
      emailJob.senderId,
      rateLimitResult.window
    );

    if (isFirstNotification) {
      await sendRateLimitSlackAlert({
        senderEmail: emailJob.sender.email,
        senderId: emailJob.senderId,
        window: rateLimitResult.window,
        currentCount: rateLimitResult.currentCount,
        limit: hourlyLimit,
        userId: emailJob.campaign?.userId,
      });
    }

    return;
  }

  // Inter-send jitter / pacing
  if (env.MIN_DELAY_BETWEEN_SENDS_MS > 0) {
    await sleep(env.MIN_DELAY_BETWEEN_SENDS_MS);
  }

  try {
    const sendResult = await sendEmail({
      senderId: emailJob.senderId,
      to: emailJob.recipientEmail,
      subject: emailJob.subject,
      body: emailJob.body,
    });

    const sentAt = new Date();

    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: 'sent',
        sentAt,
        error: null,
      },
    });

    await indexEmailDocument({
      id: emailJob.id,
      campaignId: emailJob.campaignId,
      senderId: emailJob.senderId,
      recipient: emailJob.recipientEmail,
      subject: emailJob.subject,
      body: emailJob.body,
      status: 'sent',
      scheduledFor: emailJob.scheduledFor.toISOString(),
      sentAt: sentAt.toISOString(),
      error: null,
      createdAt: emailJob.createdAt.toISOString(),
    });

    console.log(
      `[Worker Success] EmailJob ${emailJobId} sent successfully to ${emailJob.recipientEmail}. Preview: ${sendResult.previewUrl || 'none'}`
    );
  } catch (err: any) {
    const maxAttempts = job.opts.attempts || 3;
    const currentAttempt = job.attemptsMade || 1;
    const isFinalAttempt = currentAttempt >= maxAttempts;

    console.error(
      `[Worker Failure] Failed to send EmailJob ${emailJobId} (Attempt ${currentAttempt}/${maxAttempts}):`,
      err.message
    );

    // Update DB: only transition permanently to 'failed' on final attempt, otherwise leave 'scheduled' for BullMQ retry
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: isFinalAttempt ? 'failed' : 'scheduled',
        error: isFinalAttempt
          ? err.message
          : `Attempt ${currentAttempt}/${maxAttempts} failed: ${err.message}`,
      },
    });

    // Update Elasticsearch
    await indexEmailDocument({
      id: emailJob.id,
      campaignId: emailJob.campaignId,
      senderId: emailJob.senderId,
      recipient: emailJob.recipientEmail,
      subject: emailJob.subject,
      body: emailJob.body,
      status: isFinalAttempt ? 'failed' : 'scheduled',
      scheduledFor: emailJob.scheduledFor.toISOString(),
      sentAt: null,
      error: err.message,
      createdAt: emailJob.createdAt.toISOString(),
    });

    // Rethrow to trigger BullMQ retry/backoff
    throw err;
  }
}
