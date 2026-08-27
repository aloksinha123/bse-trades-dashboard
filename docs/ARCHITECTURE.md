# Architecture Overview & Engineering Constraints

## Problem Context
The BSE Trades Dashboard technical assessment involves fetching trades from a simulated external BSE endpoint (`GET /getTrades`) which may have a configurable delay of up to 15 minutes.

### Key Engineering Constraint
- HTTP connections are terminated by network intermediaries if left open for longer than 30 seconds.
- The BSE pull operation may take up to 15 minutes.
- The dashboard must open instantly, render any existing trades immediately, and display newly pulled trades in real-time without manual page refreshes, polling loops, or cronjobs.

## Architectural Design (Upcoming Phases)
1. **Asynchronous Ingestion Manager**: A background worker pattern that triggers the upstream BSE pull asynchronously without holding open client HTTP connections.
2. **Persistence / Storage Layer**: Efficient in-memory or persisted storage to immediately serve historical trades upon dashboard load.
3. **Real-time Event Push (WebSocket / Socket.IO)**: Pushes trade updates and pull progress directly to connected clients when a background pull finishes.

## Phased Roadmap
- **Phase 1: Project Setup & Backend Skeleton** (Current)
  - Modular project structure (client & server).
  - Express server skeleton with `/health` check.
  - Basic Vite + React frontend skeleton.
- **Phase 2: Mock BSE API & Data Seeding**
  - Configurable trade generation and delay simulation (`GET /getTrades`).
- **Phase 3: Asynchronous Pull Manager & Data Storage**
  - Decoupled pull lifecycle handling the >30s timeout constraint.
- **Phase 4: WebSocket Layer & Real-time Integration**
  - Bidirectional communication for push events.
- **Phase 5: Trades Dashboard Frontend**
  - Instant loading, live updates, status indicators, and responsive UI.
