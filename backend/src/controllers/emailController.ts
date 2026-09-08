import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { prisma } from '../db/client.js';
import { searchEmails, isElasticsearchReady } from '../services/elasticsearchService.js';

export async function getScheduledEmails(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const where = {
      status: { in: ['scheduled' as const, 'rescheduled' as const, 'processing' as const] },
      campaign: { userId },
    };

    const [total, items] = await Promise.all([
      prisma.emailJob.count({ where }),
      prisma.emailJob.findMany({
        where,
        orderBy: { scheduledFor: 'asc' },
        skip,
        take: limit,
        include: {
          sender: { select: { id: true, email: true } },
          campaign: { select: { id: true, subject: true } },
        },
      }),
    ]);

    return res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      items,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getSentEmails(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const where = {
      status: { in: ['sent' as const, 'failed' as const] },
      campaign: { userId },
    };

    const [total, items] = await Promise.all([
      prisma.emailJob.count({ where }),
      prisma.emailJob.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          sender: { select: { id: true, email: true } },
          campaign: { select: { id: true, subject: true } },
        },
      }),
    ]);

    return res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      items,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function searchEmailsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const q = (req.query.q as string) || '';
    const status = (req.query.status as string) || '';
    const sender = (req.query.sender as string) || '';
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    // Check Elasticsearch first
    if (isElasticsearchReady()) {
      const esResult = await searchEmails({
        query: q,
        status,
        senderId: sender,
        page,
        limit,
      });

      if (esResult.esAvailable) {
        return res.json({
          source: 'elasticsearch',
          page,
          limit,
          total: esResult.total,
          items: esResult.hits,
        });
      }
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fallback to PostgreSQL database search
    const where: any = {
      campaign: { userId },
    };

    if (status) {
      where.status = status;
    }

    if (sender) {
      where.senderId = sender;
    }

    if (q) {
      where.OR = [
        { recipientEmail: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { body: { contains: q, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.emailJob.count({ where }),
      prisma.emailJob.findMany({
        where,
        orderBy: { scheduledFor: 'desc' },
        skip,
        take: limit,
        include: {
          sender: { select: { id: true, email: true } },
          campaign: { select: { id: true, subject: true } },
        },
      }),
    ]);

    return res.json({
      source: 'database_fallback',
      page,
      limit,
      total,
      items,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getEmailStats(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [scheduledCount, sentCount, failedCount] = await Promise.all([
      prisma.emailJob.count({
        where: {
          status: { in: ['scheduled', 'rescheduled', 'processing'] },
          campaign: { userId },
        },
      }),
      prisma.emailJob.count({
        where: {
          status: 'sent',
          campaign: { userId },
        },
      }),
      prisma.emailJob.count({
        where: {
          status: 'failed',
          campaign: { userId },
        },
      }),
    ]);

    return res.json({
      scheduled: scheduledCount,
      sent: sentCount,
      failed: failedCount,
      total: scheduledCount + sentCount + failedCount,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
