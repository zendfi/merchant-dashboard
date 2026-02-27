'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { merchant as merchantApi, MerchantProfile } from '@/lib/api';

interface MerchantContextType {
  merchant: MerchantProfile | null;
  isLoading: boolean;
  error: string | null;
  refreshMerchant: () => Promise<void>;
}

const MerchantContext = createContext<MerchantContextType | undefined>(undefined);

export function MerchantProvider({ children }: { children: ReactNode }) {
  const [merchant, setMerchant] = useState<MerchantProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshMerchant = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const profile = await merchantApi.getProfile();
      setMerchant(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load merchant profile');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMerchant();
  }, [refreshMerchant]);

  return (
    <MerchantContext.Provider value={{ merchant, isLoading, error, refreshMerchant }}>
      {children}
    </MerchantContext.Provider>
  );
}

export function useMerchant() {
  const context = useContext(MerchantContext);
  if (context === undefined) {
    throw new Error('useMerchant must be used within a MerchantProvider');
  }
  return context;
}
