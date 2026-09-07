import Redis, { RedisOptions } from 'ioredis';
import { env } from './env.js';

const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 3000);
    return delay;
  },
};

export const redisConnection = new Redis(env.REDIS_URL, redisOptions);

redisConnection.on('connect', () => {
  console.log('[Redis] Connected successfully');
});

redisConnection.on('error', (err) => {
  console.error('[Redis Error]', err.message);
});

export const createRedisClient = () => new Redis(env.REDIS_URL, redisOptions);
