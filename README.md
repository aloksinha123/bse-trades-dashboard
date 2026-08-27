# BSE Trades Dashboard

Technical assessment implementation for a real-time BSE Trades Dashboard featuring an asynchronous pull engine to handle long-running data fetches (up to 15 minutes) within strict network timeout constraints (<30 seconds).

---

## 📌 Project Overview
The application connects to a simulated BSE trade endpoint that experiences configurable pull delays (from seconds up to 15 minutes). Because web infrastructure closes HTTP connections open longer than 30 seconds, this project decouples trade fetching into background execution and streams updates to the frontend in real time via WebSockets.

---

## 🏗️ Architecture (High Level)
- **Frontend (`client/`)**: React application powered by Vite, providing instant UI loading and live streaming trade updates.
- **Backend (`server/`)**: Modular Node.js / Express service architected with controllers, routes, services, database/storage layer, and WebSocket streaming capabilities.
- **Documentation (`docs/`)**: Architecture diagrams and design notes.

> **Note**: This assessment is being developed incrementally. Phase 1 establishes the clean project foundation and health verification.

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

## 🩺 Health Endpoint Verification
You can test the server health endpoint:

```bash
# Using curl or browser
curl http://localhost:5000/health
```

**Response:**
```json
{
  "status": "ok"
}
```

---

## 📁 Repository Structure
```
bse-trades-dashboard/
├── client/              # React + Vite frontend
├── docs/                # Architecture and design documentation
├── server/              # Express backend
│   └── src/
│       ├── controllers/ # Request controllers
│       ├── db/          # Storage / Database layer
│       ├── routes/      # API Route definitions
│       ├── services/    # Business logic & background workers
│       ├── websocket/   # WebSocket communication layer
│       ├── app.js       # Express application configuration
│       └── server.js    # Entry point & HTTP listener
├── .env.example         # Root environment example
├── .gitignore           # Git ignore rules
├── package.json         # Monorepo / convenience scripts
└── README.md            # Main project documentation
```
