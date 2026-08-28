/**
 * WebSocket Server Module (Socket.IO)
 * Attaches Socket.IO to the Node.js HTTP server, manages client connections,
 * and provides event broadcasting functions with standardized CORS origin validation.
 */
const { Server } = require('socket.io');
const EVENTS = require('./events');
const { corsOriginValidator } = require('../config/cors.config');

let ioInstance = null;

/**
 * Initializes and attaches the Socket.IO server to an existing Node.js HTTP server.
 * @param {import('http').Server} httpServer
 * @param {Object} [options] Custom configuration options
 * @returns {Server}
 */
function initWebSocket(httpServer, options = {}) {
  if (ioInstance) {
    return ioInstance;
  }

  const corsOrigin = options.clientOrigin !== undefined ? options.clientOrigin : corsOriginValidator;

  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true
    },
    ...options.socketOptions
  });

  io.on('connection', (socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(`[WebSocket] Client disconnected: ${socket.id} (${reason})`);
    });

    socket.on('error', (err) => {
      console.error(`[WebSocket] Socket error for ${socket.id}:`, err);
    });
  });

  ioInstance = io;
  return ioInstance;
}

/**
 * Gets the current active Socket.IO server instance.
 * @returns {Server|null}
 */
function getIO() {
  return ioInstance;
}

/**
 * Broadcasts an event and payload to all connected Socket.IO clients.
 * @param {string} event Event name
 * @param {Object} data Event payload
 */
function broadcastEvent(event, data) {
  if (ioInstance) {
    ioInstance.emit(event, data);
  }
}

/**
 * Closes the Socket.IO server cleanly.
 * @returns {Promise<void>}
 */
function closeWebSocket() {
  return new Promise((resolve) => {
    if (ioInstance) {
      ioInstance.close(() => {
        ioInstance = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  initWebSocket,
  getIO,
  broadcastEvent,
  closeWebSocket,
  EVENTS
};
