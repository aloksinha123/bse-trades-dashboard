# BSE Trades Dashboard

Technical assessment implementation for a real-time BSE Trades Dashboard featuring an asynchronous pull engine to handle long-running data fetches (up to 15 minutes) within strict network timeout constraints (<30 seconds).

---

## 📌 Project Overview
The application connects to a simulated BSE trade endpoint that experiences configurable pull delays (from seconds up to 15 minutes). Because web infrastructure closes HTTP connections open longer than 30 seconds, this project decouples trade fetching into background execution and streams updates to the frontend in real time via WebSockets.

---

## 🏗️ Architecture (High Level)
- **Frontend (`client/`)**: React application powered by Vite, providing instant UI loading and live streaming trade updates.
- **Backend (`server/`)**: Modular Node.js / Express service architected with controllers, routes, services, database/storage layer, and WebSocket streaming capabilities.
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
Run the backend test suite:
```bash
cd server
npm test
```
Executes two comprehensive test suites:
1. **Mock BSE Suite (`test/mockBse.test.js`)**: Schema, 4,000-count generation, 100% `tradeId` uniqueness, PRNG consistency, and delay validation/clamping.
2. **Trade Repository & Persistence Suite (`test/tradeRepository.test.js`)**: Schema migration, initial 500-seed, duplicate insertion prevention, batch transactions, pagination, and persistence across database restarts.

---

## 📡 API Endpoints

### 1. Health Check
`GET /health`

**Response:**
```json
{
  "status": "ok"
}
```

### 2. Persisted Trades (Application Storage)
`GET /trades`

> **Note**: Returns trades already stored in our application's SQLite database. Opens immediately without waiting for any upstream BSE latency. Supports optional pagination parameters `limit` (default: 50, max: 500) and `offset` (default: 0).

**Example Requests:**
```bash
# Default first 50 records
curl http://localhost:5000/trades

# Paginated request
curl "http://localhost:5000/trades?limit=10&offset=0"
```

**Response Format:**
```json
{
  "success": true,
  "count": 10,
  "total": 500,
  "limit": 10,
  "offset": 0,
  "data": [
    {
      "tradeId": "TRD-000500",
      "client": "CLIENT-1010",
      "symbol": "AXISBANK",
      "quantity": 100,
      "price": 1182.33,
      "timestamp": "2026-08-27T15:30:04.000Z",
      "createdAt": "2026-08-27 17:02:14"
    }
  ]
}
```

### 3. Mock BSE Trade Feed (Simulated Upstream)
`GET /getTrades`

> **Note**: This endpoint intentionally simulates a slow upstream BSE API with configurable latency (`BSE_DELAY_MS`). For local testing, keep `BSE_DELAY_MS=5000` (5 seconds).

**Example Request:**
```bash
curl http://localhost:5000/getTrades
```

---

## 📁 Repository Structure
```
bse-trades-dashboard/
├── client/              # React + Vite frontend
├── docs/                # Architecture and design documentation
├── server/              # Express backend
│   ├── data/            # SQLite storage (trades.db)
│   ├── test/            # Automated test suites
│   └── src/
│       ├── controllers/ # Request controllers (health, trades, persistedTrades)
│       ├── db/          # Database connection, schema & repositories
│       ├── routes/      # API Route definitions (health, trades, persistedTrades)
│       ├── services/    # Mock BSE API service & generators
│       ├── websocket/   # WebSocket communication layer (upcoming)
│       ├── app.js       # Express application configuration
│       └── server.js    # Entry point & HTTP listener
├── .env.example         # Root environment example
├── .gitignore           # Git ignore rules
├── package.json         # Monorepo / convenience scripts
└── README.md            # Main project documentation
```
