'use client';

import { useEffect, useState } from 'react';
import { sessionKeys as sessionKeysApi, SessionKey, SessionKeyStats } from '@/lib/api';

export default function SessionKeysTab() {
  const [sessionKeys, setSessionKeys] = useState<SessionKey[]>([]);
  const [stats, setStats] = useState<SessionKeyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSessionKeys = async () => {
      setIsLoading(true);
      try {
        const result = await sessionKeysApi.list();
        setSessionKeys(result.session_keys || []);
        setStats(result.stats || null);
      } catch (error) {
        console.error('Failed to load session keys:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSessionKeys();
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      active: { bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Active' },
      expired: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Expired' },
      revoked: { bg: 'bg-rose-50', text: 'text-rose-600', label: 'Revoked' },
    };
    const c = config[status] || config.active;
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
        {c.label}
      </span>
    );
  };

  const truncateAddress = (addr: string | null) => {
    if (!addr) return '—';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Session Keys</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Session keys allow temporary delegated payment authority without exposing your main wallet.
        </p>
      </div>

      {/* Stats */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#1f162b] p-5 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Keys
            </span>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</p>
          </div>
          <div className="bg-white dark:bg-[#1f162b] p-5 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Active
            </span>
            <p className="text-2xl font-bold text-emerald-500 mt-1">{stats.active}</p>
          </div>
          <div className="bg-white dark:bg-[#1f162b] p-5 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Limit
            </span>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              ${stats.total_limit_usdc.toFixed(2)}
            </p>
          </div>
          <div className="bg-white dark:bg-[#1f162b] p-5 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Remaining
            </span>
            <p className="text-2xl font-bold text-primary mt-1">
              ${stats.total_remaining_usdc.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Keys Count Badge */}
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">
          <span className="material-symbols-outlined text-[14px] mr-1">check_circle</span>
          {sessionKeys.filter((k) => k.status === 'active').length} Active
        </span>
      </div>

      {sessionKeys.length === 0 ? (
        <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800 p-12 text-center">
          <span className="material-symbols-outlined text-[48px] text-slate-300 mb-4">passkey</span>
          <p className="text-slate-500 dark:text-slate-400 font-medium mb-2">No session keys found</p>
          <p className="text-slate-400 text-sm">
            Session keys will appear here when created through the AI payment demo or API.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessionKeys.map((key) => (
            <div
              key={key.id}
              className="bg-white dark:bg-[#1f162b] p-5 rounded-xl border border-slate-100 dark:border-slate-800"
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  {getStatusBadge(key.status)}
                  {key.agent_name && (
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded">
                      {key.agent_name}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Created {formatDate(key.created_at)}
                </span>
              </div>

              {/* Limit & Usage */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Spending Limit
                  </span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    ${key.used_amount_usdc.toFixed(2)} / ${key.limit_usdc.toFixed(2)}
                  </span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all rounded-full"
                    style={{
                      width: `${Math.min((key.used_amount_usdc / key.limit_usdc) * 100, 100)}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    ${key.remaining_usdc.toFixed(2)} remaining
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {((key.used_amount_usdc / key.limit_usdc) * 100).toFixed(0)}% used
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Session Wallet
                  </span>
                  <p className="font-mono text-sm text-slate-900 dark:text-white mt-1">
                    {truncateAddress(key.session_wallet)}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    User Wallet
                  </span>
                  <p className="font-mono text-sm text-slate-900 dark:text-white mt-1">
                    {truncateAddress(key.user_wallet)}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Agent ID
                  </span>
                  <p className="text-sm text-slate-900 dark:text-white mt-1">
                    {key.agent_id || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Expires
                  </span>
                  <p className="text-sm text-slate-900 dark:text-white mt-1">
                    {formatDate(key.expires_at)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
