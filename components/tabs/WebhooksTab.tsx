'use client';

import { useState, useEffect } from 'react';
import { webhooks, WebhookStats } from '@/lib/api';
import { useMerchant } from '@/lib/merchant-context';
import { useNotification } from '@/lib/notifications';
import WebhookModal from '@/components/WebhookModal';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function WebhooksTab() {
  const { merchant, refreshMerchant } = useMerchant();
  const { showNotification } = useNotification();
  const [stats, setStats] = useState<WebhookStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const isConfigured = !!(merchant?.webhook_url);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const data = await webhooks.getStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load webhook stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!isConfigured) {
      showNotification('Error', 'Please configure your webhook URL first', 'error');
      return;
    }
    setIsTesting(true);
    try {
      await webhooks.test();
      showNotification('Test Sent!', 'A test webhook event has been sent to your endpoint', 'success');
    } catch (error) {
      showNotification('Test Failed', error instanceof Error ? error.message : 'Failed to send test webhook', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const statCards = [
    {
      label: 'Success Rate',
      value: stats ? `${parseFloat(stats.success_rate || '0').toFixed(1)}%` : '—',
      icon: 'trending_up',
      color: 'emerald',
    },
    {
      label: 'Total Sent',
      value: stats?.total_deliveries?.toLocaleString() || '0',
      icon: 'send',
      color: 'primary',
    },
    {
      label: 'Successful',
      value: stats?.successful_deliveries?.toLocaleString() || '0',
      icon: 'check_circle',
      color: 'emerald',
    },
    {
      label: 'Failed',
      value: stats?.failed_deliveries?.toLocaleString() || '0',
      icon: 'error',
      color: 'rose',
    },
  ];

  const colorMap: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
    emerald: {
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      text: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-100 dark:border-emerald-800',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    },
    primary: {
      bg: 'bg-primary/5 dark:bg-primary/10',
      text: 'text-primary',
      border: 'border-primary/10 dark:border-primary/20',
      iconBg: 'bg-primary/10 dark:bg-primary/20',
    },
    rose: {
      bg: 'bg-rose-50 dark:bg-rose-900/20',
      text: 'text-rose-600 dark:text-rose-400',
      border: 'border-rose-100 dark:border-rose-800',
      iconBg: 'bg-rose-100 dark:bg-rose-900/40',
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Webhooks</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Receive real-time notifications for payment events</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleTestWebhook}
            disabled={isTesting || !isConfigured}
            className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-semibold text-sm cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
            {isTesting ? 'Sending...' : 'Test Webhook'}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm cursor-pointer transition-all hover:bg-primary/90 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">{isConfigured ? 'edit' : 'add'}</span>
            {isConfigured ? 'Update Webhook' : 'Configure Webhook'}
          </button>
        </div>
      </div>

      {/* Status Banner */}
      {isConfigured ? (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-xl">check_circle</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Webhook Active</div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 truncate">{merchant?.webhook_url}</div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
            <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-xl">warning</span>
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-amber-800 dark:text-amber-300">No Webhook Configured</div>
            <div className="text-xs text-amber-600 dark:text-amber-400">Set up a webhook URL to receive real-time payment notifications</div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const colors = colorMap[card.color] || colorMap.primary;
          return (
            <div
              key={card.label}
              className="bg-white dark:bg-[#1f162b] p-5 rounded-xl border border-slate-100 dark:border-slate-800"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg ${colors.iconBg} flex items-center justify-center`}>
                  <span className={`material-symbols-outlined text-[20px] ${colors.text}`}>{card.icon}</span>
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mb-0.5">
                {isLoading ? '—' : card.value}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{card.label}</div>
            </div>
          );
        })}
      </div>

      {/* Webhook Delivery Chart */}
      <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Delivery History</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Successful vs Failed webhook deliveries over the last 30 days</p>
        </div>
        <div className="p-5">
          {isLoading ? (
            <div className="h-[300px] flex items-center justify-center">
              <div className="text-slate-400 dark:text-slate-500">Loading chart data...</div>
            </div>
          ) : stats?.chart_data && stats.chart_data.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.chart_data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  tick={{ fill: '#64748b' }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis stroke="#94a3b8" tick={{ fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f162b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  labelFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString();
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="successful"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Successful"
                  dot={{ fill: '#10b981' }}
                />
                <Line
                  type="monotone"
                  dataKey="failed"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  name="Failed"
                  dot={{ fill: '#f43f5e' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center">
              <div className="text-center">
                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-5xl mb-2">insert_chart</span>
                <p className="text-slate-500 dark:text-slate-400">No webhook delivery data yet</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Webhook Modal */}
      <WebhookModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        currentUrl={merchant?.webhook_url || null}
        onSaved={async () => {
          await refreshMerchant(); // Refresh merchant profile to get updated webhook_url
          await loadStats(); // Refresh webhook stats
        }}
      />
    </div>
  );
}
