'use client';

import { useState } from 'react';
import { webhooks, WebhookStats } from '@/lib/api';
import { useNotification } from '@/lib/notifications';

interface WebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUrl: string | null;
  onSaved: () => void;
}

export default function WebhookModal({ isOpen, onClose, currentUrl, onSaved }: WebhookModalProps) {
  const { showNotification } = useNotification();
  const [webhookUrl, setWebhookUrl] = useState(currentUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      const result = await webhooks.update(webhookUrl.trim() || null);
      setSuccess(result.message);
      showNotification('Webhook Updated', result.message, 'success');
      setTimeout(() => {
        onClose();
        onSaved();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update webhook');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-[rgba(10,37,64,0.6)] z-[1000] flex justify-center items-center backdrop-blur-[4px] transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl max-w-[500px] w-[90%] max-h-[90vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
        {/* Header */}
        <div className="bg-white p-5 px-6 border-b border-[#E3E8EE] rounded-t-xl flex justify-between items-center">
          <h3 className="text-base font-bold text-[#0A2540] m-0">Update Webhook URL</h3>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-xl text-[#425466] cursor-pointer p-0 w-7 h-7 flex items-center justify-center rounded-full transition-all hover:bg-[#F6F9FC] hover:text-[#0A2540]"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {error && (
            <div className="bg-[#FEE2E2] border border-[#EF4444] text-[#991B1B] p-3 rounded-lg mb-4 text-sm flex items-center gap-1.5">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4 inline-block align-text-bottom"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {error}
            </div>
          )}

          {success && (
            <div className="bg-[#ECFDF5] border border-[#00D66C] text-[#065F46] p-3 rounded-lg mb-4 text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSave}>
            <div className="mb-5">
              <label className="block text-sm font-semibold text-[#1A1F36] mb-2">
                Webhook URL
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-domain.com/webhooks"
                className="w-full p-3 px-4 border border-[#E3E8EE] rounded-lg text-sm font-sans transition-all focus:outline-none focus:border-[#5B6EE8] focus:shadow-[0_0_0_3px_rgba(91,110,232,0.1)]"
              />
              <p className="text-xs text-[#697386] mt-1.5">
                Enter the URL where you want to receive webhook notifications. Leave empty to
                disable webhooks.
              </p>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-semibold text-[#1A1F36] mb-2">
                Webhook Events
              </label>
              <div className="text-xs text-[#697386]">
                You&apos;ll receive notifications for: payment.created, payment.confirmed,
                payment.failed, payment.expired, split.executed
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-md text-[13px] font-semibold cursor-pointer transition-all bg-white text-[#635BFF] border border-[#E3E8EE] shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:bg-[#FAFBFC] hover:border-[#635BFF]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 rounded-md text-[13px] font-semibold cursor-pointer transition-all bg-[#635BFF] text-white border-none shadow-[0_1px_3px_rgba(0,0,0,0.12)] hover:bg-[#5449D6] hover:-translate-y-px hover:shadow-[0_2px_6px_rgba(0,0,0,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save Webhook'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
