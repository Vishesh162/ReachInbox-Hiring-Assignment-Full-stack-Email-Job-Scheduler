import { prisma } from '../db/client.js';
import { sendRateLimitSlackAlert } from '../services/slackService.js';

async function main() {
  console.log('----------------------------------------');
  console.log('🔍 Checking for Connected Slack User...');
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
    console.log('⚠️ No user with Slack connected found in DB yet!');
    console.log('👉 Please go to http://localhost:3000/dashboard, click "Connect Slack", and click "Allow".');
    process.exit(1);
  }

  const user = users[0];
  console.log(`✅ Found connected Slack user: ${user.name} (${user.email})`);
  console.log(`Team ID: ${user.slackTeamId}, Channel ID: ${user.slackChannelId}`);

  console.log('\n🚀 Triggering a test Hourly Rate Limit Slack Alert...');
  await sendRateLimitSlackAlert({
    senderEmail: 'mxjfxivpz4yi7ttq@ethereal.email',
    senderId: '11df4d3c-1502-48b3-b0cd-5c7d18fe9810',
    window: new Date().toISOString().slice(0, 13),
    currentCount: 5,
    limit: 5,
  });

  console.log('✅ Slack alert sent! Check your Slack channel!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Failed to trigger Slack alert:', err);
  process.exit(1);
});
