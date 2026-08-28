/**
 * CORS Configuration Module
 * Standardized origin validation shared between Express REST and Socket.IO.
 * Supports environment-configured origins (CLIENT_ORIGIN / CLIENT_ORIGINS)
 * and safe local development origins (ports 5173, 5174).
 */

const DEFAULT_LOCAL_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174'
];

/**
 * Resolves the list of allowed origins.
 * @returns {Array<string>}
 */
function getAllowedOrigins() {
  const envOrigins = process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN;
  if (envOrigins) {
    const list = envOrigins.split(',').map((o) => o.trim()).filter(Boolean);
    // In development mode, include standard local Vite ports alongside configured origins
    if (process.env.NODE_ENV !== 'production') {
      return Array.from(new Set([...list, ...DEFAULT_LOCAL_ORIGINS]));
    }
    return list;
  }
  return DEFAULT_LOCAL_ORIGINS;
}

/**
 * Validates whether an incoming request Origin is permitted.
 * @param {string|undefined} origin
 * @param {Function} callback (err, allowed)
 */
function corsOriginValidator(origin, callback) {
  // Allow non-browser requests (e.g. server-to-server, curl, test scripts)
  if (!origin) {
    return callback(null, true);
  }

  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  return callback(new Error(`CORS policy: Origin ${origin} is not allowed`));
}

const corsOptions = {
  origin: corsOriginValidator,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
};

module.exports = {
  getAllowedOrigins,
  corsOriginValidator,
  corsOptions
};
