import React from 'react';

export function PullControlPanel({
  onTriggerPull,
  isPulling,
  currentJob,
  errorMessage
}) {
  return (
    <div className="control-panel-card">
      <div className="control-panel-main">
        <div className="action-col">
          <button
            id="btn-start-pull"
            className={`btn-pull ${isPulling ? 'loading' : ''}`}
            onClick={onTriggerPull}
            disabled={isPulling}
            title={isPulling ? 'A pull is already running in the background' : 'Trigger asynchronous BSE pull'}
          >
            {isPulling ? (
              <>
                <span className="btn-spinner"></span>
                <span>Pull in progress...</span>
              </>
            ) : (
              <>
                <span>▶</span>
                <span>Start New Pull</span>
              </>
            )}
          </button>
          <div className="btn-caption">
            Triggers <code>POST /pull</code> (returns in &lt; 5 ms while BSE fetches in background)
          </div>
        </div>

        <div className="job-meta-col">
          {currentJob ? (
            <div className="job-meta-grid">
              <div className="meta-item">
                <span className="meta-label">Active Job ID:</span>
                <span className="meta-val monospace">{currentJob.jobId}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Status:</span>
                <span className={`meta-val badge-status ${currentJob.status}`}>
                  {currentJob.status}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Fetched:</span>
                <span className="meta-val">
                  {currentJob.totalFetched !== undefined ? Number(currentJob.totalFetched).toLocaleString() : '—'}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Inserted (New):</span>
                <span className="meta-val text-success">
                  {currentJob.insertedCount !== undefined ? Number(currentJob.insertedCount).toLocaleString() : '—'}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Duplicates Ignored:</span>
                <span className="meta-val text-muted">
                  {currentJob.duplicateCount !== undefined ? Number(currentJob.duplicateCount).toLocaleString() : '—'}
                </span>
              </div>
              {currentJob.error && (
                <div className="meta-item full-width error">
                  <span className="meta-label">Error:</span>
                  <span className="meta-val text-error">{currentJob.error}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="job-meta-empty">
              <span>No pull active. Click "Start New Pull" to fetch real-time trades.</span>
            </div>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="control-panel-alert">
          <span>⚠️ {errorMessage}</span>
        </div>
      )}
    </div>
  );
}
