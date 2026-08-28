# BSE Trades Dashboard

Real-time Indian equity market trade ingestion dashboard demonstrating asynchronous background pull handling for long-running upstream fetches with real-time push streaming over WebSockets.

---

## Problem Statement

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                             THE CORE CHALLENGE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Upstream BSE Ingestion Latency : Can take up to 15 minutes to pull.     │
│  2. Network Gateway Constraint     : Drops HTTP connections open > 30s.     │
│  3. Business Requirement           : Open dashboards must update dynamically│
│                                      with ZERO polling and ZERO page reload.│
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Long-Running Pull**: Upstream BSE data fetches may take up to 15 minutes to generate and return several thousand trade records.
- **Network Constraint**: Network proxies, load balancers, and gateways terminate HTTP connections held open for longer than 30 seconds.
- **Requirement**: The client must never hold a synchronous HTTP request open while waiting for the full BSE pull, and open dashboards must automatically receive newly pulled trades without manual page refreshes or client-side polling loops.

---

## Architectural Solution Overview

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                DECOUPLED ASYNC INGESTION FLOW                                │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

  [ 1. User Click ] ──► POST /pull ──► [ Express API ] ──► Immediate HTTP 202 Accepted (< 5 ms)
                                              │                               │
                                              ▼                               ▼
                                   [ Concurrency Lock ]             [ Client Free / No Timeout ]
                                              │
                                              ▼
                                 [ Background Pull Manager ]
                                              │
                                              ├──────► Emits "pull:started" ──► [ Socket.IO ]
                                              ▼                                       │
                                   [ Mock BSE API (Slow) ]                            │
                                 (Simulates up to 15 mins)                            │
                                              │                                       │
                                              ▼ (4,000 Records)                       │
                                   [ Trade Repository ]                               │
                                              │                                       │
                                              ▼ (Atomic Batch)                        │
                                   [ SQLite Persistence ]                             ▼
                                 (INSERT OR IGNORE dedupe)                    [ Connected Clients ]
                                              │                                       ▲
                                              ▼                                       │
                                  [ Push Newly Inserted ] ──► "trades:new" ───────────┤
                                  [ Push Job Completion ] ──► "pull:completed" ───────┘
