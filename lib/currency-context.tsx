 'use client';

 import React, {
   createContext,
   useCallback,
   useContext,
   useEffect,
   useState,
   ReactNode,
 } from 'react';

 export type DisplayCurrency = 'USD' | 'NGN';

 interface CurrencyContextType {
   currency: DisplayCurrency;
   setCurrency: (currency: DisplayCurrency) => void;
   toggleCurrency: () => void;
   /**
    * NGN per 1 USD, fetched from PAJ onramp rates.
    */
   exchangeRate: number | null;
   isLoadingRate: boolean;
   refreshRate: () => Promise<void>;
 }

 const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

 export function CurrencyProvider({ children }: { children: ReactNode }) {
   const [currency, setCurrencyState] = useState<DisplayCurrency>(() => {
     if (typeof window !== 'undefined') {
       const stored = localStorage.getItem('zendfi-display-currency') as DisplayCurrency | null;
       if (stored === 'USD' || stored === 'NGN') return stored;
     }
     return 'USD';
   });

   const [exchangeRate, setExchangeRate] = useState<number | null>(null);
   const [isLoadingRate, setIsLoadingRate] = useState(false);

   const setCurrency = useCallback((next: DisplayCurrency) => {
     setCurrencyState(next);
     if (typeof window !== 'undefined') {
       localStorage.setItem('zendfi-display-currency', next);
     }
   }, []);

  const toggleCurrency = useCallback(() => {
    setCurrency(currency === 'USD' ? 'NGN' : 'USD');
  }, [currency, setCurrency]);

   const refreshRate = useCallback(async () => {
     setIsLoadingRate(true);
     try {
       // Reuse the same PAJ onramp endpoint used in the payment link NGN calculator.
       const response = await fetch('/api/v1/onramp/rates');
       if (!response.ok) throw new Error('Failed to fetch rates');
       const data = await response.json();
       const rate =
         data.on_ramp_rate?.rate ??
         data.onRampRate?.rate ??
         data.rates?.on_ramp_rate?.rate ??
         null;
       setExchangeRate(typeof rate === 'number' ? rate : null);
     } catch (err) {
       console.error('Failed to load display currency exchange rate:', err);
       setExchangeRate(null);
     } finally {
       setIsLoadingRate(false);
     }
   }, []);

   useEffect(() => {
     // Load rate on first mount so dashboard can immediately convert.
     refreshRate();
   }, [refreshRate]);

   return (
     <CurrencyContext.Provider
       value={{
         currency,
         setCurrency,
         toggleCurrency,
         exchangeRate,
         isLoadingRate,
         refreshRate,
       }}
     >
       {children}
     </CurrencyContext.Provider>
   );
 }

 export function useCurrency() {
   const ctx = useContext(CurrencyContext);
   if (!ctx) {
     throw new Error('useCurrency must be used within a CurrencyProvider');
   }
   return ctx;
 }

