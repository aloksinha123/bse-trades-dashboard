/**
 * Pull Manager Service
 * Manages asynchronous background BSE pull operations decoupled from HTTP request lifecycles.
 * Maintains in-memory job state and ensures single active pull concurrency protection.
 */
const mockBseService = require('./mockBse.service');
const defaultTradeRepository = require('../db/trade.repository');

class PullManagerService {
  constructor() {
    this.jobs = new Map();
    this.activeJobId = null;
  }

  /**
   * Generates a unique Job ID.
   */
  _generateJobId() {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    return `pull-${timestamp}-${randomSuffix}`;
  }

  /**
   * Initiates an asynchronous background pull.
   * Returns immediately after registering the job without waiting for upstream BSE fetch.
   * @param {Object} [options] Custom services / overrides (useful for testing)
   * @returns {{ job: Object }}
   */
  startPull(options = {}) {
    // Concurrency Protection: Check if a pull is already running
    if (this.activeJobId) {
      const activeJob = this.jobs.get(this.activeJobId);
      const error = new Error('A pull is already in progress.');
      error.status = 409;
      error.activeJobId = this.activeJobId;
      error.activeJob = activeJob;
      throw error;
    }

    const jobId = this._generateJobId();
    const now = new Date().toISOString();

    const job = {
      jobId,
      status: 'running',
      createdAt: now,
      startedAt: now,
      completedAt: null,
      totalFetched: 0,
      insertedCount: 0,
      duplicateCount: 0,
      error: null
    };

    // Synchronous lock acquisition
    this.activeJobId = jobId;
    this.jobs.set(jobId, job);

    console.log(`[PullManager] Job ${jobId} started`);

    // Launch background pull asynchronously without holding open the caller's context
    this._executeBackgroundPull(job, options).catch((err) => {
      // Safety catch to guarantee no unhandled promise rejections
      console.error(`[PullManager] Unhandled background pull error for ${jobId}:`, err);
    });

    // Return job snapshot immediately
    return { job: { ...job } };
  }

  /**
   * Executes the slow upstream pull and persists trades in the background.
   * @param {Object} job Active job reference
   * @param {Object} options Dependency injection overrides
   */
  async _executeBackgroundPull(job, options = {}) {
    const svc = options.mockService || mockBseService;
    const repo = options.repository || defaultTradeRepository;

    try {
      console.log(`[PullManager] Fetching trades from mock BSE`);
      const fetchOptions = options.delayMs !== undefined ? { delayMs: options.delayMs } : {};
      const { trades } = await svc.fetchTrades(fetchOptions);

      job.totalFetched = trades.length;
      console.log(`[PullManager] BSE fetch completed`);
      console.log(`[PullManager] Fetched ${trades.length} trades`);

      // Persist trades to SQLite database
      const { insertedCount, totalProcessed } = repo.insertTrades(trades);
      const duplicateCount = totalProcessed - insertedCount;

      job.insertedCount = insertedCount;
      job.duplicateCount = duplicateCount;
      job.status = 'completed';
      job.completedAt = new Date().toISOString();

      console.log(`[PullManager] Inserted ${insertedCount} trades`);
      console.log(`[PullManager] Ignored ${duplicateCount} duplicates`);
      console.log(`[PullManager] Job ${job.jobId} completed`);
    } catch (err) {
      job.status = 'failed';
      job.completedAt = new Date().toISOString();
      job.error = err.message || 'An unexpected error occurred during background pull.';
      console.error(`[PullManager] Job ${job.jobId} failed: ${job.error}`);
    } finally {
      // Release concurrency lock
      if (this.activeJobId === job.jobId) {
        this.activeJobId = null;
      }
    }
  }

  /**
   * Retrieves a job by its unique jobId.
   * @param {string} jobId
   * @returns {Object|null}
   */
  getJob(jobId) {
    const job = this.jobs.get(jobId);
    return job ? { ...job } : null;
  }

  /**
   * Retrieves all in-memory jobs ordered by creation time (newest first).
   * @returns {Array<Object>}
   */
  getAllJobs() {
    return Array.from(this.jobs.values())
      .map((job) => ({ ...job }))
      .reverse();
  }

  /**
   * Returns the current active job ID (if any).
   * @returns {string|null}
   */
  getActiveJobId() {
    return this.activeJobId;
  }

  /**
   * Resets in-memory state (used for isolated unit testing).
   */
  resetForTesting() {
    this.jobs.clear();
    this.activeJobId = null;
  }
}

// Export singleton instance as well as Class for testing
const defaultInstance = new PullManagerService();

module.exports = defaultInstance;
module.exports.PullManagerService = PullManagerService;