```

---

## Key Features

- **Instant Initial Render**: Reads already-persisted SQLite records (`GET /trades`) immediately on page mount (< 10 ms).
- **Asynchronous Background Pull**: `POST /pull` returns HTTP 202 in milliseconds while upstream fetching proceeds in the background.
- **SQLite Persistence**: Embedded storage with unique constraints on `tradeId` and transactional conflict resolution.
- **Real-Time Push Updates**: Socket.IO broadcasts `trades:new` and `pull:completed` upon database commit.
- **Idempotent Ingestion**: Duplicate trades are safely ignored (`INSERT OR IGNORE`); duplicate-only pulls suppress redundant event emissions.
- **Concurrent Pull Protection**: Active pull concurrency lock returns HTTP 409 Conflict if a second pull is triggered simultaneously.
- **Interactive UI Controls**: Client-side search by Trade ID/Client, Indian stock symbol dropdown filter, and pagination (25/50/100 rows per page).
- **Zero Polling Guarantee**: No `setInterval`, no recursive `setTimeout`, no polling loops, and no cronjob/scheduler infrastructure.

---

## Tech Stack

```text
┌────────────────────────┬─────────────────────────┬─────────────────────────┐
│     FRONTEND LAYER     │      BACKEND LAYER      │    PERSISTENCE LAYER    │
├────────────────────────┼─────────────────────────┼─────────────────────────┤
│ • React 18 SPA         │ • Node.js runtime       │ • SQLite 3              │
│ • Vite 6 Tooling       │ • Express REST API      │ • better-sqlite3 engine │
│ • Socket.IO Client     │ • Socket.IO Server      │ • WAL Mode enabled      │
│ • Tabular Typography   │ • Unified CORS Guard    │ • UNIQUE(tradeId) Index │
└────────────────────────┴─────────────────────────┴─────────────────────────┘
```

---

## System Architecture

### Multi-Tier Architecture Diagram

```mermaid
flowchart TD
    subgraph Client ["🖥️ CLIENT TIER (Browser — Vite Port 5173 / 5174)"]
        direction TB
        UI["📊 React 18 Dashboard UI"]
        Hook["⚡ useTradeSocket Hook"]
        APIClient["🌐 REST Client (api.js)"]
        UI <--> Hook
        UI --> APIClient
    end

    subgraph Gateway ["🚪 GATEWAY & ROUTING TIER (Express Port 5000)"]
        direction TB
        Express["⚙️ Express REST API"]
        SocketServer["📡 Socket.IO WebSocket Server"]
        CORS["🛡️ Shared CORS Origin Validator"]
        APIClient -->|1. GET /trades (Fast Read)| Express
        APIClient -->|2. POST /pull (Immediate 202)| Express
        Hook <-->|Bi-directional WebSocket Stream| SocketServer
        CORS -.-> Express
        CORS -.-> SocketServer
    end

    subgraph Ingestion ["⚡ ASYNCHRONOUS INGESTION ENGINE (In-Process)"]
        direction TB
        PM["🔄 Background Pull Manager"]
        Lock["🔒 Concurrency Lock (HTTP 409)"]
        JobMap["🗂️ In-Memory Job Registry (Map)"]
        Express -->|Trigger Worker| PM
        PM <--> Lock
        PM <--> JobMap
        PM -->|Emit 'pull:started'| SocketServer
        PM -->|Emit 'trades:new' & 'pull:completed'| SocketServer
    end

    subgraph Storage ["💾 PERSISTENCE TIER (Durable Storage)"]
        direction TB
        Repo["📦 Trade Repository"]
        DB[("🗄️ SQLite Database (trades.db)\nWAL Mode • UNIQUE(tradeId)")]
        Express -->|Read Initial 500 Records| Repo
        PM -->|Atomic Batch INSERT OR IGNORE| Repo
        Repo <--> DB
    end

    subgraph Upstream ["📈 UPSTREAM MARKET SIMULATION"]
        direction TB
        BSE["🏢 Mock BSE Provider (GET /getTrades)\nMulberry32 PRNG • 4,000 Deterministic Trades\nConfigurable Delay (0 to 15 mins)"]
        PM -->|Async HTTP Ingestion| BSE
    end
