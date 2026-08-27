/**
 * Pull Controller
 * Handles HTTP requests for triggering and monitoring background BSE pulls.
 */
const pullManager = require('../services/pullManager.service');

/**
 * @route   POST /pull
 * @desc    Triggers an asynchronous background trade pull
 * @access  Public
 */
const triggerPull = (req, res, next) => {
  try {
    const { job } = pullManager.startPull();
    // Return HTTP 202 Accepted immediately before slow BSE pull begins
    res.status(202).json({
      success: true,
      message: 'Background pull initiated successfully.',
      job
    });
  } catch (error) {
    if (error.status === 409) {
      return res.status(409).json({
        success: false,
        error: error.message,
        activeJobId: error.activeJobId
      });
    }
    next(error);
  }
};

/**
 * @route   GET /pull/:jobId
 * @desc    Get status of a specific background pull job
 * @access  Public
 */
const getPullStatus = (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = pullManager.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: `Job with ID "${jobId}" not found.`
      });
    }

    res.status(200).json({
      success: true,
      job
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /pull (or /pulls)
 * @desc    Get all recent in-memory background pull jobs
 * @access  Public
 */
const getPullHistory = (req, res, next) => {
  try {
    const jobs = pullManager.getAllJobs();
    res.status(200).json({
      success: true,
      count: jobs.length,
      jobs
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  triggerPull,
  getPullStatus,
  getPullHistory
};
