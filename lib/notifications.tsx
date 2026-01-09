'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

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

// Toast component - Modern design with inline styles for reliability
function Toast({
  notification,
  onClose,
}: {
  notification: Notification;
  onClose: () => void;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    // Trigger animation on mount
    const timer = setTimeout(() => setIsVisible(true), 10);
    
    // Progress bar countdown
    const startTime = Date.now();
    const duration = 5000;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 50);
    
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  const config = {
    success: {
      icon: (
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ),
      iconBg: '#10b981',
      borderColor: 'rgba(16, 185, 129, 0.3)',
      progressColor: '#34d399',
    },
    error: {
      icon: (
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
      iconBg: '#ef4444',
      borderColor: 'rgba(239, 68, 68, 0.3)',
      progressColor: '#f87171',
    },
    warning: {
      icon: (
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      iconBg: '#f59e0b',
      borderColor: 'rgba(245, 158, 11, 0.3)',
      progressColor: '#fbbf24',
    },
    info: {
      icon: (
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      iconBg: '#635bff',
      borderColor: 'rgba(99, 91, 255, 0.3)',
      progressColor: '#818cf8',
    },
  };

  const { icon, iconBg, borderColor, progressColor } = config[notification.type];

  return (
    <div 
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: `translateX(-50%) translateY(${isVisible ? '0' : '20px'})`,
        zIndex: 10000,
        opacity: isVisible ? 1 : 0,
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div 
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${borderColor}`,
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          minWidth: '320px',
          maxWidth: '420px',
        }}
      >
        {/* Main content */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px' }}>
          {/* Icon */}
          <div style={{
            flexShrink: 0,
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            backgroundColor: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
          }}>
            {icon}
          </div>
          
          {/* Text content */}
          <div style={{ flex: 1, minWidth: 0, paddingTop: '2px' }}>
            <p style={{
              color: 'white',
              fontWeight: 600,
              fontSize: '14px',
              lineHeight: 1.3,
              margin: 0,
            }}>
              {notification.title}
            </p>
            {notification.message && (
              <p 
                style={{
                  color: '#94a3b8',
                  fontSize: '13px',
                  marginTop: '4px',
                  lineHeight: 1.5,
                }}
                dangerouslySetInnerHTML={{ __html: notification.message }}
              />
            )}
          </div>
          
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              flexShrink: 0,
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              marginTop: '-2px',
              marginRight: '-4px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#64748b';
            }}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Progress bar */}
        <div style={{ height: '3px', backgroundColor: 'rgba(30, 41, 59, 0.5)' }}>
          <div 
            style={{
              height: '100%',
              backgroundColor: progressColor,
              transition: 'width 0.1s linear',
              width: `${progress}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
