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

// Toast component - Modern glass-morphism design
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
    requestAnimationFrame(() => setIsVisible(true));
    
    // Progress bar countdown
    const startTime = Date.now();
    const duration = 5000;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 50);
    
    return () => clearInterval(interval);
  }, []);

  const config = {
    success: {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ),
      bgColor: 'bg-emerald-500',
      borderColor: 'border-emerald-400/30',
      progressColor: 'bg-emerald-400',
      glowColor: 'shadow-emerald-500/20',
    },
    error: {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
      bgColor: 'bg-red-500',
      borderColor: 'border-red-400/30',
      progressColor: 'bg-red-400',
      glowColor: 'shadow-red-500/20',
    },
    warning: {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      bgColor: 'bg-amber-500',
      borderColor: 'border-amber-400/30',
      progressColor: 'bg-amber-400',
      glowColor: 'shadow-amber-500/20',
    },
    info: {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bgColor: 'bg-indigo-500',
      borderColor: 'border-indigo-400/30',
      progressColor: 'bg-indigo-400',
      glowColor: 'shadow-indigo-500/20',
    },
  };

  const { icon, bgColor, borderColor, progressColor, glowColor } = config[notification.type];

  return (
    <div 
      className={`
        fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000]
        transition-all duration-500 ease-out
        ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}
      `}
    >
      <div 
        className={`
          relative overflow-hidden
          bg-[#0f172a]/95 backdrop-blur-xl
          border ${borderColor}
          rounded-2xl
          shadow-2xl ${glowColor}
          min-w-[320px] max-w-[420px]
        `}
      >
        {/* Main content */}
        <div className="flex items-start gap-3 p-4">
          {/* Icon */}
          <div className={`
            flex-shrink-0 w-9 h-9 rounded-xl ${bgColor}
            flex items-center justify-center text-white
            shadow-lg
          `}>
            {icon}
          </div>
          
          {/* Text content */}
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-white font-semibold text-[14px] leading-tight">
              {notification.title}
            </p>
            {notification.message && (
              <p 
                className="text-slate-400 text-[13px] mt-1 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: notification.message }}
              />
            )}
          </div>
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="
              flex-shrink-0 w-7 h-7 rounded-lg
              flex items-center justify-center
              text-slate-500 hover:text-white
              hover:bg-white/10
              transition-all duration-200
              -mt-0.5 -mr-1
            "
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Progress bar */}
        <div className="h-1 bg-slate-800/50">
          <div 
            className={`h-full ${progressColor} transition-all duration-100 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
