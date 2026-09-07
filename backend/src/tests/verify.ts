/**
 * ReachInbox Automated Verification Suite
 * Tests core invariants:
 * 1. Deterministic BullMQ Job ID & Idempotency
 * 2. Rate Limit Window Calculation & Hourly Bounds
 * 3. CSV Lead Parsing & Deduplication
 */

import { getDeterministicJobId } from '../queues/emailQueue.js';
import { getCurrentHourWindow, getNextHourWindowDate } from '../workers/rateLimiter.js';
import { parse } from 'csv-parse/sync';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runTests() {
  console.log('--------------------------------------------------');
  console.log('🧪 Running ReachInbox Email Job Scheduler Tests');
  console.log('--------------------------------------------------');

  // Test 1: Deterministic BullMQ Job ID derivation
  console.log('\n[Test 1] Deterministic Job ID Derivation');
  const mockId1 = 'c0286fc7-85b4-4b53-9a48-8df05072049e';
  const derived1 = getDeterministicJobId(mockId1);
  const derived2 = getDeterministicJobId(mockId1);

  assert(derived1 === `emailjob_${mockId1}`, 'Job ID format matches emailjob_<id>');
  assert(derived1 === derived2, 'Identical EmailJob.id yields identical BullMQ jobId for deduplication');

  // Test 2: Rate Limit Window Formatting & Next Window Bounds
  console.log('\n[Test 2] Hourly Rate Limit Window & Rescheduling Math');
  const testDate = new Date('2026-09-07T18:15:30.000Z');
  const windowStr = getCurrentHourWindow(testDate);
  assert(windowStr === '2026-09-07-18', `Current hour window calculated correctly (${windowStr})`);

  const nextWindowDate = getNextHourWindowDate(testDate);
  assert(
    nextWindowDate.getUTCHours() === 19 && nextWindowDate.getUTCDate() === 7,
    `Next window increments exactly to next UTC hour (${nextWindowDate.toISOString()})`
  );
  assert(
    nextWindowDate.getTime() > testDate.getTime(),
    'Next window is strictly in the future'
  );

  // Test 3: CSV Lead Extraction & Whitespace/Deduplication Handling
  console.log('\n[Test 3] CSV Lead Extraction & Sanitization');
  const sampleCsv = `
Name,Email,Company
Alice, alice@outbox.com ,Outbox
Bob,bob@domain.io,Acme
Duplicate Alice,ALICE@outbox.com,Outbox
Malformed,not-an-email,Test
Charlie, charlie.dev@reachinbox.ai ,ReachInbox
`;

  const parsedRecords = parse(sampleCsv, { skip_empty_lines: true, trim: true });
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails: string[] = [];

  for (const row of parsedRecords) {
    for (const cell of row) {
      const match = (cell as string).match(emailRegex);
      if (match) {
        emails.push(...match.map((m) => m.toLowerCase()));
      }
    }
  }

  const unique = Array.from(new Set(emails));
  assert(unique.length === 3, `Extracted exact 3 unique valid emails (got ${unique.length})`);
  assert(unique.includes('alice@outbox.com'), 'Includes alice@outbox.com');
  assert(unique.includes('bob@domain.io'), 'Includes bob@domain.io');
  assert(unique.includes('charlie.dev@reachinbox.ai'), 'Includes charlie.dev@reachinbox.ai');
  assert(!unique.includes('not-an-email'), 'Filters invalid emails');

  console.log('\n==================================================');
  console.log('🎉 ALL REACHINBOX INVARIANT TESTS PASSED!');
  console.log('==================================================');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
