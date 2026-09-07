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

    // Defer to start of next UTC hour
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: 'rescheduled',
        scheduledFor: nextWindowDate,
        error: `Rate limit hit in window ${rateLimitResult.window}. Deferred to ${nextWindowDate.toISOString()}`,
      },
    });

    const rescheduledJobId = `emailjob_${emailJobId}_rescheduled_${nextWindowDate.getTime()}`;
    await enqueueDelayedEmail(emailJobId, delayUntilNextWindow, rescheduledJobId);

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
    console.error(`[Worker Failure] Failed to send EmailJob ${emailJobId}:`, err.message);

    // Update DB with failure
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: 'failed',
        error: err.message,
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
      status: 'failed',
      scheduledFor: emailJob.scheduledFor.toISOString(),
      sentAt: null,
      error: err.message,
      createdAt: emailJob.createdAt.toISOString(),
    });

    // Rethrow to trigger BullMQ retry/backoff
    throw err;
  }
}
