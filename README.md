# ReachInbox Email Scheduler

Full-stack email scheduling service and dashboard built with Node.js, Express, BullMQ, Redis, PostgreSQL, and Next.js.

The project handles delayed email dispatching without cron jobs, preserves state across server restarts, enforces atomic rate limits across concurrent workers using Redis Lua scripts, and sends Slack notifications when hourly limits are reached.

---

## Architecture

```
+-------------------------------------------------------------+
|                     Next.js Frontend                        |
|       (Scheduled / Sent tabs, Compose modal, Slack auth)    |
+------------------------------+------------------------------+
                               | HTTP (Port 3000 -> 5000)
                               v
+-------------------------------------------------------------+
|                     Express API Layer                       |
|   /api/auth   /api/campaigns   /api/emails   /api/slack     |
+---------------+------------------------------+--------------+
                | 1. Write DB record           | 2. Enqueue delayed job
                v                              v
+-------------------------------+ +---------------------------+
|          PostgreSQL           | |    BullMQ Delayed Queue   |
|   (Campaigns & EmailJobs)     | |  (jobId: emailjob_<id>)   |
+-------------------------------+ +-------------+-------------+
                                                | Worker pop
                                                v
                                  +---------------------------+
                                  |       BullMQ Worker       |
                                  |   (Concurrency: 5)        |
                                  +-------------+-------------+
                                                |
                 +------------------------------+------------------------------+
                 v                              v                              v
    +--------------------------+   +--------------------------+   +--------------------------+
    |  Redis Lua Rate Limiter  |   |   Nodemailer + Ethereal  |   |  Elasticsearch Indexing  |
    |  (rl:<sender>:<window>)  |   |  (Generates preview URL) |   |  (Fallback to PostgreSQL)|
    +--------------------------+   +--------------------------+   +--------------------------+
```

### 1. Scheduling Without Cron
- No cron packages (`node-cron`, `agenda`, `cron`, etc.) or OS cron jobs are used.
- BullMQ delayed jobs store tasks in a Redis Sorted Set (`ZSET`) keyed by millisecond Unix timestamps.
- When an email is scheduled, its delay is computed as `Math.max(0, scheduledFor - Date.now()) + (index * interSendDelay)`.
- Redis tracks the timer internally, so the application does not poll the database.
- Deterministic job IDs (`emailjob_${emailJob.id}`) prevent duplicate queue entries.

### 2. Restart Persistence and Crash Recovery
- Email records are written to PostgreSQL before any job is added to BullMQ.
- If the node process crashes while jobs are waiting in the queue, Redis retains the delayed jobs and continues dispatching them when the worker comes back online.
- On startup, `reconcileDatabaseAndRedis()` runs two recovery checks:
  1. Finds any jobs stuck in `processing` status from a crashed worker and moves them back to `scheduled`.
  2. Queries PostgreSQL for any `scheduled` or `rescheduled` records whose corresponding BullMQ job ID is missing from Redis, and re-adds them with their remaining delay.
  3. Jobs that already exist in Redis or are already marked `sent` are ignored to preserve idempotency.

### 3. Rate Limiting and Concurrency
- Workers run with a default concurrency of 5 parallel jobs.
- Rate limits are tracked in Redis by sender and current UTC hour (`rl:<senderId>:<YYYY-MM-DD-HH>`).
- To avoid race conditions between parallel workers, counter checks and increments run inside an atomic Redis Lua script:
  - If `currentCount >= limit`, the script returns `0` without incrementing.
  - If under the limit, it increments the counter, sets a 2-hour TTL on the first write, and returns `1`.
- When an email exceeds the limit:
  1. It is not marked as failed. The system calculates the start of the next UTC hour window (`getNextHourWindowDate()`).
  2. The job is rescheduled in BullMQ for that future timestamp, preserving queue order.
  3. The database record is updated to `status = 'rescheduled'`.
  4. A deduplicated Slack alert is dispatched (maximum 1 notification per sender per hourly window).

---

## Feature Mapping

