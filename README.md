# BSE Trades Dashboard

Technical assessment implementation for a real-time BSE Trades Dashboard featuring an asynchronous pull engine to handle long-running data fetches (up to 15 minutes) within strict network timeout constraints (<30 seconds).

---

## 📌 Project Overview
The application connects to a simulated BSE trade endpoint that experiences configurable pull delays (from seconds up to 15 minutes). Because web infrastructure terminates HTTP connections open longer than 30 seconds, this project decouples trade fetching into an in-process background worker and streams updates to the frontend in real time via WebSockets (Socket.IO).

---

## 🏗️ Architecture (High Level)
- **Frontend (`client/`)**: React application powered by Vite, providing instant UI loading and live streaming trade updates.
- **Backend (`server/`)**: Modular Node.js / Express service architected with controllers, routes, services, database/storage layer, and real-time Socket.IO event server.
- **Real-Time WebSocket Layer (`server/src/websocket/`)**: Socket.IO server emitting push events (`pull:started`, `trades:new`, `pull:completed`, `pull:failed`) upon ingestion lifecycle stages.
- **Asynchronous Background Pull Manager (`server/src/services/pullManager.service.js`)**: Decouples long-running BSE pulls from HTTP request lifecycles. Responds immediately (< 5 ms) with `jobId` and processes 4,000-trade batch ingestion in the background.
- **Persistence Layer (`server/src/db/`)**: Embedded SQLite storage (`server/data/trades.db`) maintaining "already pulled" trades with duplicate conflict resolution and pagination.
- **Mock BSE API (`server/src/services/mockBse.service.js`)**: Deterministic 4,000-record Indian market trade generator with configurable artificial delay (`BSE_DELAY_MS`) up to 15 minutes.
- **Documentation (`docs/`)**: Architecture diagrams and design notes.

---

## ⚙️ Prerequisites
- **Node.js**: v18+ (or v20+ recommended)
- **npm**: v9+

---

## 🚀 Quick Start & Installation

### 1. Install all dependencies
From the project root:
```bash
npm run install:all
```
*Or individually:*
```bash
cd server && npm install
cd ../client && npm install
```

### 2. Environment Configuration
Copy `.env.example` in `server/` (and root if needed):
```bash
# In server directory
cp .env.example .env
```

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `5000` | HTTP port for the Express backend server |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed CORS origin for Socket.IO clients |
| `NODE_ENV` | `development` | Application environment mode |
| `BSE_DELAY_MS` | `5000` | Simulated upstream BSE delay in ms (supports up to `900000` ms / 15 mins) |
| `DATABASE_PATH` | `./data/trades.db` | Path to SQLite database file |

---

## 🏃 Running the Application

### Backend Server
```bash
# From root
npm run dev:server

# Or directly in server directory
cd server
npm run dev
```
The server will start on port `5000` (or `PORT` defined in `.env`).

### Frontend Client
```bash
# From root
npm run dev:client

# Or directly in client directory
cd client
npm run dev
```
The Vite dev server will typically be available at `http://localhost:5173`.

---

## 🧪 Automated Testing
Run the complete backend test suite:
```bash
cd server
npm test
```
Executes four comprehensive test suites:
1. **Mock BSE Suite (`test/mockBse.test.js`)**: Schema, 4,000-count generation, 100% `tradeId` uniqueness, PRNG consistency, and delay validation/clamping.
2. **Trade Repository & Persistence Suite (`test/tradeRepository.test.js`)**: Schema migration, initial 500-seed, duplicate insertion prevention, batch transactions, pagination, and persistence across database restarts.
3. **Pull Manager & Ingestion Suite (`test/pullManager.test.js`)**: Non-blocking immediate response (< 50 ms), running-to-completed transitions, 409 concurrency conflict lock, error resilience, and strict database isolation.
4. **WebSocket Real-Time Suite (`test/websocket.test.js`)**: Socket.IO client connections, `pull:started`, `trades:new` (with only newly inserted records), `pull:completed`, and failure event delivery.

---

## 📡 Real-Time WebSocket Events (Socket.IO)

The backend exposes a Socket.IO server on `ws://localhost:5000` (or `http://localhost:5000`).

### Event Catalog

| Event Name | Description | Sample Payload |
| :--- | :--- | :--- |
| `pull:started` | Emitted immediately when background pull begins | `{"jobId": "pull-123", "status": "running", "startedAt": "..."}` |
| `trades:new` | Emitted after trades are persisted to SQLite | `{"jobId": "pull-123", "count": 3500, "trades": [...]}` |
| `pull:completed` | Emitted when pull finishes | `{"jobId": "pull-123", "status": "completed", "totalFetched": 4000, "insertedCount": 3500, "duplicateCount": 500, "completedAt": "..."}` |
| `pull:failed` | Emitted if upstream BSE fails | `{"jobId": "pull-123", "status": "failed", "error": "..."}` |

### Manual Real-Time Verification Script
To test live WebSocket events from console:
```bash
cd server
node scripts/testWsClient.js
```

---

## 📡 REST API Endpoints

### 1. Health Check
`GET /health`

**Response:**
```json
{
  "status": "ok"
}
```

### 2. Trigger Background BSE Pull
`POST /pull`

> **Note**: Dispatches background pull asynchronously and returns HTTP `202 Accepted` immediately in `< 5 ms`. Does NOT block or wait for the slow upstream BSE delay.

**Example Request:**
```bash
curl -X POST http://localhost:5000/pull
```

**Response Format:**
```json
{
  "success": true,
  "message": "Background pull initiated successfully.",
  "job": {
    "jobId": "pull-1787851645607-3hh60q",
    "status": "running",
    "createdAt": "2026-08-27T17:27:25.607Z",
    "startedAt": "2026-08-27T17:27:25.607Z",
    "completedAt": null,
    "totalFetched": 0,
    "insertedCount": 0,
    "duplicateCount": 0,
    "error": null
  }
}
```

### 3. Check Background Pull Job Status
`GET /pull/:jobId`

### 4. Pull History
`GET /pulls` (or `GET /pull`)

### 5. Persisted Trades (Application Storage)
`GET /trades`

> **Note**: Returns trades already stored in our application's SQLite database. Opens immediately without waiting for any upstream BSE latency. Supports optional pagination parameters `limit` (default: 50, max: 500) and `offset` (default: 0).

**Example Requests:**
```bash
# Default first 50 records
curl http://localhost:5000/trades

# Paginated request
curl "http://localhost:5000/trades?limit=10&offset=0"
```

### 6. Mock BSE Trade Feed (Simulated Upstream)
`GET /getTrades`

---

## 📁 Repository Structure
```
bse-trades-dashboard/
├── client/              # React + Vite frontend
├── docs/                # Architecture and design documentation
├── server/              # Express backend
│   ├── data/            # SQLite storage (trades.db)
│   ├── scripts/         # Verification and utility scripts
│   ├── test/            # Automated test suites
│   └── src/
│       ├── controllers/ # Request controllers (health, trades, persistedTrades, pull)
│       ├── db/          # Database connection, schema & repositories
│       ├── routes/      # API Route definitions (health, trades, persistedTrades, pull)
│       ├── services/    # Mock BSE API service & Background Pull Manager
│       ├── websocket/   # WebSocket (Socket.IO) server & event definitions
│       ├── app.js       # Express application configuration
│       └── server.js    # Entry point & HTTP listener with Socket.IO
├── .env.example         # Root environment example
├── .gitignore           # Git ignore rules
├── package.json         # Monorepo / convenience scripts
└── README.md            # Main project documentation
```
