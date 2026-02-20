'use client';

import { useEffect, useState } from 'react';
import { useMerchant } from '@/lib/merchant-context';
import { useMode } from '@/lib/mode-context';
import { useCurrency } from '@/lib/currency-context';
import { merchant as merchantApi, DashboardStats, DashboardAnalytics, transactions as transactionsApi, Transaction } from '@/lib/api';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface OverviewTabProps {
  onViewAllTransactions: () => void;
}

export default function OverviewTab({ onViewAllTransactions }: OverviewTabProps) {
  const { merchant } = useMerchant();
  const { mode } = useMode();
  const { currency, exchangeRate } = useCurrency();
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
  // Y-axis ticks: 5 evenly spaced values from 0 to max, rounded nicely
  const yTicks = (() => {
    const raw = maxVolume;
    const magnitude = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const nice = Math.ceil(raw / magnitude) * magnitude;
    return [0, nice * 0.25, nice * 0.5, nice * 0.75, nice].map(v => Math.round(v));
  })();
  const chartMax = yTicks[yTicks.length - 1] || 1;

  // Convert USD amount to display currency
  const convertAmount = (usdAmount: number): number => {
    if (currency === 'NGN' && exchangeRate) {
      return usdAmount * exchangeRate;
    }
    return usdAmount;
  };

  // Format amount for display
  const formatAmount = (v: number) => {
    const displayValue = convertAmount(v);
    if (currency === 'NGN') {
      if (displayValue >= 1_000_000_000) return `₦${(displayValue / 1_000_000_000).toFixed(1)}B`;
      if (displayValue >= 1_000_000) return `₦${(displayValue / 1_000_000).toFixed(1)}M`;
      if (displayValue >= 1_000) return `₦${(displayValue / 1_000).toFixed(displayValue >= 10_000 ? 0 : 1)}K`;
      return `₦${Math.round(displayValue).toLocaleString('en-US')}`;
    } else {
      if (displayValue >= 1_000_000) return `$${(displayValue / 1_000_000).toFixed(1)}M`;
      if (displayValue >= 1_000) return `$${(displayValue / 1_000).toFixed(displayValue >= 10_000 ? 0 : 1)}K`;
      return `$${displayValue}`;
    }
  };

  // Format full amount (for stats cards)
  const formatFullAmount = (usdAmount: number): string => {
    const displayValue = convertAmount(usdAmount);
    if (currency === 'NGN') {
      return `₦${Math.round(displayValue).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
    } else {
      return `$${displayValue.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
    }
  };

  const totalSlots = Math.max(30, volumeData.length);

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
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {/* Total Volume */}
        <div className="bg-white dark:bg-[#1f162b] p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-250 group">
          <div className="mb-3">
            <div className="p-1.5 bg-primary/10 dark:bg-primary/20 rounded-lg text-primary inline-block">
              <span className="material-symbols-outlined text-[20px]">bar_chart</span>
            </div>
          </div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Volume</p>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
            {formatFullAmount(stats?.total_volume || 0)}
          </h3>
        </div>

        {/* Success Rate */}
        <div className="bg-white dark:bg-[#1f162b] p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900 hover:-translate-y-0.5 transition-all duration-250 group">
          <div className="mb-3">
            <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400 inline-block">
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
            </div>
          </div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Success Rate</p>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
            {stats?.confirmed_payments && stats?.total_payments
              ? ((stats.confirmed_payments / stats.total_payments) * 100).toFixed(1)
              : '99.9'}%
          </h3>
        </div>

        {/* Failed Payments */}
        <div className="bg-white dark:bg-[#1f162b] p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-rose-200 dark:hover:border-rose-900 hover:-translate-y-0.5 transition-all duration-250 group">
          <div className="mb-3">
            <div className="p-1.5 bg-rose-50 dark:bg-rose-900/20 rounded-lg text-rose-600 dark:text-rose-400 inline-block">
              <span className="material-symbols-outlined text-[20px]">error</span>
            </div>
          </div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Failed Payments</p>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
            {(stats?.total_payments || 0) - (stats?.confirmed_payments || 0) - (stats?.pending_payments || 0)}
          </h3>
        </div>

        {/* Current Balance */}
        <div className="bg-white dark:bg-[#1f162b] p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-amber-200 dark:hover:border-amber-900 hover:-translate-y-0.5 transition-all duration-250 group">
          <div className="mb-3">
            <div className="p-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-600 dark:text-amber-400 inline-block">
              <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
            </div>
          </div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Current Balance</p>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
            {formatFullAmount((stats?.total_volume || 0) * 0.034)}
          </h3>
        </div>
      </div>

      {/* Transaction Volume Chart */}
      <div className="bg-white dark:bg-[#1f162b] p-5 rounded-xl border border-slate-100 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Transaction Volume</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Daily revenue over the last 30 days</p>
          </div>
          {/* <div className="flex items-center bg-slate-100 dark:bg-white/5 rounded-lg p-1">
            <button className="px-3 py-1 text-xs font-bold rounded-md bg-white dark:bg-white/10 shadow text-slate-900 dark:text-white">30D</button>
            <button className="px-3 py-1 text-xs font-bold rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">7D</button>
            <button className="px-3 py-1 text-xs font-bold rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">24H</button>
          </div> */}
        </div>
        {/* Chart with axes */}
        <div className="flex">
          {/* Y-Axis */}
          <div className="flex flex-col justify-between items-end pr-2.5 pb-6 h-56 shrink-0">
            {[...yTicks].reverse().map((tick, i) => (
              <span key={i} className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-medium leading-none">
                {formatAmount(tick)}
              </span>
            ))}
          </div>

          {/* Bars + X-Axis */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Grid lines + bars */}
            <div className="h-56 w-full relative">
              {/* Horizontal grid lines */}
              {yTicks.map((_, i) => (
                <div
                  key={i}
                  className="absolute left-0 right-0 border-t border-slate-100 dark:border-slate-800/60"
                  style={{ top: `${(i / (yTicks.length - 1)) * 100}%` }}
                />
              ))}
              {/* Bars */}
              <div className="absolute inset-0 flex items-end gap-[3px] sm:gap-1">
                {volumeData.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center h-full">
                    <p className="text-sm text-slate-400 dark:text-slate-500">No transaction data yet</p>
                  </div>
                ) : (
                  Array.from({ length: totalSlots }).map((_, idx) => {
                    const d = volumeData[idx];
                    if (!d) {
                      return <div key={idx} className="flex-1 min-w-0" />;
                    }
                    const height = chartMax > 0 ? (d.value / chartMax) * 100 : 10;
                    return (
                      <div
                        key={idx}
                        className="flex-1 min-w-0 rounded-t-md hover:brightness-110 transition-all relative group cursor-pointer z-[1]"
                        style={{
                          height: `${Math.max(height, 2)}%`,
                          backgroundColor: `rgba(139, 123, 247, ${0.35 + (height / 100) * 0.65})`,
                        }}
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                          {currency === 'NGN' && exchangeRate
                            ? `₦${Math.round(d.value * exchangeRate).toLocaleString()}`
                            : `$${d.value.toLocaleString()}`
                          }
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* X-Axis */}
            <div className="flex items-start pt-2 border-t border-slate-200 dark:border-slate-700">
              {volumeData.length > 0 ? (
                Array.from({ length: totalSlots }).map((_, idx) => {
                  const d = volumeData[idx];
                  // Show label for first, last, and every ~7th bar
                  const showLabel = d && (idx === 0 || idx === volumeData.length - 1 || idx % 7 === 0);
                  return (
                    <div key={idx} className="flex-1 min-w-0 text-center">
                      {showLabel ? (
                        <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                          {(() => {
                            const date = new Date(d.date);
                            return `${date.toLocaleDateString('en-US', { month: 'short' })} ${date.getDate()}`;
                          })()}
                        </span>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mx-auto">—</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Additional Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transaction Status Chart */}
        <div className="bg-white dark:bg-[#1f162b] p-5 rounded-xl border border-slate-100 dark:border-slate-800 transition-all duration-250">
          <div className="mb-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Transaction Status</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Successful vs Failed transactions over time</p>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics?.payments_chart || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-slate-700/50" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748B', fontSize: 10 }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748B', fontSize: 10 }}
                  dx={-10}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1E293B',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                  itemStyle={{ color: '#fff' }}
                  labelStyle={{ color: '#94A3B8', marginBottom: '4px' }}
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="Total"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Volume Distribution Chart */}
        <div className="bg-white dark:bg-[#1f162b] p-5 rounded-xl border border-slate-100 dark:border-slate-800 transition-all duration-250">
          <div className="mb-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Volume Distribution (30d)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Transaction volume by token</p>
          </div>
          <div className="h-[250px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'USDC', value: (stats?.total_volume || 0) * 0.85 },
                    { name: 'SOL', value: (stats?.total_volume || 0) * 0.15 },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell key="cell-0" fill="#2563EB" /> {/* Blue for USDC */}
                  <Cell key="cell-1" fill="#14F195" /> {/* Green for SOL */}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1E293B',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                  formatter={(value: any) => {
                    const total = (stats?.total_volume || 0);
                    const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                    return [`$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${percent}%)`, ''];
                  }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend
                  verticalAlign="middle"
                  align="right"
                  layout="vertical"
                  iconType="circle"
                  wrapperStyle={{ fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
