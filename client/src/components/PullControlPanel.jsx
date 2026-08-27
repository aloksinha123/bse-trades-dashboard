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
            className={`btn-primary ${isPulling ? 'loading' : ''}`}
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
                <span className="btn-icon">▶</span>
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
                <span className="meta-label">Active Job ID</span>
                <span className="meta-val monospace text-sm" title={currentJob.jobId}>
                  {currentJob.jobId}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Status</span>
                <div>
                  <span className={`badge-status-pill ${currentJob.status}`}>
                    {currentJob.status}
                  </span>
                </div>
              </div>
              <div className="meta-item">
                <span className="meta-label">Fetched</span>
                <span className="meta-val tabular-nums">
                  {currentJob.totalFetched !== undefined ? Number(currentJob.totalFetched).toLocaleString() : '—'}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Inserted (New)</span>
                <span className="meta-val text-success font-semibold tabular-nums">
                  {currentJob.insertedCount !== undefined ? Number(currentJob.insertedCount).toLocaleString() : '—'}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Duplicates Ignored</span>
                <span className="meta-val text-muted tabular-nums">
                  {currentJob.duplicateCount !== undefined ? Number(currentJob.duplicateCount).toLocaleString() : '—'}
                </span>
              </div>
              {currentJob.error && (
                <div className="meta-item full-width">
                  <span className="meta-label text-error font-semibold">Error Details</span>
                  <span className="meta-val text-error text-sm">{currentJob.error}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="job-meta-empty">
              <span>Ready. Click "Start New Pull" to trigger background BSE ingestion.</span>
            </div>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="control-panel-alert">
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
