import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from backend or monorepo root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const envSchema = z.object({
  DATABASE_URL: z.string().default('postgresql://reachinbox:reachinbox_password@localhost:5432/reachinbox_db?schema=public'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  ELASTICSEARCH_NODE: z.string().default('http://localhost:9200'),
  WORKER_CONCURRENCY: z.coerce.number().default(5),
  MIN_DELAY_BETWEEN_SENDS_MS: z.coerce.number().default(2000),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().default(200),
  MAX_EMAILS_PER_HOUR: z.coerce.number().default(1000),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  JWT_SECRET: z.string().default('reachinbox_super_secret_jwt_key_2026_production'),
  SLACK_CLIENT_ID: z.string().default(''),
  SLACK_CLIENT_SECRET: z.string().default(''),
  SLACK_REDIRECT_URI: z.string().default('http://localhost:5000/api/slack/oauth/callback'),
  PORT: z.coerce.number().default(5000),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
});

// Updated with Slack OAuth credentials
export const env = envSchema.parse(process.env);
