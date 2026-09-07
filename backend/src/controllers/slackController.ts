import { Request, Response } from 'express';
import { getSlackAuthorizeUrl, exchangeSlackCode } from '../services/slackService.js';
import { env } from '../config/env.js';

export async function getSlackAuthUrlHandler(req: Request, res: Response) {
  try {
    const state = (req.query.userId as string) || 'reachinbox';
    const authUrl = getSlackAuthorizeUrl(state);
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

    const userId = state !== 'reachinbox' ? state : undefined;
    const result = await exchangeSlackCode(code, userId);

    console.log(`[Slack] OAuth exchange complete for team: ${result.teamName}`);

    // Redirect back to frontend dashboard with success banner
    return res.redirect(`${env.FRONTEND_URL}/dashboard?slack=connected&team=${encodeURIComponent(result.teamName || '')}`);
  } catch (err: any) {
    console.error('[Slack Callback Error]', err.message);
    return res.redirect(`${env.FRONTEND_URL}/dashboard?slack=error&msg=${encodeURIComponent(err.message)}`);
  }
}
