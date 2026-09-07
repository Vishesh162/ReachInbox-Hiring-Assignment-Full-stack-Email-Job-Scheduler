import { redisConnection } from '../config/redis.js';
import { env } from '../config/env.js';

/**
 * Returns UTC hour window string e.g. "2026-09-07-18"
 */
export function getCurrentHourWindow(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  return `${y}-${m}-${d}-${h}`;
}

/**
 * Calculates start of next UTC hour window
 */
export function getNextHourWindowDate(date = new Date()): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours() + 1,
      0,
      2, // +2 seconds buffer into next hour
      0
    )
  );
}

const RATE_LIMIT_LUA_SCRIPT = `
local senderKey = KEYS[1]
local globalKey = KEYS[2]
local senderLimit = tonumber(ARGV[1])
local globalLimit = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])

local senderVal = tonumber(redis.call('GET', senderKey) or '0')
if senderVal >= senderLimit then
    return {0, senderVal, 'SENDER_LIMIT'}
end

local globalVal = tonumber(redis.call('GET', globalKey) or '0')
if globalVal >= globalLimit then
    return {0, globalVal, 'GLOBAL_LIMIT'}
end

local newSenderVal = redis.call('INCR', senderKey)
if newSenderVal == 1 then
    redis.call('EXPIRE', senderKey, ttl)
end

local newGlobalVal = redis.call('INCR', globalKey)
if newGlobalVal == 1 then
    redis.call('EXPIRE', globalKey, ttl)
end

return {1, newSenderVal, 'OK'}
`;

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  reason: 'OK' | 'SENDER_LIMIT' | 'GLOBAL_LIMIT';
  window: string;
}

/**
 * Atomically checks and increments rate limit counters for a sender in the current hour window
 */
export async function checkAndIncrementRateLimit(
  senderId: string,
  customSenderLimit?: number
): Promise<RateLimitCheckResult> {
  const window = getCurrentHourWindow();
  const senderKey = `rl:${senderId}:${window}`;
  const globalKey = `rl:global:${window}`;

  const senderLimit = customSenderLimit || env.MAX_EMAILS_PER_HOUR_PER_SENDER;
  const globalLimit = env.MAX_EMAILS_PER_HOUR;
  const windowTTL = 7200; // 2 hours TTL

  try {
    const res = (await redisConnection.eval(
      RATE_LIMIT_LUA_SCRIPT,
      2,
      senderKey,
      globalKey,
      senderLimit,
      globalLimit,
      windowTTL
    )) as [number, number, string];

    const [allowedNum, currentCount, reasonStr] = res;
    const allowed = allowedNum === 1;

    return {
      allowed,
      currentCount,
      reason: reasonStr as any,
      window,
    };
  } catch (err: any) {
    console.error('[RateLimiter Lua Error]', err.message);
    // On Redis error, allow conservative fallback or rethrow
    throw err;
  }
}

/**
 * Checks if a rate-limit alert has already been sent for this sender & window.
 * Returns true if this is the FIRST notification (caller should send Slack message).
 */
export async function markSlackNotificationSent(
  senderId: string,
  window: string
): Promise<boolean> {
  const notifyKey = `rl:notified:${senderId}:${window}`;
  // SET key value EX 7200 NX returns "OK" if key was set, null if already exists
  const result = await redisConnection.set(notifyKey, '1', 'EX', 7200, 'NX');
  return result === 'OK';
}

export function getHourWindowKey(senderId: string, window = getCurrentHourWindow()): string {
  return `rl:${senderId}:${window}`;
}

export const evaluateRateLimit = checkAndIncrementRateLimit;
