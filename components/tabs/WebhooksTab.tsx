'use client';

import { useEffect, useState } from 'react';
import { webhooks, WebhookStats } from '@/lib/api';
import { useMerchant } from '@/lib/merchant-context';
import { useNotification } from '@/lib/notifications';
import WebhookModal from '@/components/WebhookModal';

export default function WebhooksTab() {
  const { merchant, refreshMerchant } = useMerchant();
  const { showNotification } = useNotification();
  const [stats, setStats] = useState<WebhookStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [showModal, setShowModal] = useState(false);

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
    setIsTesting(true);
    try {
      const result = await webhooks.test();
      
      if (result.success) {
        showNotification(
          'Webhook Test Successful',
          `Status: ${result.status_code}, Response time: ${result.response_time_ms}ms`,
          'success'
        );
      } else {
        showNotification(
          'Webhook Test Failed',
          result.error || result.message || 'Unknown error',
          'error'
        );
      }
    } catch (error) {
      showNotification(
        'Test Failed',
        error instanceof Error ? error.message : 'Failed to test webhook',
        'error'
      );
    } finally {
      setIsTesting(false);
    }
  };

  const isConfigured = !!merchant?.webhook_url;

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-[#0A2540]">Webhook Configuration</h1>
      <h2 className="mb-4 text-lg font-semibold text-[#0A2540]">Webhook Settings</h2>

      {/* Webhook Status */}
      <div
        className={`flex items-center gap-2 p-2.5 px-3 bg-white rounded-md border text-[13px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] ${
          isConfigured
            ? 'border-[#00D924] bg-[#ECFDF5]'
            : 'border-[#FF9500] bg-[#FEF3C7]'
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            isConfigured ? 'bg-[#00D924]' : 'bg-[#FF9500]'
          }`}
        />
        <strong>Webhook:</strong>{' '}
        {isConfigured
          ? `Configured at ${merchant?.webhook_url}`
          : 'Not configured - Set up webhooks to receive real-time notifications'}
      </div>

      {/* Webhook Stats */}
      {stats && stats.total_deliveries > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5 my-3">
          <div className="p-2.5 px-3 bg-white rounded-md border border-[#E3E8EE] shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <div className="text-[10px] text-[#425466] uppercase tracking-[0.6px] font-bold mb-1">
              Success Rate
            </div>
            <div className="text-lg font-bold text-[#00D924]">{stats.success_rate}%</div>
          </div>
          <div className="p-2.5 px-3 bg-white rounded-md border border-[#E3E8EE] shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <div className="text-[10px] text-[#425466] uppercase tracking-[0.6px] font-bold mb-1">
              Total Sent
            </div>
            <div className="text-lg font-bold text-[#0A2540]">{stats.total_deliveries}</div>
          </div>
          <div className="p-2.5 px-3 bg-white rounded-md border border-[#E3E8EE] shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <div className="text-[10px] text-[#425466] uppercase tracking-[0.6px] font-bold mb-1">
              Successful
            </div>
            <div className="text-lg font-bold text-[#0A2540]">{stats.successful_deliveries}</div>
          </div>
          <div className="p-2.5 px-3 bg-white rounded-md border border-[#E3E8EE] shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <div className="text-[10px] text-[#425466] uppercase tracking-[0.6px] font-bold mb-1">
              Failed
            </div>
            <div className="text-lg font-bold text-[#0A2540]">{stats.failed_deliveries}</div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-3 flex-wrap">
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 rounded-md text-[13px] font-semibold cursor-pointer transition-all inline-flex items-center gap-1.5 bg-[#635BFF] text-white border-none shadow-[0_1px_3px_rgba(0,0,0,0.12)] hover:bg-[#5449D6] hover:-translate-y-px hover:shadow-[0_2px_6px_rgba(0,0,0,0.15)]"
        >
          Update Webhook
        </button>
        <button
          onClick={handleTestWebhook}
          disabled={isTesting || !isConfigured}
          className="px-4 py-2 rounded-md text-[13px] font-semibold cursor-pointer transition-all inline-flex items-center gap-1.5 bg-white text-[#635BFF] border border-[#E3E8EE] shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:bg-[#FAFBFC] hover:border-[#635BFF] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isTesting ? 'Testing...' : 'Test Webhook'}
        </button>
      </div>

      {/* Webhook Modal */}
      <WebhookModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        currentUrl={merchant?.webhook_url || null}
        onSaved={() => {
          refreshMerchant();
          loadStats();
        }}
      />
    </div>
  );
}
