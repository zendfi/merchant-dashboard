'use client';

import { useEffect, useState } from 'react';
import { useMode } from '@/lib/mode-context';
import { useCurrency } from '@/lib/currency-context';
import { transactions as transactionsApi, Transaction, merchant as merchantApi, DashboardStats } from '@/lib/api';
import TransactionDetailModal from '../TransactionDetailModal';
import { ArrowUpDown, ChevronUp, ChevronDown, Search, X, Download, TrendingUp, CheckCircle, Clock } from 'lucide-react';

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
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reconciledFilter, setReconciledFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'amount' | 'status' | 'created_at'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1); // Reset to first page on new search
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [searchInput]);

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
          reconciled: reconciledFilter === 'all' ? undefined : reconciledFilter === 'true',
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          sort_by: sortBy,
          sort_order: sortOrder,
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

  useEffect(() => {
    loadData();
  }, [mode, limit, currentPage, statusFilter, searchQuery, reconciledFilter, startDate, endDate, sortBy, sortOrder]);

  const handleSort = (column: 'amount' | 'status' | 'created_at') => {
    if (sortBy === column) {
      // Toggle sort order
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to desc
      setSortBy(column);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ col }: { col: 'amount' | 'status' | 'created_at' }) => {
    if (sortBy !== col) return <ArrowUpDown size={12} className="opacity-30" />;
    return sortOrder === 'asc'
      ? <ChevronUp size={12} className="text-primary" />
      : <ChevronDown size={12} className="text-primary" />;
  };

  const handleRowClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedTransaction(null);
  };

  const handleModalUpdate = () => {
    loadData();
  };

  // Export transactions to CSV
  const exportToCSV = () => {
    if (transactions.length === 0) return;
    const headers = ['Transaction ID', 'Status', `Amount (${currency})`, 'Token', 'Customer Email', 'Customer Name', 'Customer Wallet', 'Date', 'Reconciled', 'Notes'];
    const rows = transactions.map((tx) => [
      tx.id,
      tx.status || 'pending',
      formatAmount(tx.amount_usd),
      tx.token || 'USDC',
      tx.customer_email || '',
      tx.customer_name || '',
      tx.customer_wallet || 'Anonymous',
      new Date(tx.created_at).toISOString(),
      tx.reconciled ? 'Yes' : 'No',
      tx.internal_notes || '',
    ]);
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

  const STATUS_STYLES: Record<string, string> = {
    confirmed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    pending:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    failed:    'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    refunded:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    expired:   'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  };

  const getStatusBadge = (status: string) => (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[status] ?? STATUS_STYLES.expired}`}>
      {status === 'confirmed' ? 'Confirmed' : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );

  const calculateSuccessRate = () => {
    if (!stats?.total_payments || stats.total_payments === 0) return '0.0';
    return ((stats.confirmed_payments / stats.total_payments) * 100).toFixed(1);
  };

  const convertAmount = (usdAmount: number): number =>
    currency === 'NGN' && exchangeRate ? usdAmount * exchangeRate : usdAmount;

  const formatAmount = (usdAmount: number): string => {
    const v = convertAmount(usdAmount);
    if (currency === 'NGN') {
      if (v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`;
      if (v >= 1_000) return `₦${(v / 1_000).toFixed(1)}K`;
      return `₦${Math.round(v).toLocaleString()}`;
    }
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toFixed(2)}`;
  };

  const formatAmountFull = (usdAmount: number): string => {
    const v = convertAmount(usdAmount);
    return currency === 'NGN'
      ? `₦${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      : `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  const totalPages = Math.ceil(total / limit);
  const activeFilters = [statusFilter !== 'all', reconciledFilter !== 'all', !!startDate, !!endDate].filter(Boolean).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Transactions</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {total.toLocaleString()} transaction{total !== 1 ? 's' : ''} in {mode} mode
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onCreatePayment && (
            <button
              onClick={onCreatePayment}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
            >
              <span className="text-base leading-none">+</span> New Payment
            </button>
          )}
          <button
            onClick={exportToCSV}
            disabled={transactions.length === 0}
            title="Export CSV"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download size={16} />
          </button>
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ID, email, name…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#1a1128] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {searchInput && (
              <button onClick={() => setSearchInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={15} className="text-primary" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Volume (30d)</span>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-white">{formatAmountFull(stats?.total_volume || 0)}</p>
          <p className="text-xs text-slate-400 mt-0.5">confirmed only</p>
        </div>
        <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle size={15} className="text-emerald-500" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Success Rate</span>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-white">{calculateSuccessRate()}%</p>
          <p className="text-xs text-slate-400 mt-0.5">{stats?.confirmed_payments ?? 0} confirmed</p>
        </div>
        <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={15} className="text-amber-500" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Pending</span>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-white">{stats?.pending_payments ?? 0}</p>
          <p className="text-xs text-slate-400 mt-0.5">awaiting payment</p>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status pills */}
        {(['all', 'confirmed', 'pending', 'failed', 'expired'] as const).map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-primary text-white'
                : 'bg-white dark:bg-[#1f162b] border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
            }`}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
        {/* Reconciled */}
        <select
          value={reconciledFilter}
          onChange={e => { setReconciledFilter(e.target.value); setCurrentPage(1); }}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1f162b] text-slate-600 dark:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="all">Reconciled: All</option>
          <option value="true">Reconciled</option>
          <option value="false">Not Reconciled</option>
        </select>
        {/* Date range */}
        <input
          type="date"
          value={startDate}
          onChange={e => { setStartDate(e.target.value); setCurrentPage(1); }}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1f162b] text-slate-600 dark:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <span className="text-xs text-slate-400">–</span>
        <input
          type="date"
          value={endDate}
          onChange={e => { setEndDate(e.target.value); setCurrentPage(1); }}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1f162b] text-slate-600 dark:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {activeFilters > 0 && (
          <button
            onClick={() => { setStatusFilter('all'); setReconciledFilter('all'); setStartDate(''); setEndDate(''); setCurrentPage(1); }}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-rose-500 hover:text-rose-700 transition-colors"
          >
            <X size={12} /> Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3 text-left">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">ID</span>
                </th>
                <th className="px-4 py-3 text-left">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Customer</span>
                </th>
                <th className="px-4 py-3 text-right">
                  <button onClick={() => handleSort('amount')} className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hover:text-slate-900 dark:hover:text-white ml-auto">
                    Amount <SortIcon col="amount" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Token</span>
                </th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort('status')} className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hover:text-slate-900 dark:hover:text-white">
                    Status <SortIcon col="status" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right hidden md:table-cell">
                  <button onClick={() => handleSort('created_at')} className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hover:text-slate-900 dark:hover:text-white ml-auto">
                    Date <SortIcon col="created_at" />
                  </button>
                </th>
                <th className="px-4 py-3 text-center hidden lg:table-cell">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Rec.</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50">
                    <td className="px-4 py-3"><div className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" /></td>
                    <td className="px-4 py-3">
                      <div className="space-y-1.5">
                        <div className="h-3 w-28 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                        <div className="h-2.5 w-20 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                      </div>
                    </td>
                    <td className="px-4 py-3"><div className="h-3 w-14 bg-slate-100 dark:bg-slate-800 rounded animate-pulse ml-auto" /></td>
                    {[...Array(4)].map((_, j) => (
                      <td key={j} className="px-4 py-3 hidden sm:table-cell"><div className="h-3 w-12 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-slate-400 dark:text-slate-500 text-sm">
                    {searchQuery || activeFilters > 0
                      ? 'No transactions match your filters.'
                      : 'No transactions yet. Start accepting payments!'}
                  </td>
                </tr>
              ) : (
                transactions.map(tx => (
                  <tr
                    key={tx.id}
                    onClick={() => handleRowClick(tx)}
                    className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors last:border-0"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-amber-500 dark:text-amber-400">{tx.id.slice(0, 8)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {tx.customer_email ? (
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{tx.customer_name || 'Customer'}</p>
                          <p className="text-xs text-slate-400 truncate">{tx.customer_email}</p>
                        </div>
                      ) : tx.customer_wallet ? (
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                          {tx.customer_wallet.slice(0, 6)}…{tx.customer_wallet.slice(-4)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Anonymous</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-slate-900 dark:text-white text-sm">{formatAmount(tx.amount_usd)}</span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-slate-500 dark:text-slate-400">{tx.token || 'USDC'}</span>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(tx.status || 'pending')}</td>
                    <td className="px-4 py-3 text-right hidden md:table-cell">
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div className="text-xs text-slate-400">
                        {new Date(tx.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      {tx.reconciled
                        ? <span className="text-emerald-500 text-xs font-medium">✓</span>
                        : <span className="text-slate-300 dark:text-slate-600 text-xs">–</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {transactions.length} of <span className="font-medium text-slate-900 dark:text-white">{total.toLocaleString()}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                Previous
              </button>
              <span className="text-xs text-slate-400">{currentPage} / {totalPages || 1}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <TransactionDetailModal
        transaction={selectedTransaction}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onUpdate={handleModalUpdate}
      />
    </div>
  );
}
