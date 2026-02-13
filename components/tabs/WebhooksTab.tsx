'use client';

import { useState, useEffect } from 'react';
import { webhooks, WebhookStats } from '@/lib/api';
import { useMerchant } from '@/lib/merchant-context';
import { useNotification } from '@/lib/notifications';
import WebhookModal from '@/components/WebhookModal';

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

  const webhookEvents = [
    { name: 'payment.completed', description: 'When a payment is successfully completed' },
    { name: 'payment.failed', description: 'When a payment fails or is declined' },
    { name: 'payment.pending', description: 'When a payment is initiated and pending' },
    { name: 'payment.expired', description: 'When a payment link expires without completion' },
    { name: 'payout.completed', description: 'When a payout is successfully sent' },
    { name: 'payout.failed', description: 'When a payout fails to process' },
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

      {/* Webhook Events */}
      <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Supported Events</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Events that will be sent to your webhook endpoint</p>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {webhookEvents.map((event) => (
            <div key={event.name} className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-[18px]">webhook</span>
                </div>
                <div>
                  <div className="font-mono text-sm font-semibold text-slate-900 dark:text-white">{event.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{event.description}</div>
                </div>
              </div>
              <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase">Active</span>
            </div>
          ))}
        </div>
      </div>

      {/* Webhook Payload Example */}
      <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Example Payload</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">This is the JSON payload sent to your webhook URL</p>
        </div>
        <div className="p-5">
          <pre className="bg-slate-50 dark:bg-[#281e36] rounded-xl p-4 border border-slate-100 dark:border-slate-800 text-sm font-mono text-slate-900 dark:text-slate-300 overflow-x-auto">
{`{
  "event": "payment.completed",
  "data": {
    "id": "pay_1234567890",
    "amount": 10.00,
    "token": "USDC",
    "status": "completed",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "timestamp": "2024-01-15T10:30:05Z"
}`}
          </pre>
        </div>
      </div>

      {/* Webhook Modal */}
      <WebhookModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        currentUrl={merchant?.webhook_url || null}
        onSaved={async () => {
          setShowModal(false);
          await refreshMerchant(); // Refresh merchant profile to get updated webhook_url
          loadStats();
        }}
      />
    </div>
  );
}
