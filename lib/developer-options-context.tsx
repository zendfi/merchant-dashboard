'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface DeveloperOptionsContextType {
  showDeveloperOptions: boolean;
  showTerminalTab: boolean;
  setDeveloperOptions: (show: boolean) => void;
  setTerminalTabVisibility: (show: boolean) => void;
  toggleDeveloperOptions: () => void;
  toggleTerminalTabVisibility: () => void;
}

const DeveloperOptionsContext = createContext<DeveloperOptionsContextType | undefined>(undefined);

export function DeveloperOptionsProvider({ children }: { children: ReactNode }) {
  const [showDeveloperOptions, setShowDeveloperOptionsState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('zendfi-developer-options') === 'true';
    }
    return false;
  });
  const [showTerminalTab, setShowTerminalTabState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('zendfi-show-terminal-tab');
      return stored === null ? true : stored === 'true';
    }
    return true;
  });

  const setDeveloperOptions = useCallback((show: boolean) => {
    setShowDeveloperOptionsState(show);
    if (typeof window !== 'undefined') {
      localStorage.setItem('zendfi-developer-options', show.toString());
    }
  }, []);

  const setTerminalTabVisibility = useCallback((show: boolean) => {
    setShowTerminalTabState(show);
    if (typeof window !== 'undefined') {
      localStorage.setItem('zendfi-show-terminal-tab', show.toString());
    }
  }, []);

  const toggleDeveloperOptions = useCallback(() => {
    setDeveloperOptions(!showDeveloperOptions);
  }, [showDeveloperOptions, setDeveloperOptions]);

  const toggleTerminalTabVisibility = useCallback(() => {
    setTerminalTabVisibility(!showTerminalTab);
  }, [showTerminalTab, setTerminalTabVisibility]);

  return (
    <DeveloperOptionsContext.Provider
      value={{
        showDeveloperOptions,
        showTerminalTab,
        setDeveloperOptions,
        setTerminalTabVisibility,
        toggleDeveloperOptions,
        toggleTerminalTabVisibility,
      }}
    >
      {children}
    </DeveloperOptionsContext.Provider>
  );
}

export function useDeveloperOptions() {
  const context = useContext(DeveloperOptionsContext);
  if (context === undefined) {
    throw new Error('useDeveloperOptions must be used within a DeveloperOptionsProvider');
  }
  return context;
}
