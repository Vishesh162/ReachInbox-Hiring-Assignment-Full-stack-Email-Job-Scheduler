import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { createCampaign } from '../services/schedulerService.js';
import { prisma } from '../db/client.js';
import { parse } from 'csv-parse/sync';

export async function createCampaignHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User unauthorized' });
    }

    const {
      subject,
      body,
      startTime,
      delayMs,
      hourlyLimit,
      senderIds,
      recipients,
    } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({ error: 'Subject is required' });
    }
    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'Body is required' });
    }
    if (!startTime) {
      return res.status(400).json({ error: 'Start time is required' });
    }
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'At least one recipient email is required' });
    }

    const result = await createCampaign({
      userId,
      subject: subject.trim(),
      body: body.trim(),
      startTime: new Date(startTime),
      delayMs: delayMs !== undefined ? Number(delayMs) : undefined,
      hourlyLimit: hourlyLimit !== undefined ? Number(hourlyLimit) : undefined,
      senderIds: Array.isArray(senderIds) && senderIds.length > 0 ? senderIds : undefined,
      recipients,
    });

    return res.status(201).json({
      success: true,
      campaign: result.campaign,
      totalScheduled: result.totalScheduled,
      firstScheduledFor: result.firstScheduledFor,
      lastScheduledFor: result.lastScheduledFor,
    });
  } catch (err: any) {
    console.error('[Create Campaign Error]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Parses raw CSV string or lines into recipient email array
 */
export async function parseCsvRecipientsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const { csvContent } = req.body;
    if (!csvContent || typeof csvContent !== 'string') {
      return res.status(400).json({ error: 'csvContent string is required' });
    }

    let records: any[] = [];
    try {
      records = parse(csvContent, {
        columns: false,
        skip_empty_lines: true,
        trim: true,
      });
    } catch {
      // If parsing fails as standard CSV, split line by line
      records = csvContent.split(/\r?\n/).map((line) => [line]);
    }

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const extractedEmails: string[] = [];

    for (const row of records) {
      for (const cell of row) {
        if (typeof cell === 'string') {
          const matches = cell.match(emailRegex);
          if (matches) {
            extractedEmails.push(...matches.map((m) => m.toLowerCase()));
          }
        }
      }
    }

    const uniqueEmails = Array.from(new Set(extractedEmails));

    return res.json({
      success: true,
      totalCount: uniqueEmails.length,
      emails: uniqueEmails,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getCampaignsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { emailJobs: true },
        },
      },
      take: 20,
    });
    return res.json({ campaigns });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
