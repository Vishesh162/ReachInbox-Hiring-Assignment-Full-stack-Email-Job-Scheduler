import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getSlackAuthorizeUrl, exchangeSlackCode } from '../services/slackService.js';
import { env } from '../config/env.js';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { prisma } from '../db/client.js';

export async function getSlackAuthUrlHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id || (req.query.userId as string) || 'reachinbox';
    const authUrl = getSlackAuthorizeUrl(userId);
    return res.json({ url: authUrl });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function slackCallbackHandler(req: Request, res: Response) {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string;

    if (!code) {
      return res.status(400).send('Missing authorization code');
    }

    let userId: string | undefined = undefined;
    if (state && state !== 'reachinbox') {
      userId = state;
    }

    // Fallback: check session_token cookie if state was default
    if (!userId) {
      const token = (req as any).cookies?.session_token || req.headers.authorization?.replace(/^Bearer\s+/i, '');
      if (token) {
        try {
          const decoded = jwt.verify(token, env.JWT_SECRET) as any;
          if (decoded?.id) {
            userId = decoded.id;
          }
        } catch {
          // ignore
        }
      }
    }

    const result = await exchangeSlackCode(code, userId);

    console.log(`[Slack] OAuth exchange complete for team: ${result.teamName} (user: ${userId || 'default'})`);

    const targetFrontend =
      process.env.RENDER || req.headers.host?.includes('render.com')
        ? 'https://reach-inbox-hiring-assignment-full-brown.vercel.app'
        : (env.FRONTEND_URL.includes('localhost') ? 'https://reach-inbox-hiring-assignment-full-brown.vercel.app' : env.FRONTEND_URL);

    // Redirect back to frontend dashboard with success banner
    return res.redirect(`${targetFrontend}/dashboard?slack=connected&team=${encodeURIComponent(result.teamName || '')}`);
  } catch (err: any) {
    console.error('[Slack Callback Error]', err.message);
    const targetFrontend =
      process.env.RENDER || req.headers.host?.includes('render.com')
        ? 'https://reach-inbox-hiring-assignment-full-brown.vercel.app'
        : (env.FRONTEND_URL.includes('localhost') ? 'https://reach-inbox-hiring-assignment-full-brown.vercel.app' : env.FRONTEND_URL);

    return res.redirect(`${targetFrontend}/dashboard?slack=error&msg=${encodeURIComponent(err.message)}`);
  }
}

export async function disconnectSlackHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        slackAccessToken: null,
        slackTeamId: null,
        slackChannelId: null,
      },
    });

    console.log(`[Slack] Disconnected Slack for user: ${userId}`);
    return res.json({ success: true, message: 'Slack disconnected successfully' });
  } catch (err: any) {
    console.error('[Slack Disconnect Error]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

