'use client';

import { useEffect, useState } from 'react';
import { useMode } from '@/lib/mode-context';
import { useCurrency } from '@/lib/currency-context';
import { transactions as transactionsApi, Transaction, merchant as merchantApi, DashboardStats } from '@/lib/api';

interface TransactionsTabProps {
  limit?: number;
  showViewAll?: boolean;
  onCreatePayment?: () => void;
}

export default function TransactionsTab({ limit = 25, showViewAll = true, onCreatePayment }: TransactionsTabProps) {
  const { mode } = useMode();
  const { currency, exchangeRate } = useCurrency();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('30');

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [txData, statsData] = await Promise.all([
          transactionsApi.list({
            mode,
            limit,
            page: currentPage,
            status: statusFilter !== 'all' ? statusFilter : undefined,
            search: searchQuery || undefined,
          }),
          merchantApi.getStats(mode),
        ]);
        setTransactions(txData.transactions || []);
        setTotal(txData.total || 0);
        setStats(statsData);
      } catch (error) {
        console.error('Failed to load transactions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [mode, limit, currentPage, statusFilter, searchQuery]);

  const totalPages = Math.ceil(total / limit);

  // Filter transactions by date (client-side since API doesn't support date filtering)
  const filteredTransactions = transactions.filter((tx) => {
    const txDate = new Date(tx.created_at);
    const now = new Date();
    const daysAgo = parseInt(dateFilter, 10);
    const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    return txDate >= cutoffDate;
  });

  // Export transactions to CSV
  const exportToCSV = () => {
    if (filteredTransactions.length === 0) return;

    const headers = ['Transaction ID', 'Status', `Amount (${currency})`, 'Token', 'Customer Wallet', 'Date', 'Description'];
    const rows = filteredTransactions.map((tx) => {
      const metadata = tx.metadata as Record<string, string> | null;
      const description = metadata?.description || `Payment ${tx.id.slice(0, 8)}`;
      return [
        tx.id,
        tx.status || 'pending',
        formatAmount(tx.amount_usd),
        tx.token || 'USDC',
        tx.customer_wallet || 'Anonymous',
        new Date(tx.created_at).toISOString(),
        description,
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      confirmed: { bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Confirmed' },
      pending: { bg: 'bg-amber-50', text: 'text-amber-600', label: 'Pending' },
      failed: { bg: 'bg-rose-50', text: 'text-rose-600', label: 'Failed' },
      refunded: { bg: 'bg-purple-50', text: 'text-purple-600', label: 'Refunded' },
      expired: { bg: 'bg-slate-50', text: 'text-slate-600', label: 'Expired' },
    };
    const c = config[status] || config.pending;
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text} border border-current/20`}>
        {c.label}
      </span>
    );
  };

  const calculateSuccessRate = () => {
    if (!stats?.total_payments || stats.total_payments === 0) return '0.0';
    return ((stats.confirmed_payments / stats.total_payments) * 100).toFixed(1);
  };

  const calculatePendingAmount = () => {
    // Calculate based on pending payments count and average transaction amount
    if (!stats?.pending_payments || !stats?.total_volume || !stats?.total_payments) return 0;
    const avgAmount = stats.total_volume / stats.total_payments;
    return stats.pending_payments * avgAmount;
  };

  // Convert USD amount to display currency
  const convertAmount = (usdAmount: number): number => {
    if (currency === 'NGN' && exchangeRate) {
      return usdAmount * exchangeRate;
    }
    return usdAmount;
  };

  // Format amount for display
  const formatAmount = (usdAmount: number): string => {
    const displayValue = convertAmount(usdAmount);
    if (currency === 'NGN') {
      return `₦${displayValue.toFixed(2)}`;
    } else {
      return `$${displayValue.toFixed(2)}`;
    }
  };

  // Format full amount (for stats cards)
  const formatFullAmount = (usdAmount: number): string => {
    const displayValue = convertAmount(usdAmount);
    if (currency === 'NGN') {
      return `₦${displayValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    } else {
      return `$${displayValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Transactions</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">View and manage all payment activities and cash flow.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportToCSV}
            disabled={filteredTransactions.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export CSV
          </button>
          <button
            onClick={onCreatePayment}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Create Payment
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-[#1f162b] p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-card">
          <span className="text-xs text-slate-500 dark:text-slate-400">Total Volume (30d)</span>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
            {formatFullAmount(stats?.total_volume || 0)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#1f162b] p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-card">
          <span className="text-xs text-slate-500 dark:text-slate-400">Success Rate</span>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
            {calculateSuccessRate()}%
          </p>
        </div>
        <div className="bg-white dark:bg-[#1f162b] p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-card">
          <span className="text-xs text-slate-500 dark:text-slate-400">Pending Amount</span>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
            {formatFullAmount(calculatePendingAmount())}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
          <input
            type="text"
            placeholder="Search by ID, email, or customer name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="30">Date: Last 30 days</option>
            <option value="7">Date: Last 7 days</option>
            <option value="90">Date: Last 90 days</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">Status: All</option>
            <option value="confirmed">Succeeded</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {filteredTransactions.length === 0 ? (
        <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800 p-12 text-center">
          <span className="material-symbols-outlined text-[48px] text-slate-300 mb-4">receipt_long</span>
          <p className="text-slate-500 dark:text-slate-400 mb-4">No transactions yet. Start accepting payments!</p>
          <a
            href="https://zendfi.tech/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold"
          >
            View Docs
          </a>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
          {/* Mobile Card View */}
          <div className="lg:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {filteredTransactions.map((tx) => (
              <div key={tx.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-amber-500 font-mono text-sm">{tx.id.slice(0, 8)}</span>
                  {getStatusBadge(tx.status || 'pending')}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-900 dark:text-white">{formatAmount(tx.amount_usd)}</span>
                  <span className="text-slate-500">{tx.token || 'USDC'}</span>
                </div>
                <div className="text-right text-slate-500 text-xs">
                  {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {new Date(tx.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ID</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Amount</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Token</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="text-amber-500 font-mono text-xs">{tx.id.slice(0, 8)}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">{formatAmount(tx.amount_usd)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 text-xs">
                      {tx.token || 'USDC'}
                    </td>
                    <td className="px-4 py-2.5">{getStatusBadge(tx.status || 'pending')}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-400">
                      {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {new Date(tx.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-sm text-slate-500">
              Showing <span className="font-medium text-slate-900 dark:text-white">{filteredTransactions.length}</span> of <span className="font-medium text-primary">{total.toLocaleString()}</span> results
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
