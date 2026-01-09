'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useMerchant } from '@/lib/merchant-context';
import { useMode } from '@/lib/mode-context';
import { merchant as merchantApi, DashboardStats, DashboardAnalytics } from '@/lib/api';

interface OverviewTabProps {
  onViewAllTransactions: () => void;
}

// Custom tooltip component for consistent styling
const CustomTooltip = ({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ value: number; color: string }>;
  label?: string;
  formatter?: (value: number) => string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0A2540] px-3 py-2 rounded-lg shadow-lg border border-[#635bff]/30">
        <p className="text-[11px] text-gray-400 mb-1">{label}</p>
        <p className="text-white font-semibold text-sm">
          {formatter ? formatter(payload[0].value) : payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

export default function OverviewTab({ onViewAllTransactions }: OverviewTabProps) {
  const { merchant } = useMerchant();
  const { mode } = useMode();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
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
    };

    loadData();
  }, [mode]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Transform data for Recharts
  const transactionsData = analytics?.payments_chart.map((d) => ({
    date: formatDate(d.date),
    value: d.value,
  })) || [];

  const volumeData = analytics?.volume_chart.map((d) => ({
    date: formatDate(d.date),
    value: d.value,
  })) || [];

  const apiCallsData = analytics?.api_calls_chart.map((d) => ({
    date: formatDate(d.date),
    value: d.value,
  })) || [];

  const successRateData = analytics?.success_rate_chart.map((d) => ({
    date: formatDate(d.date),
    value: d.value,
  })) || [];

  // Suppress unused variable warning
  void onViewAllTransactions;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-[#635BFF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Welcome Section */}
      <div className="mb-5">
        <h1 className="text-[28px] font-semibold mb-1 text-[#0A2540] tracking-[-0.4px] leading-tight flex items-center gap-2">
          Welcome back, {merchant?.name || 'Merchant'}!
          <svg
            className="w-[18px] h-[18px]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeWidth="2"
              strokeLinecap="round"
              d="M7 12c0-4 3-7 7-7s7 3 7-7 7-3 7-7M7 12c0 4-3 7-7 7"
            />
          </svg>
        </h1>
        <p className="text-[#425466] text-[13px]">
          Customer since{' '}
          {merchant?.created_at
            ? new Date(merchant.created_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })
            : 'N/A'}{' '}
          · Account ID: <code className="text-xs">{merchant?.id}</code>
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 mb-5">
        <div className="bg-white rounded-lg border border-[#E3E8EE] p-4 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:-translate-y-px hover:shadow-[0_2px_6px_rgba(0,0,0,0.1)]">
          <div className="text-[#425466] text-[11px] font-semibold uppercase tracking-[0.6px] mb-2">
            Total Payments
          </div>
          <div className="text-[32px] font-bold text-[#0A2540] leading-none tracking-[-0.5px]">
            {stats?.total_payments || 0}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-[#E3E8EE] p-4 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:-translate-y-px hover:shadow-[0_2px_6px_rgba(0,0,0,0.1)]">
          <div className="text-[#425466] text-[11px] font-semibold uppercase tracking-[0.6px] mb-2">
            Total Volume
          </div>
          <div className="text-[32px] font-bold text-[#00D924] leading-none tracking-[-0.5px]">
            ${(stats?.total_volume || 0).toFixed(2)}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-[#E3E8EE] p-4 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:-translate-y-px hover:shadow-[0_2px_6px_rgba(0,0,0,0.1)]">
          <div className="text-[#425466] text-[11px] font-semibold uppercase tracking-[0.6px] mb-2">
            Confirmed
          </div>
          <div className="text-[32px] font-bold text-[#00D924] leading-none tracking-[-0.5px]">
            {stats?.confirmed_payments || 0}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-[#E3E8EE] p-4 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:-translate-y-px hover:shadow-[0_2px_6px_rgba(0,0,0,0.1)]">
          <div className="text-[#425466] text-[11px] font-semibold uppercase tracking-[0.6px] mb-2">
            Pending
          </div>
          <div className="text-[32px] font-bold text-[#FF9500] leading-none tracking-[-0.5px]">
            {stats?.pending_payments || 0}
          </div>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="mt-8">
        <h2 className="mb-5 text-[#1A1F36] text-lg font-semibold">Analytics</h2>
        <div className="grid grid-cols-2 gap-5 mb-8">
          {/* Transactions Chart */}
          <div className="bg-white rounded-xl p-5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] border border-[#E3E8EE]">
            <h3 className="mb-4 text-[#697386] text-[13px] font-semibold uppercase tracking-[0.5px]">
              Transactions (30 Days)
            </h3>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={transactionsData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="transactionsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#635bff" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#635bff" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3E8EE" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: '#697386', fontSize: 10 }} 
                    tickLine={false}
                    axisLine={{ stroke: '#E3E8EE' }}
                  />
                  <YAxis 
                    tick={{ fill: '#697386', fontSize: 10 }} 
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip formatter={(v) => `${v} transactions`} />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#635bff"
                    strokeWidth={2.5}
                    fill="url(#transactionsGradient)"
                    dot={{ fill: '#635bff', strokeWidth: 2, stroke: '#fff', r: 4 }}
                    activeDot={{ fill: '#635bff', strokeWidth: 2, stroke: '#fff', r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Volume Chart */}
          <div className="bg-white rounded-xl p-5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] border border-[#E3E8EE]">
            <h3 className="mb-4 text-[#697386] text-[13px] font-semibold uppercase tracking-[0.5px]">
              Volume (USD)
            </h3>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3E8EE" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: '#697386', fontSize: 10 }} 
                    tickLine={false}
                    axisLine={{ stroke: '#E3E8EE' }}
                  />
                  <YAxis 
                    tick={{ fill: '#697386', fontSize: 10 }} 
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip content={<CustomTooltip formatter={(v) => `$${v.toFixed(2)}`} />} />
                  <Bar 
                    dataKey="value" 
                    fill="url(#volumeGradient)" 
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* API Calls Chart */}
          <div className="bg-white rounded-xl p-5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] border border-[#E3E8EE]">
            <h3 className="mb-4 text-[#697386] text-[13px] font-semibold uppercase tracking-[0.5px]">
              API Calls (30 Days)
            </h3>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={apiCallsData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="apiCallsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3E8EE" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: '#697386', fontSize: 10 }} 
                    tickLine={false}
                    axisLine={{ stroke: '#E3E8EE' }}
                  />
                  <YAxis 
                    tick={{ fill: '#697386', fontSize: 10 }} 
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip formatter={(v) => `${v} calls`} />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    fill="url(#apiCallsGradient)"
                    dot={{ fill: '#f59e0b', strokeWidth: 2, stroke: '#fff', r: 4 }}
                    activeDot={{ fill: '#f59e0b', strokeWidth: 2, stroke: '#fff', r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Success Rate Chart */}
          <div className="bg-white rounded-xl p-5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] border border-[#E3E8EE]">
            <h3 className="mb-4 text-[#697386] text-[13px] font-semibold uppercase tracking-[0.5px]">
              Success Rate (%)
            </h3>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={successRateData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="successRateGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3E8EE" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: '#697386', fontSize: 10 }} 
                    tickLine={false}
                    axisLine={{ stroke: '#E3E8EE' }}
                  />
                  <YAxis 
                    tick={{ fill: '#697386', fontSize: 10 }} 
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip content={<CustomTooltip formatter={(v) => `${v.toFixed(1)}%`} />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    fill="url(#successRateGradient)"
                    dot={{ fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff', r: 4 }}
                    activeDot={{ fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff', r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
