/**
 * WebSocket Event Name Definitions
 * Provides centralized event constants used across the server and clients.
 */

const EVENTS = {
  PULL_STARTED: 'pull:started',
  PULL_COMPLETED: 'pull:completed',
  PULL_FAILED: 'pull:failed',
  TRADES_NEW: 'trades:new'
};

module.exports = EVENTS;