```

---

### Step-by-Step Execution Lifecycle

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: INITIAL PAGE MOUNT (< 10 ms)                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Browser loads React Dashboard.                                           │
│ 2. Issues `GET /trades?limit=50`.                                           │
│ 3. TradeRepository queries SQLite index and returns initial 500 records.    │
│ 4. Socket.IO connection activates -> UI displays "● LIVE Connected".        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: NON-BLOCKING TRIGGER (< 5 ms)                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. User clicks "Start New Pull" -> issues `POST /pull`.                     │
│ 2. PullManager checks `activeJobId`. If busy -> rejects with HTTP 409.      │
│ 3. Acquires lock, registers `jobId`, responds HTTP 202 Accepted in < 5 ms.  │
│ 4. Socket.IO emits `pull:started` to all open dashboards.                  │
│ 5. Client HTTP connection terminates -> 30s timeout risk eliminated!        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: ASYNCHRONOUS UPSTREAM EXTRACTION (Simulates up to 15 mins)        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. PullManager executes background fetch to Mock BSE (`GET /getTrades`).   │
│ 2. Generates 4,000 deterministic seeded records via Mulberry32 PRNG.        │
│ 3. Runs independently in the Node.js event loop without blocking clients.   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: PERSISTENCE & CONFLICT RESOLUTION (Atomic SQLite Batch)            │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. 4,000 trades passed to `TradeRepository.insertTrades()`.                 │
│ 2. Single transaction runs `INSERT OR IGNORE INTO trades ...`.              │
│ 3. 500 existing trades are skipped; 3,500 new trades inserted.              │
│ 4. Transaction commits durably to `trades.db`.                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: REAL-TIME PUSH DELIVERY (Zero Page Refresh / Zero Polling)         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Socket.IO emits `trades:new` with the 3,500 newly inserted trades.       │
│ 2. Socket.IO emits `pull:completed` with exact metrics:                     │
│    - Fetched: 4,000 | Inserted: 3,500 | Duplicates: 500                     │
│ 3. Dashboards dynamically merge new records by `tradeId` (500 -> 4,000).   │
│ 4. Concurrency lock released for future pulls.                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Repository Structure

```text
bse-trades-dashboard/
├── client/              # React + Vite frontend application
│   ├── src/
│   │   ├── components/  # Modular dashboard UI components
│   │   ├── hooks/       # useTradeSocket custom WebSocket hook
│   │   ├── services/    # api.js REST client service
│   │   ├── App.jsx      # Dashboard state and Socket.IO coordinator
│   │   ├── App.css      # Enterprise light theme financial styling
│   │   └── index.css    # Core design tokens and typography
│   ├── .env.example     # Client environment template
│   └── package.json
├── server/              # Node.js + Express backend service
│   ├── src/
│   │   ├── config/      # Shared CORS origin resolution
│   │   ├── controllers/ # Request handlers (health, trades, pull)
│   │   ├── db/          # SQLite connection, schema & trade repository
│   │   ├── routes/      # REST API route definitions
│   │   ├── services/    # Mock BSE simulator & Background Pull Manager
│   │   └── websocket/   # Socket.IO server & event constants
│   ├── test/            # Automated test suites
│   ├── scripts/         # Verification and manual testing scripts
│   ├── .env.example     # Server environment template
│   └── package.json
├── docs/                # Architecture design notes & specifications
│   └── ARCHITECTURE.md
└── README.md            # Main documentation
```

---

## Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher

---

## Setup & Installation

Clone the repository and install dependencies for both backend and frontend:

```bash
git clone https://github.com/aloksinha123/bse-trades-dashboard.git
cd bse-trades-dashboard

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### Environment Configuration

```bash
# In server directory
cp .env.example .env

# In client directory
cp .env.example .env
```

---

## Environment Variables

### Server (`server/.env`)
| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `5000` | HTTP port for Express and Socket.IO server |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed CORS origin for frontend client |
| `CLIENT_ORIGINS` | `http://localhost:5173,http://localhost:5174` | Comma-separated allowed CORS origins |
| `NODE_ENV` | `development` | Application runtime environment |
| `BSE_DELAY_MS` | `5000` | Simulated upstream BSE delay in ms (up to `900000` ms / 15 mins) |
| `DATABASE_PATH` | `./data/trades.db` | Local SQLite database file path |

### Client (`client/.env`)
| Variable | Default | Description |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `http://localhost:5000` | Backend REST API base URL |
| `VITE_SOCKET_URL` | `http://localhost:5000` | Backend Socket.IO server URL |

---

## Running the Project

Run backend and frontend in two separate terminal windows:

### Terminal 1: Start Backend Server
```bash
cd server
npm run dev
```
*Server will start on `http://localhost:5000` (Database auto-initializes with 500 initial records).*

### Terminal 2: Start Frontend Dashboard
```bash
cd client
npm run dev
```
*Vite client will start on `http://localhost:5173` (or `http://localhost:5174`).*

---

## Live Demo Walkthrough

### 1. Initial State & First Pull
1. Open `http://localhost:5173` in your browser.
2. Dashboard opens instantly showing the **500** initially persisted trades.
3. Status badge displays **`● LIVE Connected`**.
4. Click **"Start New Pull"**.
5. HTTP request returns in **< 5 ms** (Button disables, status flips to **`Running`**).
6. BSE pull runs asynchronously in the background.
7. After the configured delay (default 5s), SQLite commits and Socket.IO pushes updates.
8. Dashboard counter updates dynamically from **500 to 4,000 trades without page reload**.
9. Pull Status updates to **`Completed`** with exact metrics:
   - **Fetched**: `4,000`
   - **Inserted (New)**: `3,500`
   - **Duplicates Ignored**: `500`

