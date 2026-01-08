'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ModeProvider, useMode } from '@/lib/mode-context';
import { MerchantProvider, useMerchant } from '@/lib/merchant-context';
import { NotificationProvider } from '@/lib/notifications';
import { transactions as transactionsApi, Transaction } from '@/lib/api';

function TransactionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mode } = useMode();
  const { merchant } = useMerchant();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [currentPage, setCurrentPage] = useState(
    parseInt(searchParams.get('page') || '1', 10)
  );
  const limit = 25;

  useEffect(() => {
    loadTransactions();
  }, [mode, statusFilter, searchQuery, currentPage]);

  const loadTransactions = async () => {
    setIsLoading(true);
    try {
      const data = await transactionsApi.list({
        mode,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchQuery || undefined,
        page: currentPage,
        limit,
      });
      setTransactions(data.transactions || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (searchQuery) params.set('search', searchQuery);
    params.set('page', '1');
    router.push(`/transactions?${params.toString()}`);
  };

  const handleClearFilters = () => {
    setStatusFilter('all');
    setSearchQuery('');
    setCurrentPage(1);
    router.push('/transactions');
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (searchQuery) params.set('search', searchQuery);
    params.set('page', page.toString());
    router.push(`/transactions?${params.toString()}`);
  };

  const getStatusClass = (status: string | undefined) => {
    switch (status) {
      case 'confirmed':
        return 'status-confirmed';
      case 'pending':
        return 'status-pending';
      case 'failed':
        return 'status-failed';
      case 'expired':
        return 'status-expired';
      default:
        return 'status-pending';
    }
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages: (number | string)[] = [];
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    if (startPage > 1) {
      pages.push(1);
      if (startPage > 2) pages.push('...');
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }

    return (
      <div className="flex items-center justify-center gap-2 mt-6">
        {currentPage > 1 && (
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            className="px-4 py-2 bg-white border border-[#E3E8EE] rounded-md text-sm font-medium text-[#425466] hover:bg-[#F6F9FC] hover:border-[#635BFF] transition-all"
          >
            ← Previous
          </button>
        )}

        {pages.map((page, idx) =>
          typeof page === 'string' ? (
            <span key={`dots-${idx}`} className="px-2 text-[#697386]">
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`w-10 h-10 rounded-md text-sm font-medium transition-all ${
                page === currentPage
                  ? 'bg-[#635BFF] text-white'
                  : 'bg-white border border-[#E3E8EE] text-[#425466] hover:bg-[#F6F9FC] hover:border-[#635BFF]'
              }`}
            >
              {page}
            </button>
          )
        )}

        {currentPage < totalPages && (
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            className="px-4 py-2 bg-white border border-[#E3E8EE] rounded-md text-sm font-medium text-[#425466] hover:bg-[#F6F9FC] hover:border-[#635BFF] transition-all"
          >
            Next →
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f6f9fc]">
      {/* Header */}
      <header className="bg-[#0A2540] px-10 py-4 flex justify-between items-center sticky top-0 z-[100]">
        <Link
          href="/"
          className="text-2xl font-bold text-white tracking-[-0.5px] no-underline"
        >
          ZendFi
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/"
            className="text-white/70 no-underline font-medium text-sm transition-colors hover:text-white"
          >
            Dashboard
          </Link>
          <span className="text-white font-semibold text-sm">Transactions</span>
          <div className="flex items-center gap-3 pl-6 border-l border-white/20">
            <span className="text-white/90 text-sm">{merchant?.email}</span>
          </div>
        </nav>
      </header>

      {/* Content */}
      <div className="max-w-[1400px] mx-auto p-10">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-[28px] font-bold text-[#0A2540] mb-2 tracking-[-0.5px]">
            Transactions
          </h1>
          <p className="text-[#425466] text-[15px]">
            View and manage all your payment transactions
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-6 mb-6 shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
          <form onSubmit={handleFilter}>
            <div className="grid grid-cols-[1fr_1fr_2fr_auto] gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-[#425466] uppercase tracking-[0.5px] mb-2">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full p-3 border border-[#E3E8EE] rounded-lg text-sm font-sans bg-white cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="expired">Expired</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#425466] uppercase tracking-[0.5px] mb-2">
                  Mode
                </label>
                <div className="p-3 border border-[#E3E8EE] rounded-lg text-sm bg-[#F6F9FC] font-medium capitalize">
                  {mode}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#425466] uppercase tracking-[0.5px] mb-2">
                  Search
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Transaction ID, wallet address, or token..."
                  className="w-full p-3 border border-[#E3E8EE] rounded-lg text-sm font-sans transition-all focus:outline-none focus:border-[#635BFF] focus:shadow-[0_0_0_3px_rgba(99,91,255,0.12)]"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-5 py-3 bg-[#635BFF] text-white border-none rounded-lg text-sm font-semibold cursor-pointer transition-all hover:bg-[#5449D6]"
                >
                  Filter
                </button>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="px-5 py-3 bg-white text-[#425466] border border-[#E3E8EE] rounded-lg text-sm font-semibold cursor-pointer transition-all hover:bg-[#F6F9FC]"
                >
                  Clear
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Results Summary */}
        <div className="mb-4 text-sm text-[#697386]">
          Showing {transactions.length} of {total} transactions
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="spinner spinner-dark" />
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  <th className="text-left p-4 text-xs font-bold text-[#425466] uppercase tracking-[0.5px] border-b border-[#E3E8EE]">
                    ID
                  </th>
                  <th className="text-left p-4 text-xs font-bold text-[#425466] uppercase tracking-[0.5px] border-b border-[#E3E8EE]">
                    Amount
                  </th>
                  <th className="text-left p-4 text-xs font-bold text-[#425466] uppercase tracking-[0.5px] border-b border-[#E3E8EE]">
                    Token
                  </th>
                  <th className="text-left p-4 text-xs font-bold text-[#425466] uppercase tracking-[0.5px] border-b border-[#E3E8EE]">
                    Status
                  </th>
                  <th className="text-left p-4 text-xs font-bold text-[#425466] uppercase tracking-[0.5px] border-b border-[#E3E8EE]">
                    Wallet
                  </th>
                  <th className="text-left p-4 text-xs font-bold text-[#425466] uppercase tracking-[0.5px] border-b border-[#E3E8EE]">
                    Split
                  </th>
                  <th className="text-left p-4 text-xs font-bold text-[#425466] uppercase tracking-[0.5px] border-b border-[#E3E8EE]">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-12 text-[#697386]">
                      <div className="text-5xl mb-4">📭</div>
                      <div className="text-base">No transactions found</div>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="p-4 border-b border-[#F1F5F9]">
                        <span className="font-mono text-sm text-[#635BFF] font-medium">
                          {tx.id.substring(0, 8)}
                        </span>
                      </td>
                      <td className="p-4 border-b border-[#F1F5F9]">
                        <strong className="text-[#0A2540]">${tx.amount_usd.toFixed(2)}</strong>
                      </td>
                      <td className="p-4 border-b border-[#F1F5F9] text-sm">
                        {tx.token || 'USDC'}
                      </td>
                      <td className="p-4 border-b border-[#F1F5F9]">
                        <span className={`status-badge ${getStatusClass(tx.status)}`}>
                          {tx.status || 'pending'}
                        </span>
                      </td>
                      <td className="p-4 border-b border-[#F1F5F9]">
                        {tx.customer_wallet ? (
                          <code className="text-xs font-mono bg-[#F6F9FC] px-2 py-1 rounded text-[#425466]">
                            {tx.customer_wallet.substring(0, 6)}...
                            {tx.customer_wallet.substring(tx.customer_wallet.length - 4)}
                          </code>
                        ) : (
                          <span className="text-[#697386]">N/A</span>
                        )}
                      </td>
                      <td className="p-4 border-b border-[#F1F5F9]">
                        {tx.has_splits && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-[10px] uppercase tracking-[0.5px] bg-[#D1FAE5] text-[#065F46]">
                            SPLIT
                          </span>
                        )}
                      </td>
                      <td className="p-4 border-b border-[#F1F5F9] text-sm text-[#425466]">
                        {new Date(tx.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}{' '}
                        {new Date(tx.created_at).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZoneName: 'short',
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {renderPagination()}

        {/* Back to Dashboard */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-[#635BFF] text-sm font-medium no-underline hover:underline"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function TransactionsPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#f6f9fc]">
          <div className="spinner spinner-dark" />
        </div>
      }
    >
      <TransactionsContent />
    </Suspense>
  );
}

export default function TransactionsPage() {
  return (
    <NotificationProvider>
      <ModeProvider>
        <MerchantProvider>
          <TransactionsPageWrapper />
        </MerchantProvider>
      </ModeProvider>
    </NotificationProvider>
  );
}
