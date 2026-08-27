/**
 * Backend REST API Client
 * Provides methods for initial trade fetching and manual pull triggers.
 * No polling loops or repeated status checks are performed here.
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000';

/**
 * Fetches already-persisted trades from SQLite with optional pagination.
 * Used once on initial dashboard load.
 * @param {Object} [params]
 * @param {number} [params.limit=500]
 * @param {number} [params.offset=0]
 * @returns {Promise<{ success: boolean, count: number, total: number, data: Array<Object> }>}
 */
export async function getTrades({ limit = 500, offset = 0 } = {}) {
  const url = `${API_BASE_URL}/trades?limit=${limit}&offset=${offset}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch trades: HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Triggers an asynchronous background BSE pull.
 * Returns immediately in milliseconds with the created jobId.
 * @returns {Promise<{ success: boolean, message: string, job: Object }>}
 */
export async function startPull() {
  const url = `${API_BASE_URL}/pull`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  const data = await response.json();

  if (response.status === 409) {
    const conflictError = new Error(data.error || 'A pull is already in progress.');
    conflictError.status = 409;
    conflictError.activeJobId = data.activeJobId;
    throw conflictError;
  }

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

/**
 * One-time manual status check for a specific job.
 * Note: Real-time updates are pushed via Socket.IO; this function is never polled in a loop.
 * @param {string} jobId
 * @returns {Promise<{ success: boolean, job: Object }>}
 */
export async function getPullStatus(jobId) {
  const url = `${API_BASE_URL}/pull/${jobId}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to get job status: HTTP ${response.status}`);
  }
  return response.json();
}
