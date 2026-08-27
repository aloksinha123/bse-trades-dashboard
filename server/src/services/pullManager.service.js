/**
 * Pull Manager Service
 * Manages asynchronous background BSE pull operations decoupled from HTTP request lifecycles.
 * Maintains in-memory job state, ensures single active pull concurrency protection,
 * and emits real-time WebSocket events upon pull lifecycle changes.
 */
const mockBseService = require('./mockBse.service');
const defaultTradeRepository = require('../db/trade.repository');
const { broadcastEvent, EVENTS } = require('../websocket/websocket.server');

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

    // Emit real-time event: pull:started
    const emit = options.emitEvent || broadcastEvent;
    emit(EVENTS.PULL_STARTED, {
      jobId: job.jobId,
      status: 'running',
      startedAt: job.startedAt
    });

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
   * Emits trades:new and pull:completed only after database transaction completes.
   * @param {Object} job Active job reference
   * @param {Object} options Dependency injection overrides
   */
  async _executeBackgroundPull(job, options = {}) {
    const svc = options.mockService || mockBseService;
    const repo = options.repository || defaultTradeRepository;
    const emit = options.emitEvent || broadcastEvent;

    try {
      console.log(`[PullManager] Fetching trades from mock BSE`);
      const fetchOptions = options.delayMs !== undefined ? { delayMs: options.delayMs } : {};
      const { trades } = await svc.fetchTrades(fetchOptions);

      job.totalFetched = trades.length;
      console.log(`[PullManager] BSE fetch completed`);
      console.log(`[PullManager] Fetched ${trades.length} trades`);

      // Persist trades to SQLite database & get newly inserted records
      const repoResult = repo.insertTrades(trades);
      const insertedCount = repoResult.insertedCount || 0;
      const duplicateCount =
        repoResult.duplicateCount !== undefined
          ? repoResult.duplicateCount
          : (repoResult.totalProcessed || trades.length) - insertedCount;
      const insertedTrades = repoResult.insertedTrades || [];

      job.insertedCount = insertedCount;
      job.duplicateCount = duplicateCount;
      job.status = 'completed';
      job.completedAt = new Date().toISOString();

      console.log(`[PullManager] Inserted ${insertedCount} trades`);
      console.log(`[PullManager] Ignored ${duplicateCount} duplicates`);

      // 1. Emit trades:new only if there are actually newly inserted records
      if (insertedTrades && insertedTrades.length > 0) {
        emit(EVENTS.TRADES_NEW, {
          jobId: job.jobId,
          count: insertedTrades.length,
          trades: insertedTrades
        });
      }

      // 2. Emit pull:completed
      emit(EVENTS.PULL_COMPLETED, {
        jobId: job.jobId,
        status: 'completed',
        totalFetched: job.totalFetched,
        insertedCount: job.insertedCount,
        duplicateCount: job.duplicateCount,
        completedAt: job.completedAt
      });

      console.log(`[PullManager] Job ${job.jobId} completed`);
    } catch (err) {
      job.status = 'failed';
      job.completedAt = new Date().toISOString();
      job.error = err.message || 'An unexpected error occurred during background pull.';
      console.error(`[PullManager] Job ${job.jobId} failed: ${job.error}`);

      // Emit pull:failed
      emit(EVENTS.PULL_FAILED, {
        jobId: job.jobId,
        status: 'failed',
        error: job.error
      });
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
