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
    switch (status) {
      case 'active':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-[10px] uppercase tracking-[0.5px] bg-[#D1FAE5] text-[#065F46]">
            Active
          </span>
        );
      case 'expired':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-[10px] uppercase tracking-[0.5px] bg-[#E5E7EB] text-[#374151]">
            Expired
          </span>
        );
      case 'revoked':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-[10px] uppercase tracking-[0.5px] bg-[#FEE2E2] text-[#991B1B]">
            Revoked
          </span>
        );
      default:
        return null;
    }
  };

  const truncateAddress = (addr: string | null) => {
    if (!addr) return '—';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
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
      <h1 className="mb-6 text-xl font-semibold text-[#0A2540]">Session Keys</h1>
      
      {/* Stats */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border border-[#E3E8EE] shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <div className="text-[11px] text-[#425466] font-bold uppercase tracking-[0.6px] mb-1">
              Total Keys
            </div>
            <div className="text-2xl font-bold text-[#0A2540]">{stats.total}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-[#E3E8EE] shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <div className="text-[11px] text-[#425466] font-bold uppercase tracking-[0.6px] mb-1">
              Active
            </div>
            <div className="text-2xl font-bold text-[#00D66C]">{stats.active}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-[#E3E8EE] shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <div className="text-[11px] text-[#425466] font-bold uppercase tracking-[0.6px] mb-1">
              Total Limit
            </div>
            <div className="text-2xl font-bold text-[#0A2540]">
              ${stats.total_limit_usdc.toFixed(2)}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-[#E3E8EE] shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <div className="text-[11px] text-[#425466] font-bold uppercase tracking-[0.6px] mb-1">
              Remaining
            </div>
            <div className="text-2xl font-bold text-[#635BFF]">
              ${stats.total_remaining_usdc.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      <h2 className="mb-4 text-lg font-semibold text-[#0A2540] flex items-center gap-2">
        Session Keys{' '}
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-[10px] uppercase tracking-[0.5px] bg-[#D1FAE5] text-[#065F46]">
          {sessionKeys.filter((k) => k.status === 'active').length} Active
        </span>
      </h2>
      <p className="text-[#697386] my-4 mb-6">
        Session keys allow temporary delegated payment authority without exposing your main wallet.
      </p>

      {sessionKeys.length === 0 ? (
        <div className="bg-[#F6F9FC] p-8 rounded-xl text-center text-[#697386]">
          <svg
            width="48"
            height="48"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            className="mx-auto mb-3 opacity-50"
          >
            <path
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <p className="my-3 mx-0 font-medium">No session keys found</p>
          <p className="text-[13px] m-0">
            Session keys will appear here when created through the AI payment demo or API.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessionKeys.map((key) => (
            <div
              key={key.id}
              className="bg-white p-4 rounded-lg border border-[#E3E8EE] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  {getStatusBadge(key.status)}
                  {key.agent_name && (
                    <span className="text-[11px] font-semibold text-[#635BFF] bg-[#F0F0FF] px-2 py-0.5 rounded">
                      {key.agent_name}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[#697386]">
                  Created {formatDate(key.created_at)}
                </span>
              </div>

              {/* Limit & Usage */}
              <div className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] text-[#425466] font-bold uppercase tracking-[0.6px]">
                    Spending Limit
                  </span>
                  <span className="text-sm font-semibold text-[#0A2540]">
                    ${key.used_amount_usdc.toFixed(2)} / ${key.limit_usdc.toFixed(2)}
                  </span>
                </div>
                <div className="h-2 bg-[#E3E8EE] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#635BFF] transition-all"
                    style={{
                      width: `${Math.min((key.used_amount_usdc / key.limit_usdc) * 100, 100)}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[11px] text-[#697386]">
                    ${key.remaining_usdc.toFixed(2)} remaining
                  </span>
                  <span className="text-[11px] text-[#697386]">
                    {((key.used_amount_usdc / key.limit_usdc) * 100).toFixed(0)}% used
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-[#E3E8EE]">
                <div>
                  <div className="text-[10px] text-[#697386] uppercase tracking-[0.5px] mb-0.5">
                    Session Wallet
                  </div>
                  <div className="font-mono text-[12px] text-[#0A2540]">
                    {truncateAddress(key.session_wallet)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#697386] uppercase tracking-[0.5px] mb-0.5">
                    User Wallet
                  </div>
                  <div className="font-mono text-[12px] text-[#0A2540]">
                    {truncateAddress(key.user_wallet)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#697386] uppercase tracking-[0.5px] mb-0.5">
                    Agent ID
                  </div>
                  <div className="text-[12px] text-[#0A2540]">
                    {key.agent_id || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#697386] uppercase tracking-[0.5px] mb-0.5">
                    Expires
                  </div>
                  <div className="text-[12px] text-[#0A2540]">
                    {formatDate(key.expires_at)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
