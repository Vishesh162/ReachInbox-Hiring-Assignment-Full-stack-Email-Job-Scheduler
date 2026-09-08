import { WebClient } from '@slack/web-api';
import { env } from '../config/env.js';
import { prisma } from '../db/client.js';

export function getSlackAuthorizeUrl(state?: string): string {
  if (!env.SLACK_CLIENT_ID) {
    throw new Error('SLACK_CLIENT_ID is not configured');
  }

  const scopes = ['chat:write', 'chat:write.public', 'channels:read'];
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: scopes.join(','),
    redirect_uri: env.SLACK_REDIRECT_URI,
    state: state || 'reachinbox',
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function exchangeSlackCode(code: string, userId?: string) {
  const client = new WebClient();

  const response = await client.oauth.v2.access({
    client_id: env.SLACK_CLIENT_ID,
    client_secret: env.SLACK_CLIENT_SECRET,
    code,
    redirect_uri: env.SLACK_REDIRECT_URI,
  });

  if (!response.ok || !response.access_token) {
    throw new Error(response.error || 'Failed to exchange Slack code');
  }

  const accessToken = response.access_token;
  const teamId = response.team?.id;
  const channelId = (response.incoming_webhook as any)?.channel_id || response.authed_user?.id;

  if (userId) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        slackAccessToken: accessToken,
        slackTeamId: teamId,
        slackChannelId: channelId,
      },
    });
  } else {
    // If no userId provided, link to the first user or create/update
    const user = await prisma.user.findFirst();
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          slackAccessToken: accessToken,
          slackTeamId: teamId,
          slackChannelId: channelId,
        },
      });
    }
  }

  return {
    accessToken,
    teamId,
    teamName: response.team?.name,
    channelId,
  };
}

/**
 * Sends a rate-limit alert message to connected Slack workspace/channel.
 * If user has not connected Slack: no-op, no crash.
 */
export async function sendRateLimitSlackAlert({
  senderEmail,
  senderId,
  window,
  currentCount,
  limit,
  userId,
}: {
  senderEmail: string;
  senderId: string;
  window: string;
  currentCount: number;
  limit: number;
  userId?: string;
}) {
  try {
    // Prioritize the campaign owner's connected Slack, falling back to any connected user
    let userWithSlack = null;
    if (userId) {
      userWithSlack = await prisma.user.findUnique({
        where: { id: userId },
      });
    }

    if (!userWithSlack || !userWithSlack.slackAccessToken) {
      userWithSlack = await prisma.user.findFirst({
        where: {
          slackAccessToken: { not: null },
        },
      });
    }

    if (!userWithSlack || !userWithSlack.slackAccessToken) {
      console.log('[Slack Alert] No connected Slack user found. Skipping alert.');
      return;
    }

    const client = new WebClient(userWithSlack.slackAccessToken);
    const channel = userWithSlack.slackChannelId || '#general';

    await client.chat.postMessage({
      channel,
      text: `⚠️ *Hourly Rate Limit Exceeded for Sender*`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '⚠️ Hourly Rate Limit Exceeded',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Sender:*\n${senderEmail} (\`${senderId}\`)`,
            },
            {
              type: 'mrkdwn',
              text: `*Hour Window:*\n\`${window}\``,
            },
            {
              type: 'mrkdwn',
              text: `*Quota Used:*\n${currentCount} / ${limit} emails`,
            },
            {
              type: 'mrkdwn',
              text: `*Action Taken:*\nAutomated order-preserving reschedule to next window.`,
            },
          ],
        },
      ],
    });

    console.log(`[Slack Alert] Successfully delivered alert for sender ${senderEmail} to channel ${channel}`);
  } catch (err: any) {
    console.warn('[Slack Alert Error]', err.message);
  }
}
