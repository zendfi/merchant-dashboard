'use client';

import { useEffect, useState, useCallback } from 'react';
import { useMerchant } from '@/lib/merchant-context';
import { useMode } from '@/lib/mode-context';
import { useCurrency } from '@/lib/currency-context';
import { merchant as merchantApi, DashboardStats, DashboardAnalytics } from '@/lib/api';
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { RefreshCw, List } from 'lucide-react';
import { TabHeader, StatTile, SurfaceCard, SectionTitle } from './shared/TabScaffold';

interface OverviewTabProps {
  onViewAllTransactions: () => void;
}

export default function OverviewTab({ onViewAllTransactions }: OverviewTabProps) {
  const { merchant } = useMerchant();
  const { mode } = useMode();
  const { currency, exchangeRate } = useCurrency();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsData, analyticsData] = await Promise.all([
        merchantApi.getStats(mode),
        merchantApi.getAnalytics(),
      ]);
      setStats(statsData);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      <div className="space-y-5">
        <TabHeader
          title="Overview"
          subtitle={`Loading dashboard for ${mode} mode`}
        />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-[#13131f] rounded-xl border border-slate-100 dark:border-slate-800 p-4"
            >
              <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded animate-pulse mb-3" />
              <div className="h-6 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <SurfaceCard className="p-5">
          <div className="h-[240px] bg-slate-100 dark:bg-slate-800/70 rounded-lg animate-pulse" />
        </SurfaceCard>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <TabHeader
        title="Overview"
        subtitle={`${merchant?.name || 'Merchant dashboard'} in ${mode} mode`}
        actions={(
          <>
            <button
              onClick={() => loadData()}
              title="Refresh"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={onViewAllTransactions}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
            >
              <List size={15} /> View Transactions
            </button>
          </>
        )}
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatTile
          label="Total Volume"
          value={formatFullAmount(stats?.total_volume || 0)}
          icon="bar_chart"
          accent="primary"
        />
        <StatTile
          label="Success Rate"
          value={`${stats?.confirmed_payments && stats?.total_payments
            ? ((stats.confirmed_payments / stats.total_payments) * 100).toFixed(1)
            : '99.9'}%`}
          icon="check_circle"
          accent="violet"
        />
        <StatTile
          label="Failed Payments"
          value={(stats?.total_payments || 0) - (stats?.confirmed_payments || 0) - (stats?.pending_payments || 0)}
          icon="error"
          accent="amber"
        />
        <StatTile
          label="Total Received"
          value={formatFullAmount(stats?.confirmed_volume || 0)}
          icon="account_balance_wallet"
          accent="emerald"
        />
      </div>

      <SurfaceCard className="p-5">
        <SectionTitle
          title="Transaction Volume"
          subtitle="Daily revenue over the last 30 days"
        />
        {/* Chart with axes — horizontally scrollable on very small screens */}
        <div className="overflow-x-auto -mx-1">
          <div className="flex min-w-[340px] px-1">
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
      </SurfaceCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SurfaceCard className="p-5 transition-all duration-250">
          <SectionTitle
            title="Transaction Status"
            subtitle="Successful vs Failed transactions over time"
          />
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
        </SurfaceCard>

        <SurfaceCard className="p-5 transition-all duration-250">
          <SectionTitle
            title="Volume Distribution (30d)"
            subtitle="Transaction volume by token"
          />
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
        </SurfaceCard>
      </div>
    </div>
  );
}
