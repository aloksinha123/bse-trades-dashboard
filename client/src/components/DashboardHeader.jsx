import React from 'react';

export function DashboardHeader({ connectionStatus }) {
  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <span className="live-status-pill connected" title="Real-time WebSocket active">
            <span className="status-indicator-dot connected"></span>
            LIVE Connected
          </span>
        );
      case 'connecting':
        return (
          <span className="live-status-pill connecting" title="Connecting to WebSocket">
            <span className="status-indicator-dot connecting"></span>
            Connecting...
          </span>
        );
      case 'disconnected':
      default:
        return (
          <span className="live-status-pill disconnected" title="WebSocket disconnected">
            <span className="status-indicator-dot disconnected"></span>
            Disconnected
          </span>
        );
    }
  };

  return (
    <header className="dashboard-header">
      <div className="header-brand">
        <div className="brand-badge">
          <span className="brand-logo-text">BSE</span>
        </div>
        <div className="brand-info">
          <div className="brand-title-row">
            <h1 className="brand-title">BSE Trades Monitor</h1>
            <span className="market-tag">Equity Cash Feed</span>
          </div>
          <p className="brand-subtitle">
            Real-time market trade ingestion &amp; asynchronous pull architecture
          </p>
        </div>
      </div>

      <div className="header-controls">
        {getStatusBadge()}
      </div>
    </header>
  );
}
