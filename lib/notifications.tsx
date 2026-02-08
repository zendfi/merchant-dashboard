'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  title: string;
  message?: string;
  type: NotificationType;
  createdAt: number;
  dismissing?: boolean;
}

interface NotificationContextType {
  notification: Toast | null;
  showNotification: (title: string, message?: string, type?: NotificationType) => void;
  closeNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const TOAST_DURATION = 4000;
const DISMISS_ANIMATION_MS = 300;
const MAX_VISIBLE = 3;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [hovering, setHovering] = useState(false);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, dismissing: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, DISMISS_ANIMATION_MS);
  }, []);

  const scheduleRemoval = useCallback(
    (id: string) => {
      const timer = setTimeout(() => {
        dismiss(id);
        timersRef.current.delete(id);
      }, TOAST_DURATION);
      timersRef.current.set(id, timer);
    },
    [dismiss]
  );

  const showNotification = useCallback(
    (title: string, message?: string, type: NotificationType = 'info') => {
      const id = Math.random().toString(36).substring(2, 11);
      const toast: Toast = { id, title, message, type, createdAt: Date.now() };
      setToasts((prev) => [toast, ...prev].slice(0, 5));
      scheduleRemoval(id);
    },
    [scheduleRemoval]
  );

  const closeNotification = useCallback(() => {
    setToasts((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((t, i) => (i === 0 ? { ...t, dismissing: true } : t));
    });
    setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, DISMISS_ANIMATION_MS);
  }, []);

  // Pause/resume timers on hover
  useEffect(() => {
    if (hovering) {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    } else {
      toasts.forEach((t) => {
        if (!t.dismissing && !timersRef.current.has(t.id)) {
          const elapsed = Date.now() - t.createdAt;
          const remaining = Math.max(TOAST_DURATION - elapsed, 500);
          const timer = setTimeout(() => {
            dismiss(t.id);
            timersRef.current.delete(t.id);
          }, remaining);
          timersRef.current.set(t.id, timer);
        }
      });
    }
  }, [hovering, toasts, dismiss]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const latestToast = toasts.length > 0 ? toasts[0] : null;

  return (
    <NotificationContext.Provider value={{ notification: latestToast, showNotification, closeNotification }}>
      {children}
      {toasts.length > 0 && (
        <ToastContainer
          toasts={toasts}
          onDismiss={dismiss}
          hovering={hovering}
          onHoverChange={setHovering}
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

// ─── Icon components ────────────────────────────────────────────────────────────

function SuccessIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1C4.13 1 1 4.13 1 8s3.13 7 7 7 7-3.13 7-7-3.13-7-7-7z" fill="#22c55e" />
      <path d="M6.5 10.5L4 8l-.71.71L6.5 11.92l7-7-.71-.71L6.5 10.5z" fill="white" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1C4.13 1 1 4.13 1 8s3.13 7 7 7 7-3.13 7-7-3.13-7-7-7z" fill="#ef4444" />
      <path d="M10.5 5.5l-5 5M5.5 5.5l5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8.87 2.15l5.74 10.49A1 1 0 0113.74 14H2.26a1 1 0 01-.87-1.36L7.13 2.15a1 1 0 011.74 0z" fill="#f59e0b" />
      <path d="M8 6v3M8 11h.01" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1C4.13 1 1 4.13 1 8s3.13 7 7 7 7-3.13 7-7-3.13-7-7-7z" fill="#8B7BF7" />
      <path d="M8 5h.01M8 7v4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Toast Container ────────────────────────────────────────────────────────────

function ToastContainer({
  toasts,
  onDismiss,
  hovering,
  onHoverChange,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  hovering: boolean;
  onHoverChange: (h: boolean) => void;
}) {
  const visible = toasts.slice(0, MAX_VISIBLE);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column-reverse',
        alignItems: 'flex-end',
        pointerEvents: 'none',
      }}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <div
        style={{
          position: 'relative',
          width: '356px',
        }}
      >
        {visible.map((toast, index) => {
          const reverseIndex = visible.length - 1 - index;

          // Stacking: when not hovering, toasts collapse behind the front one
          const offsetY = hovering
            ? reverseIndex * -68
            : reverseIndex * -8;
          const scale = hovering ? 1 : 1 - reverseIndex * 0.03;
          const opacity = toast.dismissing ? 0 : reverseIndex >= MAX_VISIBLE ? 0 : 1;

          return (
            <ToastItem
              key={toast.id}
              toast={toast}
              onDismiss={onDismiss}
              style={{
                position: reverseIndex === 0 ? 'relative' : 'absolute',
                bottom: reverseIndex === 0 ? 0 : 0,
                left: 0,
                right: 0,
                transform: `translateY(${offsetY}px) scale(${scale})`,
                opacity,
                zIndex: visible.length - reverseIndex,
                transition: `all ${DISMISS_ANIMATION_MS}ms cubic-bezier(0.21, 1.02, 0.73, 1)`,
                pointerEvents: 'auto',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Single Toast ───────────────────────────────────────────────────────────────

const iconMap: Record<NotificationType, React.FC> = {
  success: SuccessIcon,
  error: ErrorIcon,
  warning: WarningIcon,
  info: InfoIcon,
};

const borderLeftColors: Record<NotificationType, string> = {
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#8B7BF7',
};

function ToastItem({
  toast,
  onDismiss,
  style,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
  style: React.CSSProperties;
}) {
  const [mounted, setMounted] = useState(false);
  const Icon = iconMap[toast.type];

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Detect dark mode
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  return (
    <div
      style={{
        ...style,
        transform: `${style.transform || ''} translateX(${mounted && !toast.dismissing ? '0' : '110%'})`,
      }}
    >
      <div
        style={{
          background: isDark ? '#1e1e2e' : '#ffffff',
          borderRadius: '10px',
          boxShadow: isDark
            ? '0 4px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.06)'
            : '0 4px 24px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04)',
          borderLeft: `3px solid ${borderLeftColors[toast.type]}`,
          display: 'flex',
          alignItems: 'flex-start',
          padding: '12px 14px',
          gap: '10px',
          width: '100%',
          boxSizing: 'border-box' as const,
        }}
      >
        {/* Icon */}
        <div
          style={{
            flexShrink: 0,
            marginTop: '1px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              color: isDark ? '#f1f5f9' : '#0f172a',
              fontSize: '13px',
              fontWeight: 600,
              lineHeight: '18px',
              fontFamily: "'Manrope', sans-serif",
            }}
          >
            {toast.title}
          </div>
          {toast.message && (
            <div
              style={{
                color: isDark ? '#94a3b8' : '#64748b',
                fontSize: '12px',
                lineHeight: '17px',
                marginTop: '2px',
                fontFamily: "'Manrope', sans-serif",
              }}
              dangerouslySetInnerHTML={{ __html: toast.message }}
            />
          )}
        </div>

        {/* Close */}
        <button
          onClick={() => onDismiss(toast.id)}
          style={{
            flexShrink: 0,
            width: '20px',
            height: '20px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isDark ? '#475569' : '#cbd5e1',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            marginTop: '-1px',
            marginRight: '-2px',
            transition: 'color 0.15s, background 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = isDark ? '#e2e8f0' : '#334155';
            e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = isDark ? '#475569' : '#cbd5e1';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
