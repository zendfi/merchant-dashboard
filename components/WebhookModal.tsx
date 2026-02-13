'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { webhooks } from '@/lib/api';
import { useNotification } from '@/lib/notifications';

interface WebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUrl: string | null;
  onSaved: () => Promise<void> | void;
}

export default function WebhookModal({ isOpen, onClose, currentUrl, onSaved }: WebhookModalProps) {
  const { showNotification } = useNotification();
  const [webhookUrl, setWebhookUrl] = useState(currentUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update webhookUrl when currentUrl changes (e.g., after merchant refresh)
  useEffect(() => {
    if (isOpen) {
      setWebhookUrl(currentUrl || '');
      setError('');
      setSuccess('');
    }
  }, [isOpen, currentUrl]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      const result = await webhooks.update(webhookUrl.trim() || null);
      console.log('Webhook update result:', result);
      setSuccess(result.message);
      showNotification('Webhook Updated', result.message, 'success');

      // Wait for merchant context to refresh with updated webhook data
      console.log('Calling onSaved to refresh merchant...');
      await onSaved();
      console.log('onSaved completed');

      // Delay to ensure state updates propagate and UI re-renders
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update webhook');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 dark:bg-black/70 z-[9999] flex justify-center items-center backdrop-blur-sm transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-[#1f162b] rounded-2xl max-w-[500px] w-[90%] max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="p-5 px-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Update Webhook URL</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {error && (
            <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 p-4 rounded-xl mb-5 text-sm flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px]">error</span>
              {error}
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 p-4 rounded-xl mb-5 text-sm flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
              {success}
            </div>
          )}

          <form onSubmit={handleSave}>
            <div className="mb-5">
              <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
                Webhook URL
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-domain.com/webhooks"
                className="w-full p-3 px-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Enter the URL where you want to receive webhook notifications. Leave empty to disable webhooks.
              </p>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
                Webhook Events
              </label>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                You&apos;ll receive notifications for: payment.created, payment.confirmed,
                payment.failed, payment.expired, split.executed
              </p>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save Webhook'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
