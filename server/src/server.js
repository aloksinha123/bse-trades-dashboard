const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = require('./app');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`[BSE Trades Server] Server running on http://localhost:${PORT}`);
  console.log(`[BSE Trades Server] Health check available at http://localhost:${PORT}/health`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('[BSE Trades Server] SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('[BSE Trades Server] HTTP server closed');
  });
});

process.on('SIGINT', () => {
  console.log('[BSE Trades Server] SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('[BSE Trades Server] HTTP server closed');
    process.exit(0);
  });
});
