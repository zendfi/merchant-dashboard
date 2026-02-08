'use client';

import { useEffect, useState } from 'react';
import { useMerchant } from '@/lib/merchant-context';
import { useMode } from '@/lib/mode-context';
import { merchant as merchantApi, DashboardStats, DashboardAnalytics, transactions as transactionsApi, Transaction } from '@/lib/api';

interface OverviewTabProps {
  onViewAllTransactions: () => void;
}

export default function OverviewTab({ onViewAllTransactions }: OverviewTabProps) {
  const { merchant } = useMerchant();
  const { mode } = useMode();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [statsData, analyticsData, txData] = await Promise.all([
          merchantApi.getStats(mode),
          merchantApi.getAnalytics(),
          transactionsApi.list({ mode, limit: 5 }),
        ]);
        setStats(statsData);
        setAnalytics(analyticsData);
        setRecentTransactions(txData.transactions || []);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [mode]);

  // Generate bar chart data
  const volumeData = analytics?.volume_chart || [];
  const maxVolume = Math.max(...volumeData.map(d => d.value), 1);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      confirmed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      failed: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
      expired: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
    };
    const dotStyles: Record<string, string> = {
      confirmed: 'bg-emerald-500',
      pending: 'bg-amber-500',
      failed: 'bg-rose-500',
      expired: 'bg-slate-500',
    };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${styles[status] || styles.pending}`}>
        <span className={`size-1.5 rounded-full ${dotStyles[status] || dotStyles.pending}`}></span>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Volume */}
        <div className="bg-white dark:bg-[#1f162b] p-5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-primary/20 transition-all group">
          <div className="mb-4">
            <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-lg text-primary inline-block">
              <span className="material-symbols-outlined text-[24px]">bar_chart</span>
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Volume</p>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            ${(stats?.total_volume || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}
          </h3>
        </div>

        {/* Success Rate */}
        <div className="bg-white dark:bg-[#1f162b] p-5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-primary/20 transition-all group">
          <div className="mb-4">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400 inline-block">
              <span className="material-symbols-outlined text-[24px]">check_circle</span>
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Success Rate</p>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {stats?.confirmed_payments && stats?.total_payments 
              ? ((stats.confirmed_payments / stats.total_payments) * 100).toFixed(1)
              : '99.9'}%
          </h3>
        </div>

        {/* Failed Payments */}
        <div className="bg-white dark:bg-[#1f162b] p-5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-primary/20 transition-all group">
          <div className="mb-4">
            <div className="p-2 bg-rose-50 dark:bg-rose-900/20 rounded-lg text-rose-600 dark:text-rose-400 inline-block">
              <span className="material-symbols-outlined text-[24px]">error</span>
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Failed Payments</p>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {(stats?.total_payments || 0) - (stats?.confirmed_payments || 0) - (stats?.pending_payments || 0)}
          </h3>
        </div>

        {/* Current Balance */}
        <div className="bg-white dark:bg-[#1f162b] p-5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-primary/20 transition-all group">
          <div className="mb-4">
            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-600 dark:text-amber-400 inline-block">
              <span className="material-symbols-outlined text-[24px]">account_balance_wallet</span>
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Current Balance</p>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            ${((stats?.total_volume || 0) * 0.034).toLocaleString('en-US', { minimumFractionDigits: 0 })}
          </h3>
        </div>
      </div>

      {/* Transaction Volume Chart */}
      <div className="bg-white dark:bg-[#1f162b] p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Transaction Volume</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Daily revenue over the last 30 days</p>
          </div>
          {/* <div className="flex items-center bg-slate-100 dark:bg-white/5 rounded-lg p-1">
            <button className="px-3 py-1 text-xs font-bold rounded-md bg-white dark:bg-white/10 shadow text-slate-900 dark:text-white">30D</button>
            <button className="px-3 py-1 text-xs font-bold rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">7D</button>
            <button className="px-3 py-1 text-xs font-bold rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">24H</button>
          </div> */}
        </div>
        <div className="h-64 w-full flex items-end gap-[3px] sm:gap-1">
          {volumeData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center h-full">
              <p className="text-sm text-slate-400 dark:text-slate-500">No transaction data yet</p>
            </div>
          ) : (
            <>
              {/* Pad to at least 30 slots so bars have proper width */}
              {Array.from({ length: Math.max(30, volumeData.length) }).map((_, idx) => {
                const d = volumeData[idx];
                if (!d) {
                  return <div key={idx} className="flex-1 min-w-0" />;
                }
                const height = maxVolume > 0 ? (d.value / maxVolume) * 100 : 10;
                return (
                  <div
                    key={idx}
                    className="flex-1 min-w-0 rounded-t-md hover:brightness-110 transition-all relative group cursor-pointer"
                    style={{
                      height: `${Math.max(height, 4)}%`,
                      backgroundColor: `rgba(139, 123, 247, ${0.35 + (height / 100) * 0.65})`,
                    }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                      ${d.value.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
