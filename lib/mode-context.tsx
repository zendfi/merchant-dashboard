'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type Mode = 'test' | 'live';

interface ModeContextType {
  mode: Mode;
  setMode: (mode: Mode) => void;
  toggleMode: () => void;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('zendfi-mode') as Mode) || 'live';
    }
    return 'live';
  });

  const setMode = useCallback((newMode: Mode) => {
    setModeState(newMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('zendfi-mode', newMode);
    }
  }, []);

  const toggleMode = useCallback(() => {
    const newMode = mode === 'live' ? 'test' : 'live';
    setMode(newMode);
  }, [mode, setMode]);

  return (
    <ModeContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const context = useContext(ModeContext);
  if (context === undefined) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
}
