import React, { useEffect, useState } from 'react';

export function LiveUpdateBanner({ notification, onDismiss }) {
  if (!notification) return null;

  return (
    <div className="live-update-banner animate-slide-down">
      <div className="banner-content">
        <span className="banner-icon">⚡</span>
        <div className="banner-text">
          <strong>Real-Time Update:</strong> {notification.message}
        </div>
      </div>
      <button className="banner-close" onClick={onDismiss} title="Dismiss">
        ✕
      </button>
    </div>
  );
}
