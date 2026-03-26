'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  subAccounts,
  type DashboardSubAccount,
  type DashboardSubAccountBalance,
} from '@/lib/api';

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300',
  frozen: 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300',
  draining: 'bg-sky-50 text-sky-700 dark:bg-sky-900/25 dark:text-sky-300',
  closed: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

export default function SubAccountsTab() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingBalances, setIsRefreshingBalances] = useState(false);
  const [subaccounts, setSubaccounts] = useState<DashboardSubAccount[]>([]);
  const [balances, setBalances] = useState<Record<string, DashboardSubAccountBalance>>({});
  const [error, setError] = useState<string | null>(null);

  const loadSubAccounts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await subAccounts.list();
      setSubaccounts(result.subaccounts || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sub-accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const loadBalances = async () => {
    if (subaccounts.length === 0) {
      setBalances({});
      return;
    }

    setIsRefreshingBalances(true);
    try {
      const results = await Promise.allSettled(
        subaccounts.map(async (account) => {
          const balance = await subAccounts.getBalance(account.id);
          return { id: account.id, balance };
        })
      );

      const next: Record<string, DashboardSubAccountBalance> = {};
      for (const result of results) {
        if (result.status === 'fulfilled') {
          next[result.value.id] = result.value.balance;
        }
      }
      setBalances(next);
    } finally {
      setIsRefreshingBalances(false);
    }
  };

  useEffect(() => {
    void loadSubAccounts();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      void loadBalances();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, subaccounts.length]);

  const summary = useMemo(() => {
    const counts = {
      total: subaccounts.length,
      active: 0,
      frozen: 0,
      draining: 0,
      closed: 0,
      usdc: 0,
      sol: 0,
    };

    for (const account of subaccounts) {
      const status = account.status.toLowerCase();
      if (status in counts) {
        (counts as Record<string, number>)[status] += 1;
      }

      const bal = balances[account.id];
      if (bal) {
        counts.usdc += bal.usdc_balance || 0;
        counts.sol += bal.sol_balance || 0;
      }
    }

    return counts;
  }, [subaccounts, balances]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sub Accounts</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Watchtower for programmatically created sub-accounts.
          </p>
        </div>
        <button
          onClick={() => {
            void loadSubAccounts();
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 p-4 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <StatCard label="Total" value={summary.total.toString()} icon="account_tree" />
        <StatCard label="Active" value={summary.active.toString()} icon="check_circle" />
        <StatCard label="Frozen" value={summary.frozen.toString()} icon="ac_unit" />
        <StatCard label="Draining" value={summary.draining.toString()} icon="sync_alt" />
        <StatCard label="USDC" value={summary.usdc.toFixed(2)} icon="payments" />
        <StatCard label="SOL" value={summary.sol.toFixed(4)} icon="bolt" />
      </div>

      <div className="bg-white dark:bg-[#13131f] rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Sub-account Inventory</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {isRefreshingBalances ? 'Refreshing balances...' : 'Balances auto-loaded'}
          </span>
        </div>

        {subaccounts.length === 0 ? (
          <div className="p-10 text-center">
            <span className="material-symbols-outlined text-[42px] text-slate-300 dark:text-slate-600">account_tree</span>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No sub-accounts found for this merchant yet.</p>
            <p className="text-xs text-slate-400 mt-1">Create sub-accounts via API, SDK, or CLI to see them here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="bg-slate-50 dark:bg-slate-900/40">
                <tr>
                  <Th>Label</Th>
                  <Th>ID</Th>
                  <Th>Status</Th>
                  <Th>Wallet</Th>
                  <Th>USDC</Th>
                  <Th>SOL</Th>
                  <Th>Spend Limit</Th>
                  <Th>Access</Th>
                  <Th>Yield</Th>
                  <Th>Created</Th>
                </tr>
              </thead>
              <tbody>
                {subaccounts.map((account) => {
                  const bal = balances[account.id];
                  const statusKey = account.status.toLowerCase();
                  return (
                    <tr
                      key={account.id}
                      className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors"
                    >
                      <Td className="font-semibold text-slate-900 dark:text-white">{account.label}</Td>
                      <Td className="font-mono text-xs">{account.id}</Td>
                      <Td>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[statusKey] || STATUS_STYLES.closed}`}>
                          {account.status}
                        </span>
                      </Td>
                      <Td className="font-mono text-xs">{truncateMiddle(account.wallet_address)}</Td>
                      <Td>{bal ? bal.usdc_balance.toFixed(2) : '--'}</Td>
                      <Td>{bal ? bal.sol_balance.toFixed(4) : '--'}</Td>
                      <Td>{account.spend_limit_usdc.toFixed(2)}</Td>
                      <Td>{account.access_mode}</Td>
                      <Td>{account.yield_enabled ? 'enabled' : 'disabled'}</Td>
                      <Td>{new Date(account.created_at).toLocaleString()}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-white dark:bg-[#13131f] rounded-xl border border-slate-100 dark:border-slate-800 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <span className="material-symbols-outlined text-[18px] text-slate-400">{icon}</span>
      </div>
      <p className="text-lg font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3 uppercase tracking-wide">
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm text-slate-700 dark:text-slate-300 ${className}`}>{children}</td>;
}

function truncateMiddle(value: string, start = 6, end = 6): string {
  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}
