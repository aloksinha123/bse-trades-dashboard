# Architecture Overview & Engineering Constraints

## Problem Context
The BSE Trades Dashboard technical assessment involves fetching trades from a simulated external BSE endpoint (`GET /getTrades`) which experiences configurable pull delays of up to 15 minutes.

### Key Engineering Constraints
- **Network Timeout**: Network intermediaries terminate HTTP connections open longer than 30 seconds.
- **Long-running Pull**: The BSE pull operation may take up to 15 minutes.
- **Instant Dashboard**: The dashboard must open instantly and display trades already pulled even while a new background pull is in progress.
- **Real-Time Push**: Newly pulled trades must automatically appear without page refreshes, polling loops, or cron jobs.

---

## Architectural Data Flow & Async Ingestion

```
Client / Caller
       │
       │ POST /pull
       ▼
Express API Layer
       │
       ├──────────────► Immediate HTTP 202 Response (< 5 ms)
       │                 { success: true, job: { jobId, status: "running" } }
       │
       └──────────────► Background Pull Manager (In-Process Async Worker)
                              │
                              ▼
                       Mock BSE API (GET /getTrades)
                       (Waits up to 15 mins according to BSE_DELAY_MS)
                              │
                              ▼ (4,000 trades received)
                       Trade Repository
                       (Atomic transactional batch insert & duplicate filter)
                              │
                              ▼
                       SQLite Storage (trades.db)
                              │
                              ▼ (Job completed: insertedCount: 3500, duplicates: 500)
                       In-Memory Job Registry (status: "completed")
```

### Resolving the 15-Minute vs. 30-Second Constraint
By decoupling the pull trigger (`POST /pull`) from the slow upstream BSE fetch, the client connection is closed immediately in **< 5 ms**. The slow upstream operation runs safely in the background inside the Node.js event loop without risking HTTP timeout terminations.

---

## Architectural Separation of Endpoints

| Endpoint | Method | Layer | Purpose | Latency Profile |
| :--- | :--- | :--- | :--- | :--- |
| `/getTrades` | `GET` | Mock Upstream Simulator | Generates 4,000 deterministic seeded records with simulated delay | Configurable (`BSE_DELAY_MS` up to 15 mins) |
| `/trades` | `GET` | Application Persistent Read | Reads already pulled trades from SQLite with pagination | Immediate (< 10 ms) |
| `/pull` | `POST` | Background Pull Engine | Initiates async background ingestion, returns `jobId` | Immediate (< 5 ms) |
| `/pull/:jobId` | `GET` | In-Memory Job Registry | Checks status (`running`, `completed`, `failed`) and metrics | Immediate (< 2 ms) |
| `/pulls` | `GET` | In-Memory Job Registry | Lists recent in-memory pull jobs history | Immediate (< 2 ms) |

> **Single-Process Note**: Job metadata is tracked in an in-memory `Map<jobId, job>` (ephemeral), whereas all trade records are durably stored in SQLite (`trades.db`).

---

## Phased Roadmap
- **Phase 1: Project Setup & Backend Skeleton** (Completed ✅)
  - Modular project structure (client & server).
  - Express server skeleton with `/health` check.
  - Basic Vite + React frontend skeleton.
- **Phase 2: Mock BSE API & Data Seeding** (Completed ✅)
  - 4,000 deterministic seeded trade generator with Mulberry32 PRNG.
  - Configurable artificial delay (`BSE_DELAY_MS`) up to 15 minutes with bounds validation.
- **Phase 3: Persistent Trade Storage** (Completed ✅)
  - SQLite persistent storage with `trades` table and `tradeId` unique constraints.
  - Repository layer with duplicate prevention and transactional batch insertion.
  - Initial 500-record seed representing "already pulled" trades.
  - Fast, paginated `GET /trades` read endpoint.
- **Phase 4: Asynchronous Background Pull Manager** (Completed ✅)
  - In-process background pull manager decoupling long BSE requests from HTTP clients.
  - Immediate `POST /pull` (< 5 ms) returning `jobId`.
  - `GET /pull/:jobId` state tracking (`running`, `completed`, `failed`) and metrics.
  - Single-pull concurrency lock (HTTP 409 Conflict).
- **Phase 5: WebSocket Layer & Real-time Integration** (Upcoming ⏳)
  - Bidirectional communication & push notifications when pull completes.
- **Phase 6: Live Trades Dashboard Frontend** (Upcoming ⏳)
  - Instant loading dashboard with live push updates and status indicators.
