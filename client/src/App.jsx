import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [healthStatus, setHealthStatus] = useState({ state: 'idle', data: null, error: null });

  const checkBackendHealth = async () => {
    setHealthStatus({ state: 'loading', data: null, error: null });
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/health`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setHealthStatus({ state: 'success', data, error: null });
    } catch (err) {
      setHealthStatus({ state: 'error', data: null, error: err.message });
    }
  };

  useEffect(() => {
    checkBackendHealth();
  }, []);

  return (
    <div className="app-container">
      <header className="header-section">
        <span className="badge">Phase 1 Foundation</span>
        <h1 className="title">BSE Trades Dashboard</h1>
        <p className="subtitle">
          Real-time trade streaming and background ingestion architecture foundation.
        </p>
      </header>

      <main className="card-grid">
        <div className="card">
          <h2 className="card-title">
            <span
              className={`status-indicator ${
                healthStatus.state === 'loading'
                  ? 'pending'
                  : healthStatus.state === 'error'
                  ? 'error'
                  : 'ready'
              }`}
            ></span>
            Backend Connection Status
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            Tests connectivity with <code>GET /health</code> on the Express server.
          </p>
          <button className="btn" onClick={checkBackendHealth}>
            {healthStatus.state === 'loading' ? 'Checking...' : 'Recheck /health'}
          </button>

          <div className="health-result">
            {healthStatus.state === 'loading' && <span>Connecting to backend...</span>}
            {healthStatus.state === 'success' && (
              <pre>{JSON.stringify(healthStatus.data, null, 2)}</pre>
            )}
            {healthStatus.state === 'error' && (
              <span style={{ color: '#f87171' }}>Error: {healthStatus.error}</span>
            )}
            {healthStatus.state === 'idle' && <span>Ready to check.</span>}
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Architecture Roadmap</h2>
          <ul className="roadmap-list">
            <li className="roadmap-item completed">
              <span>✅</span> <strong>Phase 1:</strong> Setup & Backend Skeleton
            </li>
            <li className="roadmap-item">
              <span>⏳</span> <strong>Phase 2:</strong> Mock BSE API & Data Seeding
            </li>
            <li className="roadmap-item">
              <span>⏳</span> <strong>Phase 3:</strong> Background Pull Engine (&lt;30s timeout handler)
            </li>
            <li className="roadmap-item">
              <span>⏳</span> <strong>Phase 4:</strong> WebSocket Real-time Push
            </li>
            <li className="roadmap-item">
              <span>⏳</span> <strong>Phase 5:</strong> Live Trades Dashboard UI
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}

export default App;