### 2. Second Pull (Idempotency & Duplicate Protection)
1. Click **"Start New Pull"** a second time.
2. Background ingestion completes with:
   - **Fetched**: `4,000`
   - **Inserted (New)**: `0`
   - **Duplicates Ignored**: `4,000`
3. Total trades remains steady at **4,000**, and no redundant `trades:new` event is broadcast.

---

## API Reference

| Method | Endpoint | Latency | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | `< 2 ms` | Health check endpoint (`{"status": "ok"}`) |
| `GET` | `/trades` | `< 10 ms` | Retrieves persisted trades from SQLite (`limit`, `offset`) |
| `POST` | `/pull` | `< 5 ms` | Triggers background pull; returns HTTP `202 Accepted` + `jobId` |
| `GET` | `/pull/:jobId` | `< 2 ms` | Retrieves in-memory status & metrics for a specific job |
| `GET` | `/pulls` | `< 2 ms` | Returns recent pull job history (newest first) |
| `GET` | `/getTrades` | `0 - 15 min` | Simulated upstream BSE feed (4,000 seeded trades) |

---

## Socket.IO Events

| Event Name | Trigger Condition | Payload Structure |
| :--- | :--- | :--- |
| `pull:started` | Emitted when background job starts | `{"jobId": "pull-...", "status": "running", "startedAt": "..."}` |
| `trades:new` | Emitted after SQLite commits newly inserted rows | `{"jobId": "pull-...", "count": 3500, "trades": [...]}` |
| `pull:completed` | Emitted when ingestion finishes | `{"jobId": "pull-...", "status": "completed", "totalFetched": 4000, "insertedCount": 3500, "duplicateCount": 500, "completedAt": "..."}` |
| `pull:failed` | Emitted on upstream failure | `{"jobId": "pull-...", "status": "failed", "error": "..."}` |

---

## Testing & Build

### Backend Automated Test Suites (29/29 Passing)
```bash
cd server
npm test
```
- `test/mockBse.test.js`: 6 tests (schema, uniqueness, PRNG consistency, delay validation)
- `test/tradeRepository.test.js`: 9 tests (schema, seed, duplicate ignore, batch transactions, pagination, restart)
- `test/pullManager.test.js`: 9 tests (non-blocking < 50 ms, concurrency lock, state transitions, isolation)
- `test/websocket.test.js`: 5 tests (client connection, event ordering, duplicate suppression, failure emissions)

### Frontend Production Build
```bash
cd client
npm run build
```

---

## Design Decisions & Trade-Offs

1. **Decoupled Asynchronous Pull**: Solves the central 30-second network timeout constraint by closing the client HTTP connection in milliseconds while long-running work continues in the background.
2. **SQLite (`better-sqlite3`)**: Chosen for zero-dependency local reproducibility and synchronous C-binding execution with fast WAL mode transactions.
3. **Socket.IO Real-Time Push**: Eliminates frontend polling loops (`setInterval`) and server cron jobs by pushing updates immediately when the database commit occurs.
4. **Scope & Infrastructure Boundary**: Job metadata is managed in an in-memory `Map` within a single Node.js process. Distributed queue systems (Redis, BullMQ, Kafka) were intentionally excluded to keep the implementation self-contained and reproducible without external infrastructure.

---

## Assessment Verification Checklist

- [x] Dashboard opens instantly with persisted trades (< 10 ms).
- [x] Handled 30-second network timeout constraint via decoupled async pull (`POST /pull` < 5 ms).
- [x] No client-facing HTTP connection held open during long BSE pulls.
- [x] Real-time updates delivered via Socket.IO push events.
- [x] Zero polling loops (`setInterval`, recursive `setTimeout`).
- [x] Zero cron jobs or scheduler libraries.
- [x] Idempotent ingestion (duplicate trades safely ignored).
- [x] 409 Conflict protection on concurrent pull requests.

---

## Demo / Video

[Video Walkthrough](https://drive.google.com/file/d/1DYl6abgyGMfJwFbU98n65sa55HeXgPvi/view?usp=sharing)

---

## License

ISC
