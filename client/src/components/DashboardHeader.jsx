import React from 'react';

export function DashboardHeader({ connectionStatus }) {
  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <span className="live-status-pill connected" title="Real-time WebSocket active">
            <span className="pulse-dot"></span>
            LIVE Connected
          </span>
        );
      case 'connecting':
        return (
          <span className="live-status-pill connecting" title="Connecting to WebSocket">
            <span className="pulse-dot pending"></span>
            Connecting...
          </span>
        );
      case 'disconnected':
      default:
        return (
          <span className="live-status-pill disconnected" title="WebSocket disconnected">
            <span className="pulse-dot error"></span>
            Disconnected
          </span>
        );
    }
  };

  return (
    <header className="dashboard-header">
      <div className="header-brand">
        <div className="brand-icon">
          <span>📈</span>
        </div>
        <div>
          <div className="brand-title-row">
            <h1 className="brand-title">BSE Trades Monitor</h1>
            <span className="market-tag">BSE Equity Feed</span>
          </div>
          <p className="brand-subtitle">
            Real-time market trade ingestion & asynchronous pull streaming architecture
          </p>
        </div>
      </div>

      <div className="header-controls">
        {getStatusBadge()}
      </div>
    </header>
  );
}
