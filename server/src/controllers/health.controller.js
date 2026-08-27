/**
 * Health Check Controller
 * Provides basic service liveness status.
 */
const getHealthStatus = (req, res) => {
  res.status(200).json({
    status: 'ok'
  });
};

module.exports = {
  getHealthStatus
};
