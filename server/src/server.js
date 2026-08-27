const http = require('http');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = require('./app');
const { initDatabase, closeDatabase } = require('./db/database');
const { initWebSocket, closeWebSocket } = require('./websocket/websocket.server');

const PORT = process.env.PORT || 5000;

// Initialize Database (runs schema creation & initial seed if empty)
initDatabase();

// Create HTTP Server & attach Socket.IO
const server = http.createServer(app);
initWebSocket(server);

server.listen(PORT, () => {
  console.log(`[BSE Trades Server] Server running on http://localhost:${PORT}`);
  console.log(`[BSE Trades Server] Health check available at http://localhost:${PORT}/health`);
  console.log(`[BSE Trades Server] Persisted trades endpoint: http://localhost:${PORT}/trades`);
  console.log(`[BSE Trades Server] WebSocket (Socket.IO) server ready`);
});

// Graceful shutdown handling
const shutdown = async (signal) => {
  console.log(`[BSE Trades Server] ${signal} signal received: closing servers`);
  await closeWebSocket();
  closeDatabase();
  server.close(() => {
    console.log('[BSE Trades Server] HTTP and WebSocket servers closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
