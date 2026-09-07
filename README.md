# ReachInbox Email Job Scheduler — Full-Stack Monorepo

A robust, enterprise-grade distributed email scheduler service and web dashboard built for high-throughput outreach. Features zero-cron BullMQ delayed queues, cross-worker atomic rate limiting via Redis Lua scripts, PostgreSQL state persistence with boot-time crash reconciliation, Nodemailer with live Ethereal inbox previews, Elasticsearch full-text indexing, Slack OAuth v2 rate-limit alerts, Google OAuth v2 authentication, and a Next.js 14 dashboard faithfully matching the Outbox Labs Figma specification.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                 Next.js 14 Dashboard UI                     │
│     (Tabs: Scheduled / Sent, Compose Modal, Slack Sync)     │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON (Port 3000 -> 5000)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express.js API Layer                     │
│   /api/auth   /api/campaigns   /api/emails   /api/slack     │
└───────────────┬──────────────────────────────┬──────────────┘
                │ 1. Atomic DB Write           │ 2. Deterministic Enqueue
                ▼                              ▼
┌───────────────────────────────┐ ┌───────────────────────────┐
│     PostgreSQL + Prisma       │ │   BullMQ Delayed Queue    │
│  (User, Campaign, EmailJob)   │ │  (jobId: emailjob_<id>)   │
└───────────────────────────────┘ └─────────────┬─────────────┘
                                                │ Worker Pull
                                                ▼
                                  ┌───────────────────────────┐
                                  │   BullMQ Worker Service   │
                                  │  (Concurrency: env var)   │
                                  └─────────────┬─────────────┘
                                                │
                 ┌──────────────────────────────┼──────────────────────────────┐
                 ▼                              ▼                              ▼
    ┌──────────────────────────┐   ┌──────────────────────────┐   ┌──────────────────────────┐
    │  Atomic Redis Rate Limit │   │   Nodemailer + Ethereal  │   │  Elasticsearch Indexing  │
    │  (rl:<sender>:<window>)  │   │  (Preview URL Logging)   │   │  (/api/emails/search)    │
    └──────────────────────────┘   └──────────────────────────┘   └──────────────────────────┘
