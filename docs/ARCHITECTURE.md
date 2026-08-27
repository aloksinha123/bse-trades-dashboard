# Architecture Overview & Engineering Constraints

## Problem Context
The BSE Trades Dashboard technical assessment involves fetching trades from a simulated external BSE endpoint (`GET /getTrades`) which experiences configurable pull delays of up to 15 minutes.

### Key Engineering Constraints
- **Network Timeout**: Network intermediaries terminate HTTP connections open longer than 30 seconds.
- **Long-running Pull**: The BSE pull operation may take up to 15 minutes.
- **Instant Dashboard**: The dashboard must open instantly and display trades already pulled even while a new background pull is in progress.
- **Real-Time Push**: Newly pulled trades must automatically appear without page refreshes, polling loops, or cron jobs.

---

## Architectural Data Flow

```
[Simulated Upstream]
   Mock BSE API (GET /getTrades, up to 15m delay)
           │
           │ (Async background fetch - Future Phase 4)
           ▼
[Application Layer]
   Background Pull Manager (Decoupled from client HTTP reqs)
           │
           ▼
   Trade Repository (Parameterized SQL, Conflict Resolution)
           │
           ▼
[Storage Layer]
   SQLite Database (trades.db)
   ├── Initial seed: 500 records
   └── Unique tradeId indexing & timestamp ordering
           │
           ├──────────────────────────┐
           ▼                          ▼
   GET /trades (Fast Read)     WebSocket Event Stream (Future Phase 4)
           │                          │
           └──────────┬───────────────┘
                      ▼
[Presentation Layer]
   React Trades Dashboard (Instant open & live push updates)
```

---

## Architectural Separation of Endpoints

| Endpoint | Layer | Purpose | Latency Profile |
| :--- | :--- | :--- | :--- |
| `GET /getTrades` | Mock Upstream Simulator | Generates 4,000 deterministic seeded records with simulated delay | Configurable (`BSE_DELAY_MS` up to 15 mins) |
| `GET /trades` | Application Persistent Read | Reads already pulled trades from SQLite with pagination | Immediate (<10 ms) |

> **Note**: The background pull manager and WebSocket real-time delivery layer are intentionally decoupled and scheduled for subsequent phases.

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
- **Phase 4: Background Pull Manager & WebSocket Integration** (Upcoming ⏳)
  - Asynchronous background worker bypassing the 30-second HTTP timeout.
  - WebSocket/Socket.IO real-time event broadcasting.
- **Phase 5: Trades Dashboard UI** (Upcoming ⏳)
  - Instant loading dashboard with live updates and status indicators.
