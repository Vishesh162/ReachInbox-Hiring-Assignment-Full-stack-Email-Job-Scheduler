import { prisma } from '../db/client.js';
import { sendRateLimitSlackAlert } from '../services/slackService.js';

async function main() {
  console.log('----------------------------------------');
  console.log('[Slack Test] Checking for Connected Slack User...');
  console.log('----------------------------------------');

  const users = await prisma.user.findMany({
    where: {
      slackAccessToken: { not: null },
    },
    select: {
      id: true,
      email: true,
      name: true,
      slackAccessToken: true,
      slackTeamId: true,
      slackChannelId: true,
    },
  });

  if (users.length === 0) {
    console.log('[Slack Test] No user with Slack connected found in DB yet.');
    console.log('[Slack Test] Connect Slack from dashboard at http://localhost:3000/dashboard first.');
    process.exit(1);
  }

  const user = users[0];
  console.log(`[Slack Test] Found connected user: ${user.name} (${user.email})`);
  console.log(`[Slack Test] Team: ${user.slackTeamId}, Channel: ${user.slackChannelId}`);

  console.log('\n[Slack Test] Dispatching rate limit alert test...');
  await sendRateLimitSlackAlert({
    senderEmail: 'mxjfxivpz4yi7ttq@ethereal.email',
    senderId: '11df4d3c-1502-48b3-b0cd-5c7d18fe9810',
    window: new Date().toISOString().slice(0, 13),
    currentCount: 5,
    limit: 5,
  });

  console.log('[Slack Test] Slack alert dispatched successfully.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[Slack Test Error]', err);
  process.exit(1);
});
