'use client';

import { useEffect, useState } from 'react';
import { useMode } from '@/lib/mode-context';
import { apiKeys as apiKeysApi, ApiKey } from '@/lib/api';
import { useNotification } from '@/lib/notifications';

export default function ApiKeysTab() {
  const { mode } = useMode();
  const { showNotification } = useNotification();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');

  useEffect(() => {
    const loadApiKeys = async () => {
      setIsLoading(true);
      try {
        const result = await apiKeysApi.list();
        setApiKeys(result.api_keys || []);
      } catch (error) {
        console.error('Failed to load API keys:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadApiKeys();
  }, []);

  const filteredKeys = apiKeys.filter((key) => key.mode === mode);

  const handleToggleKey = () => {
    showNotification(
      'Security Notice',
      'API keys cannot be retrieved after creation for security reasons. If you lost your key, use the "Regenerate" button.',
      'info'
    );
  };

  const handleRegenerateKey = async (keyId: string) => {
    if (
      !confirm(
        'WARNING: Regenerating this API key will immediately invalidate the old one. Are you sure you want to continue?'
      )
    ) {
      return;
    }

    try {
      const result = await apiKeysApi.regenerate(keyId);
      if (result.api_key) {
        setNewApiKey(result.api_key);
        setShowCopyModal(true);
      }
    } catch (error) {
      showNotification(
        'Regeneration Failed',
        error instanceof Error ? error.message : 'Unknown error occurred',
        'error'
      );
    }
  };

  const copyApiKeyFromModal = () => {
    navigator.clipboard.writeText(newApiKey).then(() => {
      showNotification('Copied!', 'API key copied to clipboard', 'success');
    });
  };

  const closeCopyModal = () => {
    setShowCopyModal(false);
    setNewApiKey('');
    apiKeysApi.list().then(res => setApiKeys(res.api_keys));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">API Keys</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Manage your API keys for integration</p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">
          <span className="material-symbols-outlined text-[14px] mr-1">check_circle</span>
          {filteredKeys.length} Active
        </span>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
          {mode === 'test' ? 'Test Mode' : 'Live Mode'}
        </span>
      </div>

      {filteredKeys.length === 0 ? (
        <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800 p-12 text-center">
          <span className="material-symbols-outlined text-[48px] text-slate-300 mb-4">key</span>
          <p className="text-slate-500 dark:text-slate-400 mb-2">No API keys found for {mode} mode.</p>
          <p className="text-sm text-slate-400">Create one via the API:</p>
          <code className="block mt-2 text-primary font-mono text-sm">POST /api/v1/merchants</code>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredKeys.map((key) => (
            <div
              key={key.id}
              className="bg-white dark:bg-[#1f162b] p-5 rounded-xl border border-slate-100 dark:border-slate-800"
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  API Key
                </span>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600">
                    Active
                  </span>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      key.mode === 'test'
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {key.mode === 'test' ? 'Test' : 'Live'}
                  </span>
                </div>
              </div>

              {/* Key Value */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
                <div className="flex-1 bg-slate-900 dark:bg-slate-800 p-3 rounded-lg font-mono text-sm text-slate-400 relative overflow-hidden">
                  <span className="block truncate tracking-widest">{'•'.repeat(32)}</span>
                  <button
                    onClick={() => handleToggleKey()}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">visibility</span>
                  </button>
                </div>
                <button
                  onClick={() => handleRegenerateKey(key.id)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">sync</span>
                  Regenerate
                </button>
              </div>

              {/* Meta */}
              <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800">
                <span className="inline-flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                  Created: {new Date(key.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">schedule</span>
                  Last used:{' '}
                  {key.last_used_at
                    ? new Date(key.last_used_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      }) +
                      ' ' +
                      new Date(key.last_used_at).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Never'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Copy Modal */}
      {showCopyModal && (
        <div
          className="fixed inset-0 bg-black/50 dark:bg-black/70 z-[1000] flex justify-center items-center backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeCopyModal();
          }}
        >
          <div className="bg-white dark:bg-[#1f162b] rounded-2xl max-w-[500px] w-[90%] shadow-2xl">
            <div className="p-5 px-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">API Key Generated</h3>
              <button
                onClick={closeCopyModal}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="p-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 p-4 rounded-xl mb-5 text-sm flex items-start gap-3">
                <span className="material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5">warning</span>
                <span>
                  <strong>Important:</strong> Copy this API key now. For security reasons, you
                  won&apos;t be able to see it again.
                </span>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
                  Your New API Key
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={newApiKey}
                    readOnly
                    className="w-full p-3 pr-24 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                  <button
                    onClick={copyApiKeyFromModal}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-md hover:bg-primary/90 transition-colors inline-flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    Copy
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Store this in your <code className="text-primary">.env</code> file as <code className="text-primary">ZENDFI_API_KEY</code>
                </p>
              </div>

              <button
                onClick={closeCopyModal}
                className="w-full px-4 py-3 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-colors"
              >
                I&apos;ve copied it safely
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
