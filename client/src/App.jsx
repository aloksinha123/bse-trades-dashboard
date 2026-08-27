import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as api from './services/api';
import { useTradeSocket } from './hooks/useTradeSocket';
import { DashboardHeader } from './components/DashboardHeader';
import { StatsCards } from './components/StatsCards';
import { PullControlPanel } from './components/PullControlPanel';
import { LiveUpdateBanner } from './components/LiveUpdateBanner';
import { TradeTable } from './components/TradeTable';
import './App.css';

function App() {
  const [trades, setTrades] = useState([]);
  const [totalTrades, setTotalTrades] = useState(null);
  const [pullStatus, setPullStatus] = useState('idle'); // 'idle' | 'running' | 'completed' | 'failed'
  const [currentJob, setCurrentJob] = useState(null);
  const [lastPullTime, setLastPullTime] = useState(null);
  const [sessionNewTrades, setSessionNewTrades] = useState(0);
  const [newTradeIds, setNewTradeIds] = useState(new Set());
  const [liveNotification, setLiveNotification] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);

  const highlightTimerRef = useRef(null);

  // Initial Data Load from GET /trades (Runs once on mount)
  const loadInitialTrades = useCallback(async () => {
    setIsLoadingInitial(true);
    setErrorMessage(null);
    try {
      const response = await api.getTrades({ limit: 500, offset: 0 });
      if (response.success && Array.isArray(response.data)) {
        setTrades(response.data);
        setTotalTrades(response.total !== undefined ? response.total : response.data.length);
      }
    } catch (err) {
      console.error('[Dashboard] Failed to load initial trades:', err);
      setErrorMessage(`Failed to connect to backend: ${err.message}`);
    } finally {
      setIsLoadingInitial(false);
    }
  }, []);

  useEffect(() => {
    loadInitialTrades();
  }, [loadInitialTrades]);

  // Real-Time Socket.IO Handlers
  const handlePullStarted = useCallback((data) => {
    setPullStatus('running');
    setErrorMessage(null);
    setCurrentJob((prev) => ({
      ...(prev || {}),
      jobId: data.jobId,
      status: 'running',
      startedAt: data.startedAt || new Date().toISOString(),
      completedAt: null,
      totalFetched: 0,
      insertedCount: 0,
      duplicateCount: 0,
      error: null
    }));
  }, []);

  const handleTradesNew = useCallback((data) => {
    if (!data || !Array.isArray(data.trades) || data.trades.length === 0) {
      return;
    }

    const newlyArrivedTrades = data.trades;

    // Merge into local trade collection using Map by tradeId (newest first, zero duplicates)
    setTrades((prevTrades) => {
      const tradeMap = new Map();

      // Add new incoming trades first
      for (const t of newlyArrivedTrades) {
        tradeMap.set(t.tradeId, t);
      }

      // Add existing trades
      for (const t of prevTrades) {
        if (!tradeMap.has(t.tradeId)) {
          tradeMap.set(t.tradeId, t);
        }
      }

      // Sort newest timestamp first
      return Array.from(tradeMap.values()).sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );
    });

    // Update total count and session new trades
    setTotalTrades((prev) => (prev !== null ? prev + newlyArrivedTrades.length : newlyArrivedTrades.length));
    setSessionNewTrades((prev) => prev + newlyArrivedTrades.length);

    // Show temporary highlight on newly arrived trade IDs
    const newIdSet = new Set(newlyArrivedTrades.map((t) => t.tradeId));
    setNewTradeIds(newIdSet);

    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = setTimeout(() => {
      setNewTradeIds(new Set());
    }, 6000);

    // Display banner notification
    setLiveNotification({
      message: `+${newlyArrivedTrades.length.toLocaleString()} new trades received in real-time via Socket.IO!`,
      timestamp: Date.now()
    });
  }, []);

  const handlePullCompleted = useCallback((data) => {
    setPullStatus('completed');
    setLastPullTime(data.completedAt || new Date().toISOString());
    setCurrentJob((prev) => ({
      ...(prev || {}),
      jobId: data.jobId,
      status: 'completed',
      totalFetched: data.totalFetched,
      insertedCount: data.insertedCount,
      duplicateCount: data.duplicateCount,
      completedAt: data.completedAt || new Date().toISOString()
    }));
  }, []);

  const handlePullFailed = useCallback((data) => {
    setPullStatus('failed');
    setErrorMessage(data.error || 'Background pull failed.');
    setCurrentJob((prev) => ({
      ...(prev || {}),
      jobId: data.jobId,
      status: 'failed',
      error: data.error
    }));
  }, []);

  // Connect to Socket.IO
  const { connectionStatus } = useTradeSocket({
    onPullStarted: handlePullStarted,
    onTradesNew: handleTradesNew,
    onPullCompleted: handlePullCompleted,
    onPullFailed: handlePullFailed
  });

  // Action: Trigger Background Pull (POST /pull)
  const handleTriggerPull = async () => {
    setErrorMessage(null);
    try {
      const response = await api.startPull();
      if (response.success && response.job) {
        setPullStatus('running');
        setCurrentJob(response.job);
      }
    } catch (err) {
      if (err.status === 409) {
        setErrorMessage('A pull is already in progress.');
      } else {
        setErrorMessage(`Failed to trigger pull: ${err.message}`);
      }
    }
  };

  return (
    <div className="dashboard-layout">
      <DashboardHeader connectionStatus={connectionStatus} />

      <LiveUpdateBanner
        notification={liveNotification}
        onDismiss={() => setLiveNotification(null)}
      />

      <main className="dashboard-content">
        <StatsCards
          totalTrades={totalTrades}
          pullStatus={pullStatus}
          lastPullTime={lastPullTime}
          sessionNewTrades={sessionNewTrades}
        />

        <PullControlPanel
          onTriggerPull={handleTriggerPull}
          isPulling={pullStatus === 'running'}
          currentJob={currentJob}
          errorMessage={errorMessage}
        />

        <section className="trades-section">
          <div className="section-header">
            <h2 className="section-title">Market Trades Feed</h2>
            <span className="section-caption">
              Persisted SQLite records • Live Socket.IO streaming updates
            </span>
          </div>

          {isLoadingInitial ? (
            <div className="loading-card">
              <div className="loading-spinner"></div>
              <p>Loading persisted trades...</p>
            </div>
          ) : (
            <TradeTable trades={trades} newTradeIds={newTradeIds} />
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
