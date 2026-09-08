import { prisma } from '../db/client.js';
import { enqueueDelayedEmail, getDeterministicJobId } from '../queues/emailQueue.js';
import { indexEmailDocument } from './elasticsearchService.js';
import { env } from '../config/env.js';

export interface CreateCampaignInput {
  userId: string;
  subject: string;
  body: string;
  startTime: Date;
  delayMs?: number;
  hourlyLimit?: number;
  senderIds?: string[];
  recipients: string[];
}

export async function createCampaign(input: CreateCampaignInput) {
  const {
    userId,
    subject,
    body,
    startTime,
    delayMs = env.MIN_DELAY_BETWEEN_SENDS_MS,
    hourlyLimit = env.MAX_EMAILS_PER_HOUR_PER_SENDER,
    senderIds,
    recipients,
  } = input;

  if (!subject || !subject.trim()) {
    throw new Error('Subject is required');
  }
  if (!body || !body.trim()) {
    throw new Error('Email body is required');
  }

  // Deduplicate and trim email addresses
  const cleanRecipients = Array.from(
    new Set(
      recipients
        .map((r) => r.trim().toLowerCase())
        .filter((r) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r))
    )
  );

  if (cleanRecipients.length === 0) {
    throw new Error('No valid recipient email addresses provided');
  }

  // Determine senders to round-robin or distribute across
  let availableSenderIds = senderIds || [];
  if (availableSenderIds.length === 0) {
    const allSenders = await prisma.sender.findMany({ select: { id: true } });
    if (allSenders.length === 0) {
      throw new Error('No senders available in the system');
    }
    availableSenderIds = allSenders.map((s) => s.id);
  }

  // 1. Create Campaign row in PostgreSQL
  const campaign = await prisma.campaign.create({
    data: {
      userId,
      subject,
      body,
      startTime,
      delayMs,
      hourlyLimit,
      totalLeads: cleanRecipients.length,
    },
  });

  const nowMs = Date.now();
  const startTimeMs = new Date(startTime).getTime();
  const baseDelayMs = Math.max(0, startTimeMs - nowMs);

  // 2. Prepare all EmailJob records for Postgres insertion FIRST
  const emailJobDataToInsert = cleanRecipients.map((recipientEmail, index) => {
    const senderId = availableSenderIds[index % availableSenderIds.length];
    const offsetMs = index * delayMs;
    const scheduledFor = new Date(startTimeMs + offsetMs);

    // Pre-generate a deterministic ID or UUID
    const emailJobId = crypto.randomUUID();
    const bullJobId = getDeterministicJobId(emailJobId);

    return {
      id: emailJobId,
      campaignId: campaign.id,
      senderId,
      recipientEmail,
      subject,
      body,
      scheduledFor,
      status: 'scheduled' as const,
      bullJobId,
    };
  });

  // Bulk insert in Postgres before any enqueuing
  await prisma.emailJob.createMany({
    data: emailJobDataToInsert,
  });

  console.log(
    `[Scheduler] Saved ${emailJobDataToInsert.length} EmailJob records to PostgreSQL for campaign ${campaign.id}`
  );

  // 3. Fan-out enqueuing into BullMQ with deterministic IDs and scheduled delays
  const enqueuePromises = emailJobDataToInsert.map(async (jobData, index) => {
    const delay = baseDelayMs + index * delayMs;

    // Enqueue BullMQ delayed job
    await enqueueDelayedEmail(jobData.id, delay, jobData.bullJobId);

    // Index into Elasticsearch (asynchronously)
    indexEmailDocument({
      id: jobData.id,
      campaignId: jobData.campaignId,
      senderId: jobData.senderId,
      recipient: jobData.recipientEmail,
      subject: jobData.subject,
      body: jobData.body,
      status: 'scheduled',
      scheduledFor: jobData.scheduledFor.toISOString(),
      createdAt: new Date().toISOString(),
    }).catch((err) => {
      console.warn(`[Elasticsearch] Background index warning for ${jobData.id}:`, err.message);
    });
  });

  await Promise.all(enqueuePromises);

  console.log(`[Scheduler] Successfully enqueued ${cleanRecipients.length} delayed jobs in BullMQ`);

  return {
    campaign,
    totalScheduled: cleanRecipients.length,
    firstScheduledFor: emailJobDataToInsert[0]?.scheduledFor,
    lastScheduledFor: emailJobDataToInsert[emailJobDataToInsert.length - 1]?.scheduledFor,
  };
}
