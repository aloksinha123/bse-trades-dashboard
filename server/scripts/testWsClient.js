/**
 * Manual WebSocket Verification Script
 * Connects a Socket.IO client to http://localhost:5000, triggers POST /pull,
 * and logs real-time push events to console.
 */
const { io } = require('socket.io-client');
const http = require('http');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';

function post(path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `${SERVER_URL}${path}`,
      { method: 'POST' },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body) }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function runManualWebSocketCheck() {
  console.log(`[Manual WS] Connecting to Socket.IO server at ${SERVER_URL}...`);
  const socket = io(SERVER_URL, {
    transports: ['websocket', 'polling']
  });

  socket.on('connect', async () => {
    console.log(`[Manual WS] Connected successfully with socket ID: ${socket.id}`);

    socket.on('pull:started', (data) => {
      console.log(`[Manual WS] pull:started -> Job ID: ${data.jobId} (status: ${data.status})`);
    });

    socket.on('trades:new', (data) => {
      console.log(
        `[Manual WS] trades:new -> Received ${data.count} newly inserted trades! (Sample: ${data.trades[0]?.tradeId} - ${data.trades[0]?.symbol})`
      );
    });

    socket.on('pull:completed', (data) => {
      console.log(
        `[Manual WS] pull:completed -> Fetched: ${data.totalFetched}, Inserted: ${data.insertedCount}, Duplicates: ${data.duplicateCount}`
      );
      console.log('[Manual WS] Real-time event cycle finished successfully! Disconnecting.');
      socket.disconnect();
      process.exit(0);
    });

    socket.on('pull:failed', (data) => {
      console.error(`[Manual WS] pull:failed -> Error: ${data.error}`);
      socket.disconnect();
      process.exit(1);
    });

    console.log('[Manual WS] Triggering POST /pull to initiate background BSE fetch...');
    const t0 = Date.now();
    const pullRes = await post('/pull');
    const t1 = Date.now();
    console.log(`[Manual WS] POST /pull HTTP status: ${pullRes.status} (Response time: ${t1 - t0} ms)`);
    console.log(`[Manual WS] Dispatched Job ID: ${pullRes.data?.job?.jobId}`);
    console.log('[Manual WS] Waiting for background push events from server...');
  });

  socket.on('connect_error', (err) => {
    console.error('[Manual WS] Connection error:', err.message);
    process.exit(1);
  });
}

runManualWebSocketCheck().catch((err) => {
  console.error('[Manual WS] Execution error:', err);
  process.exit(1);
});
