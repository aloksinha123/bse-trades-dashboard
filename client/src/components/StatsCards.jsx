import React from 'react';

export function StatsCards({ totalTrades, pullStatus, lastPullTime, sessionNewTrades }) {
  const getStatusBadge = () => {
    switch (pullStatus) {
      case 'running':
        return (
          <span className="badge-status-pill running">
            <span className="inline-spinner"></span>
            Running
          </span>
        );
      case 'completed':
        return (
          <span className="badge-status-pill completed">
            Completed
          </span>
        );
      case 'failed':
        return (
          <span className="badge-status-pill failed">
            Failed
          </span>
        );
      case 'idle':
      default:
        return (
          <span className="badge-status-pill ready">
            Ready
          </span>
        );
    }
  };

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-header">
          <span className="stat-label">Total Trades</span>
        </div>
        <div className="stat-value tabular-nums">
          {totalTrades !== null ? Number(totalTrades).toLocaleString() : '—'}
        </div>
        <div className="stat-subtext">Persisted in SQLite database</div>
      </div>

      <div className="stat-card">
        <div className="stat-header">
          <span className="stat-label">Pull Status</span>
        </div>
        <div className="stat-value">
          {getStatusBadge()}
        </div>
        <div className="stat-subtext">Background Ingestion State</div>
      </div>

      <div className="stat-card">
        <div className="stat-header">
          <span className="stat-label">Last Pull</span>
        </div>
        <div className="stat-value text-secondary small tabular-nums">
          {lastPullTime ? new Date(lastPullTime).toLocaleTimeString() : 'Initial Seed'}
        </div>
        <div className="stat-subtext">
          {lastPullTime ? new Date(lastPullTime).toLocaleDateString() : 'Auto-seeded on start'}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-header">
          <span className="stat-label">New Ingested Trades</span>
        </div>
        <div className="stat-value text-accent tabular-nums">
          +{Number(sessionNewTrades || 0).toLocaleString()}
        </div>
        <div className="stat-subtext">Received via Socket.IO push</div>
      </div>
    </div>
  );
}
