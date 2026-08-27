import React from 'react';

export function StatsCards({ totalTrades, pullStatus, lastPullTime, sessionNewTrades }) {
  const getStatusDisplay = () => {
    switch (pullStatus) {
      case 'running':
        return (
          <div className="status-val running">
            <span className="spinner-icon">⏳</span>
            <span>Running</span>
          </div>
        );
      case 'completed':
        return (
          <div className="status-val completed">
            <span>✅ Completed</span>
          </div>
        );
      case 'failed':
        return (
          <div className="status-val failed">
            <span>❌ Failed</span>
          </div>
        );
      case 'idle':
      default:
        return (
          <div className="status-val ready">
            <span>Ready</span>
          </div>
        );
    }
  };

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-header">
          <span className="stat-label">Total Trades</span>
          <span className="stat-icon">📊</span>
        </div>
        <div className="stat-value">
          {totalTrades !== null ? Number(totalTrades).toLocaleString() : '—'}
        </div>
        <div className="stat-subtext">Persisted in SQLite storage</div>
      </div>

      <div className="stat-card">
        <div className="stat-header">
          <span className="stat-label">Pull Status</span>
          <span className="stat-icon">⚡</span>
        </div>
        <div className="stat-value">
          {getStatusDisplay()}
        </div>
        <div className="stat-subtext">Background Ingestion State</div>
      </div>

      <div className="stat-card">
        <div className="stat-header">
          <span className="stat-label">Last Pull</span>
          <span className="stat-icon">🕒</span>
        </div>
        <div className="stat-value small">
          {lastPullTime ? new Date(lastPullTime).toLocaleTimeString() : 'Initial Seed'}
        </div>
        <div className="stat-subtext">
          {lastPullTime ? new Date(lastPullTime).toLocaleDateString() : 'Auto-seeded on start'}
        </div>
      </div>

      <div className="stat-card highlight">
        <div className="stat-header">
          <span className="stat-label">New Trades Ingested</span>
          <span className="stat-icon">🚀</span>
        </div>
        <div className="stat-value accent">
          +{Number(sessionNewTrades || 0).toLocaleString()}
        </div>
        <div className="stat-subtext">Received via Socket.IO push</div>
      </div>
    </div>
  );
}