### Backend
- **Scheduler**: BullMQ delayed queue with deterministic job IDs (`backend/src/queues/emailQueue.ts`).
- **Persistence**: Database state machine + startup reconciliation service (`backend/src/services/reconciliationService.ts`).
- **Rate Limiting**: Atomic Redis Lua script with next-window deferral (`backend/src/workers/rateLimiter.ts`).
- **Concurrency & Pacing**: Configurable worker concurrency (`WORKER_CONCURRENCY`) and inter-send delay (`MIN_DELAY_BETWEEN_SENDS_MS`) in `backend/src/workers/emailWorker.ts`.
- **Idempotency**: Atomic SQL conditional transition (`UPDATE WHERE status IN ('scheduled', 'rescheduled')`) in `backend/src/workers/emailProcessor.ts`.
- **Ethereal Mailer**: Nodemailer transport sending through Ethereal SMTP with logged preview URLs (`backend/src/services/mailerService.ts`).
- **Slack Alerts**: OAuth v2 connect flow + rate-limit alert blocks (`backend/src/services/slackService.ts`).
- **Search**: Elasticsearch document indexing with PostgreSQL query fallback (`backend/src/services/elasticsearchService.ts`).
- **Queue Monitor**: Bull Board interface mounted at `/admin/queues` (`backend/src/queues/queueDashboard.ts`).

### Frontend
- **Auth**: Google OAuth via Google Identity Services (`frontend/src/app/login/page.tsx`) with a local dev demo bypass.
- **Dashboard**: Status counters, search bar, and navigation sidebar (`frontend/src/app/dashboard/page.tsx`).
- **Scheduled Table**: Relative countdown badges (`due now`, `in 15m`, `in 2 hr`), bulk selection checkboxes, and recipient details (`frontend/src/components/ScheduledTable.tsx`).
- **Sent Table**: Delivery timestamps, status indicators, and links to Ethereal web inbox previews (`frontend/src/components/SentTable.tsx`).
- **Compose Modal**: Sender selection, recipient entry, subject, body, and date-time picker (`frontend/src/components/ComposeModal.tsx`).
- **UI Styling**: Tailwind CSS styling with custom brand design tokens (`#00A343`, `#E8F5E9`, `#FEF3C7`).

---

## Live Deployment

- **Live Web Application (Frontend)**: [https://reach-inbox-hiring-assignment-full-brown.vercel.app](https://reach-inbox-hiring-assignment-full-brown.vercel.app)
- **Live Queue Dashboard (Bull Board)**: [https://reachinbox-scheduler-api-19at.onrender.com/admin/queues](https://reachinbox-scheduler-api-19at.onrender.com/admin/queues)
- **Live Backend API**: [https://reachinbox-scheduler-api-19at.onrender.com/api](https://reachinbox-scheduler-api-19at.onrender.com/api)

---

## Setup and Running

### Prerequisites
- Node.js 18 or later
- Redis instance (local or hosted, e.g. Upstash)
- PostgreSQL database (local or hosted, e.g. Neon)

### Environment Variables

Create `.env` in root and `backend/.env`:

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"

# Redis
REDIS_URL="redis://localhost:6379"

# Elasticsearch (optional, defaults to DB search if offline)
ELASTICSEARCH_NODE="http://localhost:9200"

# Queue / Worker Settings
WORKER_CONCURRENCY=5
MIN_DELAY_BETWEEN_SENDS_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=200
MAX_EMAILS_PER_HOUR=1000

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
JWT_SECRET="your-jwt-secret-key"

# Slack OAuth
SLACK_CLIENT_ID="your-slack-client-id"
SLACK_CLIENT_SECRET="your-slack-client-secret"
SLACK_REDIRECT_URI="http://localhost:5000/api/slack/oauth/callback"

# Ports
PORT=5000
FRONTEND_PORT=3000
NEXT_PUBLIC_API_URL="http://localhost:5000"
```

In `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
```

### Ethereal Setup
Ethereal provides mock SMTP accounts for development and automated testing.
- Default test senders are automatically provisioned on server startup via `ensureDefaultSenders()`.
- Alternatively, custom credentials can be created at https://ethereal.email/create and added to the `Sender` table.
- Sent emails generate preview URLs accessible directly through the web dashboard.

### Running Locally

```bash
# Install dependencies
npm install

# Run database push and Prisma client generation
cd backend
npx prisma db push
cd ..

# Start backend and frontend concurrently
npm run dev
```

Local Endpoints:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Queue Dashboard: http://localhost:5000/admin/queues

---

## Invariant Tests

Run the test suite to verify queue scheduling, idempotency guards, and rate limiter logic:

```bash
cd backend
npm test
```
