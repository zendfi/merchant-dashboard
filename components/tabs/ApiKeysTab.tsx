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

  const handleToggleKey = (keyId: string) => {
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
    // Reload API keys
    apiKeysApi.list().then(res => setApiKeys(res.api_keys));
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
      <h1 className="mb-6 text-xl font-semibold text-[#0A2540]">API Keys</h1>
      <h2 className="mb-4 text-lg font-semibold text-[#0A2540] flex items-center gap-2">
        API Keys{' '}
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-[10px] uppercase tracking-[0.5px] bg-[#D1FAE5] text-[#065F46]">
          {filteredKeys.length} Active
        </span>
      </h2>

      {filteredKeys.length === 0 ? (
        <div className="text-center py-12 text-[#697386]">
          <p>No API keys found for {mode} mode. Create one via the API:</p>
          <code className="block mt-2 text-[#635BFF]">POST /api/v1/merchants</code>
        </div>
      ) : (
        filteredKeys.map((key) => (
          <div
            key={key.id}
            className="bg-white p-3.5 px-4 rounded-lg border border-[#E3E8EE] mb-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-3">
              <span className="text-[11px] text-[#425466] font-bold uppercase tracking-[0.6px]">
                API Key
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-[10px] uppercase tracking-[0.5px] bg-[#D1FAE5] text-[#065F46]">
                  Active
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-[10px] uppercase tracking-[0.5px] ${
                    key.mode === 'test'
                      ? 'bg-[#FFF7ED] text-[#FF9500]'
                      : 'bg-[#ECFDF5] text-[#00D66C]'
                  }`}
                >
                  {key.mode === 'test' ? 'Test' : 'Live'}
                </span>
              </div>
            </div>

            {/* Key Value */}
            <div className="relative flex items-center gap-1.5 mb-2.5">
              <div className="flex-1 bg-[#0A2540] p-3 pr-11 rounded-md font-mono text-xs text-[#425466] break-all relative shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)] tracking-widest">
                {'•'.repeat(64)}
                <button
                  onClick={() => handleToggleKey(key.id)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-none text-[#425466] cursor-pointer p-1 text-base transition-all leading-none hover:text-[#00D924]"
                >
                  <svg
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeWidth="2"
                      d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                    />
                    <circle cx="12" cy="12" r="3" strokeWidth="2" />
                  </svg>
                </button>
              </div>
              <button
                onClick={() => handleRegenerateKey(key.id)}
                className="bg-[#E25950] text-white border-none px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all flex-shrink-0 flex items-center gap-1 hover:bg-[#C94A42]"
              >
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  className="align-[-3px]"
                >
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2"
                  />
                </svg>
                Regenerate
              </button>
            </div>

            {/* Meta */}
            <div className="flex justify-between items-center mt-2.5 text-[11px] text-[#425466]">
              <div className="flex gap-4">
                <span>
                  Created: {new Date(key.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span>
                  Last used:{' '}
                  {key.last_used_at
                    ? new Date(key.last_used_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      }) +
                      ' at ' +
                      new Date(key.last_used_at).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Never'}
                </span>
              </div>
            </div>
          </div>
        ))
      )}

      {/* Copy Modal */}
      {showCopyModal && (
        <div
          className="fixed inset-0 bg-[rgba(10,37,64,0.6)] z-[1000] flex justify-center items-center backdrop-blur-[4px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeCopyModal();
          }}
        >
          <div className="bg-white rounded-xl max-w-[550px] w-[90%] shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
            <div className="p-5 px-6 border-b border-[#E3E8EE] rounded-t-xl flex justify-between items-center">
              <h3 className="text-base font-bold text-[#0A2540] m-0">API Key Generated</h3>
              <button
                onClick={closeCopyModal}
                className="bg-transparent border-none text-xl text-[#425466] cursor-pointer hover:text-[#0A2540]"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <div className="bg-[#EFF6FF] border border-[#3B82F6] text-[#1E40AF] p-3 rounded-lg mb-5 text-sm flex items-start gap-1.5">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4 inline-block align-text-bottom flex-shrink-0 mt-0.5"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>
                  <strong>Important:</strong> Copy this API key now. For security reasons, you
                  won&apos;t be able to see it again.
                </span>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-semibold text-[#1A1F36] mb-2">
                  Your New API Key
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={newApiKey}
                    readOnly
                    className="w-full p-3 pr-[100px] border border-[#E3E8EE] rounded-lg font-mono text-[13px]"
                  />
                  <button
                    onClick={copyApiKeyFromModal}
                    className="absolute right-2 top-2 px-3 py-1.5 text-xs font-semibold bg-white text-[#635BFF] border border-[#E3E8EE] rounded-md cursor-pointer hover:bg-[#F6F9FC] flex items-center gap-1"
                  >
                    <svg
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      className="align-[-2px]"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth="2" />
                      <path strokeWidth="2" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                    Copy
                  </button>
                </div>
                <p className="text-xs text-[#697386] mt-1.5">
                  Store this in your <code>.env</code> file as <code>ZENDFI_API_KEY</code>
                </p>
              </div>

              <button
                onClick={closeCopyModal}
                className="w-full px-4 py-2.5 rounded-md text-[13px] font-semibold cursor-pointer transition-all bg-[#635BFF] text-white border-none hover:bg-[#5449D6]"
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
