# Architecture Overview & Engineering Constraints

## Problem Context
The BSE Trades Dashboard technical assessment involves fetching trades from a simulated external BSE endpoint (`GET /getTrades`) which experiences configurable pull delays of up to 15 minutes.

### Key Engineering Constraints
- **Network Timeout**: Network intermediaries terminate HTTP connections open longer than 30 seconds.
- **Long-running Pull**: The BSE pull operation may take up to 15 minutes.
- **Instant Dashboard**: The dashboard must open instantly and display trades already pulled even while a new background pull is in progress.
- **Real-Time Push**: Newly pulled trades must automatically appear on open dashboards without page refreshes, polling loops, or cron jobs.

---

## Architectural Data Flow & Real-Time Push Engine

```
┌────────────────────────────────────────────────────────┐
│                   React Dashboard                      │
│     (Opens instantly, renders SQLite initial trades)   │
└───────────┬────────────────────────────────▲───────────┘
            │                                │
            │ 1. POST /pull                  │ 5. Real-Time Push Events
            │    (Returns 202 in <5ms)       │    - pull:started
            ▼                                │    - trades:new (3500 trades)
┌───────────────────────────────┐            │    - pull:completed
│       Express API Layer       │            │
└───────────┬───────────────────┘            │
            │ 2. Dispatches async job        │
            ▼                                │
┌────────────────────────────────────────────┴───────────┐
│     Background Pull Manager & Socket.IO Server         │
└───────────┬────────────────────────────────────────────┘
            │ 3. Fetches trades (simulates up to 15 min delay)
            ▼
┌───────────────────────────────┐
│         Mock BSE API          │
│        (GET /getTrades)       │
└───────────┬───────────────────┘
            │ 4. 4,000 trades returned
            ▼
┌───────────────────────────────┐
│       Trade Repository        │
│   (Atomic batch insert &      │
│    duplicate resolution)      │
└───────────┬───────────────────┘
            ▼
┌───────────────────────────────┐
│    SQLite Storage (trades.db) │
└───────────────────────────────┘
```

### Event Catalog & Payload Specifications

| Event Name | Trigger Stage | Payload Structure |
| :--- | :--- | :--- |
| `pull:started` | Background pull dispatched | `{ jobId, status: "running", startedAt }` |
| `trades:new` | After database persistence commits newly inserted rows | `{ jobId, count, trades: [...] }` *(only new trades, no duplicates)* |
| `pull:completed` | Ingestion finished and metrics updated | `{ jobId, status: "completed", totalFetched, insertedCount, duplicateCount, completedAt }` |
| `pull:failed` | Upstream failure / timeout | `{ jobId, status: "failed", error }` |

---

## Architectural Separation of Concerns

1. **REST Endpoints (`GET /trades`)**: Used strictly for initial, factual reads and historical pagination upon dashboard mount.
2. **Background Ingestion (`POST /pull`)**: Asynchronously pulls from slow upstream BSE without holding HTTP client connections open (< 5 ms response).
3. **Socket.IO Event Stream**: Pushes newly ingested trade data directly to active dashboard sessions immediately upon database commit.
4. **React Local State (`App.jsx`)**: Merges newly arrived trades by `tradeId` into the local collection in descending timestamp order, eliminating duplicate UI rows.
5. **No Polling Guarantee**: No `setInterval`, no recursive `setTimeout`, no frontend polling loop, and no cron scheduler.

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
- **Phase 5A: Backend Real-Time Event Layer (Socket.IO)** (Completed ✅)
  - Socket.IO server attached to Node.js HTTP server.
  - Push events: `pull:started`, `trades:new` (with only newly inserted records), `pull:completed`, `pull:failed`.
  - Repository enhanced to capture newly inserted records in a single transactional batch.
- **Phase 5B: Live Trades Dashboard Frontend** (Completed ✅)
  - React dashboard consuming WebSocket events to dynamically append trades without page refresh.
  - Interactive controls with search, symbol filters, paginated grid, stats cards, and real-time alerts.
  - 100% verified zero-polling, non-blocking real-time streaming flow.
