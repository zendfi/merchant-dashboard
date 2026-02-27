'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface DeveloperOptionsContextType {
  showDeveloperOptions: boolean;
  setDeveloperOptions: (show: boolean) => void;
  toggleDeveloperOptions: () => void;
}

const DeveloperOptionsContext = createContext<DeveloperOptionsContextType | undefined>(undefined);

export function DeveloperOptionsProvider({ children }: { children: ReactNode }) {
  const [showDeveloperOptions, setShowDeveloperOptionsState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('zendfi-developer-options') === 'true';
    }
    return false;
  });

  const setDeveloperOptions = useCallback((show: boolean) => {
    setShowDeveloperOptionsState(show);
    if (typeof window !== 'undefined') {
      localStorage.setItem('zendfi-developer-options', show.toString());
    }
  }, []);

  const toggleDeveloperOptions = useCallback(() => {
    setDeveloperOptions(!showDeveloperOptions);
  }, [showDeveloperOptions, setDeveloperOptions]);

  return (
    <DeveloperOptionsContext.Provider value={{ showDeveloperOptions, setDeveloperOptions, toggleDeveloperOptions }}>
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
