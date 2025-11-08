# VIJ Admin — Open-source error monitoring for JavaScript apps

Self-hosted admin panel for collecting, grouping, and analyzing errors and logs from your frontend or backend using the lightweight `vij-sdk`. Built with Next.js (App Router) and MongoDB.

### What you get
- Real‑time dashboard with trends and breakdowns (severity, environment, origin)
- Log search, filtering, pagination, and details with stack preview
- Automatic error grouping with fingerprints
- Optional AI‑assisted summaries and suggested causes/fixes (Gemini)
- Simple REST API with permissive CORS for easy ingestion

---

## Quick start (self‑host)

### Prerequisites
- Node.js 18+ (or Bun), npm/yarn/pnpm
- MongoDB 6+ (local or Atlas)
- Redis (for rate limiting and dedup windows)

### 1) Configure environment
Set the required environment variables before running the server.

| Name | Required | Example | Purpose |
| --- | --- | --- | --- |
| `MONGODB_URI` | Yes | `mongodb://localhost:27017/vij` | Database connection string |
| `NEXT_PUBLIC_BASE_URL` | Recommended in prod | `https://vij.example.com` | Used by server components to form absolute API URLs |
| `GEMINI_API_KEY` | Optional | `ya29...` | Enables AI summaries in the UI and API |
| `REDIS_URL` | Recommended | `redis://localhost:6379` | Enables rate limiting & ingestion dedup |
| `VIJ_RATE_LIMIT_PER_MIN` | Optional | `100` | Max requests per minute per `appId` |
| `VIJ_DEDUP_WINDOW_MS` | Optional | `5000` | Window for grouping identical errors at ingestion

Examples (macOS/Linux):
```bash
export MONGODB_URI="mongodb://localhost:27017/vij"
# Optional:
export NEXT_PUBLIC_BASE_URL="http://localhost:3000" # In dev environment
export GEMINI_API_KEY="YOUR_KEY"
export REDIS_URL="redis://localhost:6379"
export VIJ_RATE_LIMIT_PER_MIN="100"
export VIJ_DEDUP_WINDOW_MS="5000"
```

### 2) Install and run
From this folder:
```bash
# pick your package manager
npm install
npm run dev
# or: yarn && yarn dev
# or: pnpm install && pnpm dev
# or: bun install && bun dev
```
Open `http://localhost:3000` to access the admin.

### 3) Send your first logs with vij‑sdk
Install the SDK in your app ([vij‑sdk on npm](https://www.npmjs.com/package/vij-sdk)) and point it to this server’s `/api/logs` endpoint.

```ts
import { init, captureException, captureMessage, flush } from "vij-sdk";

init({
  endpoint: "http://localhost:3000/api/logs",
  appId: "demo-app",
  environment: "development", // or "production"
  batch: true,
  flushIntervalMs: 3000,
  maxBatchSize: 20
});

try {
  throw new Error("Simulated crash in signup flow");
} catch (err) {
  captureException(err, { feature: "signup" });
}

captureMessage("User clicked retry", { feature: "signup" }, "info");
await flush();
```

You should see events appear in the dashboard immediately.

---

## Deploy

Any Node host works. For production:
1. Build the app: `npm run build`
2. Ensure envs are set (`MONGODB_URI` required; set `NEXT_PUBLIC_BASE_URL` to your public URL)
3. Start: `npm run start`

On platforms like Vercel, set the same envs in the project settings. AI summaries require `GEMINI_API_KEY` and will gracefully disable if not set.

---

## REST API

- `POST /api/logs` — accepts a single log or a batch
  - Single log shape:
    - `appId` (string, required)
    - `message` (string, required)
    - `stack` (string, optional)
    - `timestamp` (ISO string, optional)
    - `metadata` (object, optional)
    - `severity` (`error` | `warning` | `info`, default `error`)
    - `environment` (`production` | `development`, default `production`)
    - `userAgent` (string, optional)
  - Batch shape:
    - `{ "batch": true, "logs": [<single log> ...] }`
  - Limits: 10KB body, CORS `*`, methods `POST, OPTIONS, GET`
  - Rate limiting: If `REDIS_URL` is configured, requests are limited per `appId` per minute (`VIJ_RATE_LIMIT_PER_MIN`). When exceeded, the API responds `429` with headers:
    - `x-vij-backoff`: seconds to back off (e.g., `10`)
    - `Retry-After`: same as above for generic clients
  - Deduplication: With Redis enabled, identical errors (same fingerprint of `message|stack`) are collapsed within `VIJ_DEDUP_WINDOW_MS`. The server:
    - Always increments the error group's `occurrenceCount` and updates `lastSeen`
    - Inserts at most one `Log` document per dedup window (sampling)
    - Returns headers on success when dedup/sampling occurred:
      - `x-vij-dedup: 1`, `x-vij-sampled: 1`

- `GET /api/logs` — list/search logs
  - Query: `page`, `limit`, `appId`, `severity`, `environment`, `search`, `from`, `to`, `fingerprint`, `origin`

- `GET /api/stats` — aggregates for the dashboard

- `GET /api/groups` — grouped errors
  - Query: `page`, `limit`, `appId`, `severity`, `environment`

---

## How it works
- Ingestion: `/api/logs` validates payloads, fingerprints errors, and writes to MongoDB
- Grouping: errors with same `(message, stack)` hash form a group with an `occurrenceCount` counter
- Rate limiting: implemented via Redis counters per minute, returning `429` with server‑driven backoff headers
- Server‑side dedup: Redis keys collapse identical errors within a sliding window; only one sampled log is stored while the group counter increments
- AI: when `GEMINI_API_KEY` is set, the service fetches a concise summary, suggested causes/fixes, and tags (cached per group)
- UI: Next.js App Router renders a dashboard, charts, groups, and log details

---

## Troubleshooting
- Connection error: verify `MONGODB_URI` and that MongoDB is reachable
- Empty dashboard: send test events with `vij-sdk` and check `/api/logs` for responses
- Mixed local/prod URLs: set `NEXT_PUBLIC_BASE_URL` in production to your public origin
- AI not showing: ensure `GEMINI_API_KEY` is set; otherwise AI features are disabled gracefully

---

## License
MIT
