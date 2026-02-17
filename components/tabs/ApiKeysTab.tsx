'use client';

import { useEffect, useState } from 'react';
import { useMode } from '@/lib/mode-context';
import { apiKeys as apiKeysApi, ApiKey, ApiUsageTimelineEntry } from '@/lib/api';
import { useNotification } from '@/lib/notifications';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function ApiKeysTab() {
  const { mode } = useMode();
  const { showNotification } = useNotification();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [usageTimeline, setUsageTimeline] = useState<ApiUsageTimelineEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingUsage, setIsLoadingUsage] = useState(true);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [timeRange, setTimeRange] = useState(168); // 7 days in hours

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

  useEffect(() => {
    const loadUsageTimeline = async () => {
      setIsLoadingUsage(true);
      try {
        const result = await apiKeysApi.getUsageTimeline(timeRange);
        setUsageTimeline(result.timeline || []);
      } catch (error) {
        console.error('Failed to load usage timeline:', error);
      } finally {
        setIsLoadingUsage(false);
      }
    };

    loadUsageTimeline();
  }, [timeRange]);

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

      {/* API Usage Chart */}
      <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">API Usage</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Track your API request volume over time</p>
          </div>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(Number(e.target.value))}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value={24}>Last 24 hours</option>
            <option value={168}>Last 7 days</option>
            <option value={720}>Last 30 days</option>
          </select>
        </div>
        
        {isLoadingUsage ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" />
          </div>
        ) : usageTimeline.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="material-symbols-outlined text-[48px] text-slate-300 mb-4">show_chart</span>
            <p className="text-slate-500 dark:text-slate-400">No API usage data yet</p>
            <p className="text-sm text-slate-400">Start making API calls to see your usage graph</p>
          </div>
        ) : (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={usageTimeline.map(entry => ({
                  time: new Date(entry.time).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    hour: timeRange <= 24 ? '2-digit' : undefined,
                  }),
                  Total: entry.total,
                  Successful: entry.successful,
                  Failed: entry.failed,
                }))}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="time" 
                  stroke="#94a3b8"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="#94a3b8"
                  style={{ fontSize: '12px' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '12px' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="Total" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  dot={{ fill: '#8b5cf6', r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="Successful" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  dot={{ fill: '#10b981', r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="Failed" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  dot={{ fill: '#ef4444', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
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
