import React from 'react';

export function EmptyState({ title = 'No Trades Found', message = 'No matching trades found in the current view.' }) {
  return (
    <div className="empty-state-container">
      <span className="empty-icon">📭</span>
      <h3 className="empty-title">{title}</h3>
      <p className="empty-message">{message}</p>
    </div>
  );
}
