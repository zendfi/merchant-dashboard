'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface Notification {
  id: string;
  title: string;
  message?: string;
  type: NotificationType;
}

interface NotificationContextType {
  notification: Notification | null;
  showNotification: (title: string, message?: string, type?: NotificationType) => void;
  closeNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<Notification | null>(null);

  const showNotification = useCallback(
    (title: string, message?: string, type: NotificationType = 'info') => {
      const id = Math.random().toString(36).substr(2, 9);
      setNotification({ id, title, message, type });

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setNotification((current) => (current?.id === id ? null : current));
      }, 5000);
    },
    []
  );

  const closeNotification = useCallback(() => {
    setNotification(null);
  }, []);

  return (
    <NotificationContext.Provider value={{ notification, showNotification, closeNotification }}>
      {children}
      {notification && (
        <Toast
          notification={notification}
          onClose={closeNotification}
        />
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}

// Toast component
function Toast({
  notification,
  onClose,
}: {
  notification: Notification;
  onClose: () => void;
}) {
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  const colors = {
    success: '#00D924',
    error: '#E25950',
    warning: '#FF9500',
    info: '#635BFF',
  };

  return (
    <div className="toast-notification show">
      <div className="toast-content">
        <div
          className="toast-icon"
          style={{
            backgroundColor: colors[notification.type],
            color: 'white',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 'bold',
            flexShrink: 0,
          }}
        >
          {icons[notification.type]}
        </div>
        <div className="toast-text" style={{ flex: 1 }}>
          <div
            className="toast-title"
            style={{ fontSize: '13px', fontWeight: 600, marginBottom: 0 }}
          >
            {notification.title}
          </div>
          {notification.message && (
            <div
              className="toast-message"
              style={{
                fontSize: '12px',
                opacity: 0.8,
                lineHeight: 1.3,
                marginTop: '4px',
              }}
              dangerouslySetInnerHTML={{ __html: notification.message }}
            />
          )}
        </div>
        <button
          className="toast-close"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '4px',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
