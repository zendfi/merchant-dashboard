'use client';

import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { useMerchant } from '@/lib/merchant-context';
import { useMode } from '@/lib/mode-context';
import { merchant as merchantApi, DashboardStats, DashboardAnalytics } from '@/lib/api';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface OverviewTabProps {
  onViewAllTransactions: () => void;
}

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

  // Chart default options
  const chartDefaults = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 2.5,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0A2540',
        padding: 8,
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#635bff',
        borderWidth: 1,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { font: { size: 10 } },
      },
      x: {
        ticks: { font: { size: 10 } },
      },
    },
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Prepare chart data
  const transactionsChartData = {
    labels: analytics?.payments_chart.map((d) => formatDate(d.date)) || [],
    datasets: [
      {
        label: 'Confirmed Transactions',
        data: analytics?.payments_chart.map((d) => d.value) || [],
        borderColor: '#635bff',
        backgroundColor: 'rgba(99, 91, 255, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#635bff',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverRadius: 6,
      },
    ],
  };

  const volumeChartData = {
    labels: analytics?.volume_chart.map((d) => formatDate(d.date)) || [],
    datasets: [
      {
        label: 'Volume (USD)',
        data: analytics?.volume_chart.map((d) => d.value) || [],
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderColor: '#10b981',
        borderWidth: 1,
      },
    ],
  };

  const apiCallsChartData = {
    labels: analytics?.api_calls_chart.map((d) => formatDate(d.date)) || [],
    datasets: [
      {
        label: 'API Calls',
        data: analytics?.api_calls_chart.map((d) => d.value) || [],
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#f59e0b',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverRadius: 6,
      },
    ],
  };

  const successRateChartData = {
    labels: analytics?.success_rate_chart.map((d) => formatDate(d.date)) || [],
    datasets: [
      {
        label: 'Success Rate (%)',
        data: analytics?.success_rate_chart.map((d) => d.value) || [],
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#8b5cf6',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverRadius: 6,
      },
    ],
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="spinner spinner-dark" />
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
          <div className="bg-white rounded-xl p-5 shadow-[0_2px_4px_rgba(0,0,0,0.05)]">
            <h3 className="mb-3 text-[#697386] text-[13px] font-semibold uppercase tracking-[0.5px]">
              Transactions (30 Days)
            </h3>
            <div className="max-h-[200px]">
              <Line data={transactionsChartData} options={chartDefaults as never} />
            </div>
          </div>

          {/* Volume Chart */}
          <div className="bg-white rounded-xl p-5 shadow-[0_2px_4px_rgba(0,0,0,0.05)]">
            <h3 className="mb-3 text-[#697386] text-[13px] font-semibold uppercase tracking-[0.5px]">
              Volume (USD)
            </h3>
            <div className="max-h-[200px]">
              <Bar
                data={volumeChartData}
                options={{
                  ...chartDefaults,
                  plugins: {
                    ...chartDefaults.plugins,
                    tooltip: {
                      ...chartDefaults.plugins.tooltip,
                      callbacks: {
                        label: (context: { parsed: { y: number } }) =>
                          '$' + context.parsed.y.toFixed(2),
                      },
                    },
                  },
                  scales: {
                    ...chartDefaults.scales,
                    y: {
                      ...chartDefaults.scales.y,
                      ticks: {
                        ...chartDefaults.scales.y.ticks,
                        callback: (value: number | string) => '$' + Number(value).toFixed(0),
                      },
                    },
                  },
                } as never}
              />
            </div>
          </div>

          {/* API Calls Chart */}
          <div className="bg-white rounded-xl p-5 shadow-[0_2px_4px_rgba(0,0,0,0.05)]">
            <h3 className="mb-3 text-[#697386] text-[13px] font-semibold uppercase tracking-[0.5px]">
              API Calls (30 Days)
            </h3>
            <div className="max-h-[200px]">
              <Line data={apiCallsChartData} options={chartDefaults as never} />
            </div>
          </div>

          {/* Success Rate Chart */}
          <div className="bg-white rounded-xl p-5 shadow-[0_2px_4px_rgba(0,0,0,0.05)]">
            <h3 className="mb-3 text-[#697386] text-[13px] font-semibold uppercase tracking-[0.5px]">
              Success Rate (%)
            </h3>
            <div className="max-h-[200px]">
              <Line
                data={successRateChartData}
                options={{
                  ...chartDefaults,
                  plugins: {
                    ...chartDefaults.plugins,
                    tooltip: {
                      ...chartDefaults.plugins.tooltip,
                      callbacks: {
                        label: (context: { parsed: { y: number } }) =>
                          context.parsed.y.toFixed(1) + '%',
                      },
                    },
                  },
                  scales: {
                    ...chartDefaults.scales,
                    y: {
                      beginAtZero: true,
                      max: 100,
                      ticks: {
                        font: { size: 10 },
                        callback: (value: number | string) => value + '%',
                      },
                    },
                  },
                } as never}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
