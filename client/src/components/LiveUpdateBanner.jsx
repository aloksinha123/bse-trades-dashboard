import React from 'react';

export function LiveUpdateBanner({ notification, onDismiss }) {
  if (!notification) return null;

  return (
    <div className="live-update-banner">
      <div className="banner-content">
        <span className="banner-status-dot"></span>
        <div className="banner-text">
          <span className="font-semibold">Live Push Received:</span> {notification.message}
        </div>
      </div>
      <button className="banner-close-btn" onClick={onDismiss} title="Dismiss notification">
        ✕
      </button>
    </div>
  );
}