```

### 1. How Scheduling Works (Strictly Zero Cron)
- **No Cron Jobs**: No OS-level cron (`crontab`) or Node cron libraries (`node-cron`, `agenda`, `bree`, `node-schedule`).
- **BullMQ Delayed Queues**: When a campaign or batch of emails is scheduled, each email is enqueued into BullMQ with a calculated delay:
  $$\text{delay} = \max(0, \text{scheduledFor} - \text{now}) + (\text{index} \times \text{interSendDelay})$$
- **Redis Sorted Sets**: Redis stores delayed jobs in a sorted set (`ZSET`) where scores are millisecond epoch timestamps. Redis sleeps until the earliest timestamp arrives, eliminating periodic database polling and index thrashing.
- **Deterministic Job IDs**: Each BullMQ job is assigned a deterministic ID: `emailjob_${emailJob.id}`. If the same job is submitted repeatedly, BullMQ deduplicates it directly at the Redis level.

### 2. How Persistence on Restart is Handled
- **Dual-Layer Durability**: PostgreSQL acts as the source of truth, while Redis maintains the active job state machine.
- **PostgreSQL-First Insertion**: When scheduling an outreach batch, all records are written to PostgreSQL in `scheduled` status before enqueuing into BullMQ. If a network blip or crash interrupts enqueuing, the records remain safely persisted in the database.
- **Boot-Time DB $\leftrightarrow$ Redis Reconciliation (`reconcileDatabaseAndRedis`)**:
  Whenever the backend server/worker boots or recovers from a crash:
  1. **Orphan Recovery**: Identifies any jobs left in `processing` status (caused by ungraceful worker termination mid-send) and safely resets them to `scheduled`.
  2. **Redis Scan**: Queries PostgreSQL for all `scheduled` or `rescheduled` jobs and verifies whether their deterministic job ID exists in Redis.
  3. **Auto-Re-enqueue**: If a job is missing from Redis (e.g., Redis restart without AOF/RDB persistence), it calculates the remaining delay ($\max(0, \text{scheduledFor} - \text{now})$) and re-enqueues it.
  4. **Idempotent Skip**: Jobs already in Redis or already marked `sent` are never duplicated.

### 3. How Rate Limiting & Concurrency are Implemented
- **Multi-Worker Concurrency**: The worker runs with configurable concurrency (`WORKER_CONCURRENCY=5`), allowing parallel execution across multiple threads/processes without database deadlocks.
- **Atomic Redis Lua Script**: To prevent race conditions across concurrent workers, rate limit increments are executed atomically via a Redis Lua script:
  ```lua
  local senderKey = KEYS[1]
  local senderLimit = tonumber(ARGV[1])
  local current = tonumber(redis.call('GET', senderKey) or '0')
  if current >= senderLimit then
      return {0, current, 'SENDER_LIMIT'}
  end
  local newVal = redis.call('INCR', senderKey)
  if newVal == 1 then
      redis.call('EXPIRE', senderKey, tonumber(ARGV[3]))
  end
  return {1, newVal, 'OK'}
  ```
- **Order-Preserving Next-Hour Rescheduling**: When a sender hits their hourly quota (e.g., 200 emails/hour):
  1. The job is **not dropped or failed**.
  2. The worker calculates the start of the next UTC hour window (`getNextHourWindowDate()`).
  3. The job is rescheduled in BullMQ for that exact time, preserving the queue sequence.
  4. The job status updates to `rescheduled` in PostgreSQL.
  5. A real Slack alert card is dispatched to the connected Slack workspace (deduplicated so only 1 alert is sent per sender per hourly window).

---

## 📋 Features Implemented & Mapped

### Backend Architecture
| Feature | Implementation | File Reference |
| :--- | :--- | :--- |
| **Email Scheduler** | BullMQ delayed queue with deterministic job IDs (`emailjob_${id}`) | [`backend/src/queues/emailQueue.ts`](file:///backend/src/queues/emailQueue.ts) |
| **Restart Persistence** | Dual-write DB + boot-time reconciliation engine | [`backend/src/services/reconciliationService.ts`](file:///backend/src/services/reconciliationService.ts) |
| **Atomic Rate Limiter** | Redis Lua script with UTC hourly windows & order-preserving rescheduling | [`backend/src/workers/rateLimiter.ts`](file:///backend/src/workers/rateLimiter.ts) |
| **Worker Concurrency** | Configurable worker concurrency + minimum inter-send delay (2s) | [`backend/src/workers/emailWorker.ts`](file:///backend/src/workers/emailWorker.ts) |
| **Idempotency Guard** | Conditional atomic SQL transitions (`scheduled` $\rightarrow$ `processing`) | [`backend/src/workers/emailProcessor.ts`](file:///backend/src/workers/emailProcessor.ts) |
| **Ethereal Mailer** | Nodemailer with automatic Ethereal test inbox provisioning & preview URLs | [`backend/src/services/mailerService.ts`](file:///backend/src/services/mailerService.ts) |
| **Slack OAuth v2** | Live OAuth flow with rich Block Kit alert notifications on rate limit | [`backend/src/services/slackService.ts`](file:///backend/src/services/slackService.ts) |
| **Elasticsearch** | Email document indexing + full-text search with automatic PostgreSQL fallback | [`backend/src/services/elasticsearchService.ts`](file:///backend/src/services/elasticsearchService.ts) |
| **Queue Admin UI** | Integrated `@bull-board/express` dashboard mounted at `/admin/queues` | [`backend/src/queues/queueDashboard.ts`](file:///backend/src/queues/queueDashboard.ts) |

### Frontend UI (Outbox Labs Figma Specification)
| Feature | Implementation | File Reference |
| :--- | :--- | :--- |
| **Authentication** | Google OAuth v2 (Google Identity Services SDK) + Demo Login mode | [`frontend/src/app/login/page.tsx`](file:///frontend/src/app/login/page.tsx) |
| **Dashboard Layout** | Navigation sidebar, metric counters, and status tabs | [`frontend/src/app/dashboard/page.tsx`](file:///frontend/src/app/dashboard/page.tsx) |
| **Scheduled Table** | Checkbox selection, recipient, subject snippet, and dynamic countdown badges (`due now`, `in 15m`, `in 2 hr`) | [`frontend/src/components/ScheduledTable.tsx`](file:///frontend/src/components/ScheduledTable.tsx) |
| **Sent Table** | Real delivery timestamps, status pill (`#00A343`), and clickable Ethereal preview links | [`frontend/src/components/SentTable.tsx`](file:///frontend/src/components/SentTable.tsx) |
| **Compose Modal** | Recipient input, sender selector, rich subject/body editor, and date-time picker | [`frontend/src/components/ComposeModal.tsx`](file:///frontend/src/components/ComposeModal.tsx) |
| **Search Bar** | Instant full-text search across recipients, subjects, and email bodies | [`frontend/src/app/dashboard/page.tsx`](file:///frontend/src/app/dashboard/page.tsx) |
| **Design Tokens** | Figma primary green (`#00A343`), soft green (`#E8F5E9`), amber badge (`#FEF3C7`) | [`frontend/tailwind.config.js`](file:///frontend/tailwind.config.js) |

---

## ⚙️ Environment Variables & Configuration

Create a `.env` file in the root directory (and `backend/.env`):

```env
# Database (PostgreSQL via Prisma)
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"

# Redis (BullMQ + Atomic Rate Limiter)
REDIS_URL="redis://localhost:6379"

# Elasticsearch (Optional: falls back to PostgreSQL if offline)
ELASTICSEARCH_NODE="http://localhost:9200"

# Queue & Worker Settings
WORKER_CONCURRENCY=5
MIN_DELAY_BETWEEN_SENDS_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=200
MAX_EMAILS_PER_HOUR=1000

# Authentication (Google OAuth v2)
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
JWT_SECRET="your-jwt-secret-key"

# Slack OAuth v2 & Alerts
SLACK_CLIENT_ID="your-slack-client-id"
SLACK_CLIENT_SECRET="your-slack-client-secret"
SLACK_REDIRECT_URI="http://localhost:5000/api/slack/oauth/callback"

# Server Ports
PORT=5000
FRONTEND_PORT=3000
NEXT_PUBLIC_API_URL="http://localhost:5000"
```

In `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
```

---

## 📧 How to Set Up Ethereal Email

Ethereal is a fake SMTP service for testing email delivery with web viewable inboxes:

1. **Automatic Provisioning**:
   The backend automatically seeds verified Ethereal accounts into PostgreSQL upon initial database setup via `backend/src/scripts/seedSenders.ts`.
2. **Manual Account Creation**:
   To generate your own credentials:
   - Visit **[https://ethereal.email/create](https://ethereal.email/create)** to generate a test inbox.
   - Insert the credentials into the PostgreSQL `Sender` table:
     ```bash
     npx tsx backend/src/scripts/seedSenders.ts
     ```
3. **Viewing Sent Emails**:
   When an email is sent, the worker logs the generated web preview URL in the console and saves it to the database:
   ```text
   [Worker Success] EmailJob clxxx sent. Preview: https://ethereal.email/message/WaQKMgK...
   ```
   In the frontend **Sent** tab, click any sent email to open the Ethereal web inbox directly.

---

## 🚀 How to Run the Project

### 1. Prerequisites
- Node.js >= 18
- Docker (optional, for local PostgreSQL/Redis/Elasticsearch) or Cloud services (e.g. Neon PostgreSQL, Upstash Redis)

### 2. Start Infrastructure (Docker Compose)
If running locally with Docker:
```bash
docker compose up -d
```
This boots:
- PostgreSQL on port `5432`
- Redis on port `6379`
- Elasticsearch on port `9200`

### 3. Database Migration & Prisma Client
```bash
cd backend
npx prisma generate
npx prisma db push
cd ..
```

### 4. Run Backend & Frontend Concurrently
From the root repository:
```bash
# Starts Express API + BullMQ Worker on port 5000, and Next.js on port 3000
npm run dev
```

Or run them individually in separate terminals:

**Backend (Express API + BullMQ Worker + Queue Dashboard):**
```bash
cd backend
npm run dev
# Server listens at http://localhost:5000
# BullMQ Dashboard available at http://localhost:5000/admin/queues
```

**Frontend (Next.js 14 App Router):**
```bash
cd frontend
npm run dev
# Dashboard accessible at http://localhost:3000
```

---

## 🧪 Verification & Invariant Testing

A comprehensive verification suite is included to validate all core assignment invariants:

```bash
# Run invariant test suite
cd backend
npm test
```

Tests executed and verified:
1. **Queue Enqueuing**: BullMQ delayed scheduling without cron.
2. **Order-Preserving Rate Limiter**: Redis Lua script limits and defers overflow to next UTC window.
3. **Strict Idempotency**: Duplicate job submissions and parallel worker claims are rejected.
4. **Boot-Time Reconciliation**: Orphaned jobs and missing Redis entries are restored on startup.
5. **Ethereal Delivery**: Real SMTP handshake and live preview link generation.
6. **Slack Alert Dispatch**: Block Kit alert cards triggered on quota limits.

---

## 🛡️ License

MIT License. Designed and built by Vishesh.
