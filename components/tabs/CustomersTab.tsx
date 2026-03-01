'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useMode } from '@/lib/mode-context';
import { useCurrency } from '@/lib/currency-context';
import {
  customers as customersApi,
  Customer,
  CustomerDetail,
} from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Search, X, ExternalLink, Copy, ChevronRight,
  TrendingUp, Users, AlertTriangle, ArrowUpDown,
  ChevronUp, ChevronDown, Download, RefreshCw,
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(usd: number, currency: string, rate: number | null) {
  const v = currency === 'NGN' && rate ? usd * rate : usd;
  if (currency === 'NGN') {
    if (v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `₦${(v / 1_000).toFixed(1)}K`;
    return `₦${Math.round(v).toLocaleString()}`;
  }
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

function initials(c: Customer) {
  if (c.name) return c.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return c.email.slice(0, 2).toUpperCase();
}

const TYPE_STYLES: Record<string, string> = {
  returning: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  no_payment: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  expired: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

// ── Main component ────────────────────────────────────────────────────────────

interface CustomersTabProps {
  onModalToggle?: (open: boolean) => void;
}

export default function CustomersTab({ onModalToggle }: CustomersTabProps = {}) {
  const { mode } = useMode();
  const { currency, exchangeRate } = useCurrency();

  // List state
  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortBy, setSortBy] = useState('last_seen');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Detail panel state
  const [selected, setSelected] = useState<Customer | null>(null);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);

  const LIMIT = 25;

  // ── Load list ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await customersApi.list({
        mode,
        search: search || undefined,
        sort_by: sortBy,
        limit: LIMIT,
        page,
      });
      setCustomerList(res.customers);
      setTotal(res.total);
    } catch (e) {
      console.error('Failed to load customers', e);
    } finally {
      setIsLoading(false);
    }
  }, [mode, search, sortBy, page]);

  useEffect(() => { load(); }, [load]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ── Load detail ────────────────────────────────────────────────────────────
  const openDetail = async (c: Customer) => {
    setSelected(c);
    setDetail(null);
    setDetailError(false);
    setDetailLoading(true);
    onModalToggle?.(true);
    try {
      const d = await customersApi.getDetail(c.email, mode);
      setDetail(d);
    } catch (e) {
      console.error('Failed to load customer detail', e);
      setDetailError(true);
    } finally {
      setDetailLoading(false);
    }
  };

  const retryDetail = () => selected && openDetail(selected);

  const closeDetail = () => {
    setSelected(null);
    setDetail(null);
    setDetailError(false);
    onModalToggle?.(false);
  };

  // ── CSV export ─────────────────────────────────────────────────────────────
  const exportCSV = (c: Customer, d: CustomerDetail | null) => {
    const p = d?.profile;
    const rows: string[][] = [
      ['Field', 'Value'],
      ['Email', c.email],
      ['Name', c.name || ''],
      ['Company', c.company || ''],
      ['Phone', p?.phone || ''],
      ['Customer Type', c.customer_type],
      ['First Seen', c.first_seen],
      ['Last Seen', c.last_seen || ''],
      ['Confirmed Payments', String(c.confirmed_payments)],
      ['Total Spent (USD)', c.total_spent.toFixed(2)],
      ['Avg Order Value (USD)', c.avg_order_value.toFixed(2)],
      ['Billing Address Line 1', p?.billing_address_line1 || ''],
      ['Billing Address Line 2', p?.billing_address_line2 || ''],
      ['Billing City', p?.billing_city || ''],
      ['Billing State', p?.billing_state || ''],
      ['Billing Postal Code', p?.billing_postal_code || ''],
      ['Billing Country', p?.billing_country || ''],
      ['IP Address', p?.ip_address || ''],
      [],
      ['--- Payment History ---'],
      ['Payment ID', 'Date', 'Amount (USD)', 'Status', 'Type', 'Transaction'],
      ...(d?.payments ?? []).map(pay => [
        pay.id,
        new Date(pay.created_at).toISOString(),
        pay.amount_usd.toFixed(2),
        pay.status || '',
        pay.is_onramp ? 'Onramp' : 'Crypto',
        pay.transaction_signature || '',
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer-${c.email.replace(/[^a-z0-9]/gi, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Cleanup: hide header if we unmount while modal is open
  useEffect(() => {
    return () => onModalToggle?.(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return <ArrowUpDown size={12} className="opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-primary" />
      : <ChevronDown size={12} className="text-primary" />;
  };

  const totalPages = Math.ceil(total / LIMIT);

  // ── Stats strip ────────────────────────────────────────────────────────────
  const totalLtv = customerList.reduce((s, c) => s + c.total_spent, 0);
  const returningCount = customerList.filter(c => c.customer_type === 'returning').length;
  const atRiskCount = customerList.filter(c => c.churn_risk).length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Customers</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {total.toLocaleString()} unique customer{total !== 1 ? 's' : ''} in {mode} mode
          </p>
        </div>
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, company…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#1a1128] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {searchInput && (
            <button onClick={() => setSearchInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800 p-3 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Users size={13} className="text-primary shrink-0" />
            <span className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">Returning</span>
          </div>
          <p className="text-base sm:text-xl font-bold text-slate-900 dark:text-white">{returningCount}</p>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 hidden sm:block">of {customerList.length} shown</p>
        </div>
        <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800 p-3 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={13} className="text-green-600 shrink-0" />
            <span className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">LTV</span>
          </div>
          <p className="text-base sm:text-xl font-bold text-slate-900 dark:text-white">{fmt(totalLtv, currency, exchangeRate)}</p>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 hidden sm:block">confirmed only</p>
        </div>
        <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800 p-3 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle size={13} className="text-orange-500 shrink-0" />
            <span className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">At Risk</span>
          </div>
          <p className="text-base sm:text-xl font-bold text-slate-900 dark:text-white">{atRiskCount}</p>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 hidden sm:block">churn signal</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">

        {/* ── Mobile card list (< sm) ── */}
        <div className="sm:hidden">
          {isLoading ? (
            <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                    <div className="h-2.5 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                  </div>
                  <div className="h-4 w-12 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : customerList.length === 0 ? (
            <p className="py-16 text-center text-slate-400 dark:text-slate-500 text-sm">
              {search ? 'No customers match your search.' : 'No customers yet.'}
            </p>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {customerList.map(c => (
                <div
                  key={c.email}
                  onClick={() => openDetail(c)}
                  className="p-3.5 flex items-center gap-3 cursor-pointer active:bg-slate-50 dark:active:bg-white/[0.03] transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                    {initials(c)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{c.name || c.email}</p>
                      {c.churn_risk && <AlertTriangle size={12} className="text-orange-500 shrink-0" />}
                    </div>
                    {c.name && <p className="text-xs text-slate-400 truncate">{c.email}</p>}
                    <p className="text-xs text-slate-400">{relativeTime(c.last_seen)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{fmt(c.total_spent, currency, exchangeRate)}</p>
                    <p className="text-[10px] text-slate-400">{c.confirmed_payments} paid</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Desktop table (sm+) ── */}
        {/* Table header */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort('last_seen')} className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hover:text-slate-900 dark:hover:text-white">
                    Customer <SortIcon col="last_seen" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left hidden md:table-cell">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Type</span>
                </th>
                <th className="px-4 py-3 text-right">
                  <button onClick={() => handleSort('ltv')} className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hover:text-slate-900 dark:hover:text-white ml-auto">
                    LTV <SortIcon col="ltv" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right hidden sm:table-cell">
                  <button onClick={() => handleSort('payments')} className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hover:text-slate-900 dark:hover:text-white ml-auto">
                    Payments <SortIcon col="payments" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right hidden lg:table-cell">
                  <button onClick={() => handleSort('avg_order')} className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hover:text-slate-900 dark:hover:text-white ml-auto">
                    Avg Order <SortIcon col="avg_order" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right hidden md:table-cell">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Last Seen</span>
                </th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" />
                        <div className="space-y-1.5">
                          <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                          <div className="h-2.5 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                        </div>
                      </div>
                    </td>
                    {[...Array(5)].map((_, j) => (
                      <td key={j} className="px-4 py-3 hidden sm:table-cell">
                        <div className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse ml-auto" />
                      </td>
                    ))}
                    <td className="px-4 py-3" />
                  </tr>
                ))
              ) : customerList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-slate-400 dark:text-slate-500 text-sm">
                    {search ? 'No customers match your search.' : 'No customers yet. Payments with customer info will appear here.'}
                  </td>
                </tr>
              ) : (
                customerList.map(c => (
                  <tr
                    key={c.email}
                    onClick={() => openDetail(c)}
                    className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                          {initials(c)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white text-sm truncate">
                            {c.name || c.email}
                          </p>
                          {c.name && (
                            <p className="text-xs text-slate-400 truncate">{c.email}</p>
                          )}
                          {c.company && (
                            <p className="text-xs text-slate-400 truncate">{c.company}</p>
                          )}
                        </div>
                        {c.churn_risk && (
                          <span title="Churn risk">
                            <AlertTriangle size={13} className="text-orange-500 shrink-0" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${TYPE_STYLES[c.customer_type]}`}>
                        {c.customer_type === 'no_payment' ? 'No payment' : c.customer_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-slate-900 dark:text-white text-sm">
                        {fmt(c.total_spent, currency, exchangeRate)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <div className="text-sm text-slate-900 dark:text-white">{c.confirmed_payments}</div>
                      {c.failed_payments > 0 && (
                        <div className="text-xs text-red-400">{c.failed_payments} failed</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell">
                      <span className="text-sm text-slate-600 dark:text-slate-300">
                        {fmt(c.avg_order_value, currency, exchangeRate)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right hidden md:table-cell">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {relativeTime(c.last_seen)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight size={15} className="text-slate-300 dark:text-slate-600 ml-auto" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Page {page} of {totalPages} · {total} total
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail slide-over */}
      {selected && (
        <CustomerDetailPanel
          customer={selected}
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onClose={closeDetail}
          onRetry={retryDetail}
          onExport={() => exportCSV(selected, detail)}
          currency={currency}
          exchangeRate={exchangeRate}
        />
      )}
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function CustomerDetailPanel({
  customer,
  detail,
  loading,
  error,
  onClose,
  onRetry,
  onExport,
  currency,
  exchangeRate,
}: {
  customer: Customer;
  detail: CustomerDetail | null;
  loading: boolean;
  error: boolean;
  onClose: () => void;
  onRetry: () => void;
  onExport: () => void;
  currency: string;
  exchangeRate: number | null;
}) {
  const copy = (text: string) => navigator.clipboard.writeText(text);
  const p = detail?.profile;

  const hasAddress = p && (
    p.billing_address_line1 || p.billing_city || p.billing_country
  );
  const hasShipping = p && (
    p.shipping_address_line1 || p.shipping_city || p.shipping_country
  );

  const modal = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99998]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6">
        <div className="relative bg-white dark:bg-[#1a1128] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal header */}
        <div className="shrink-0 bg-white dark:bg-[#1a1128] border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              {initials(customer)}
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white text-base">
                {customer.name || customer.email}
              </h2>
              {customer.name && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{customer.email}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onExport}
              title="Export as CSV"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            >
              <Download size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 gap-4 text-center px-6">
            <p className="text-sm text-slate-500 dark:text-slate-400">Failed to load customer details.</p>
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* Stats strip */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {fmt(customer.total_spent, currency, exchangeRate)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Lifetime Value</p>
              </div>
              <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {customer.confirmed_payments}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Payments</p>
              </div>
              <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {fmt(customer.avg_order_value, currency, exchangeRate)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Avg Order</p>
              </div>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${TYPE_STYLES[customer.customer_type]}`}>
                {customer.customer_type === 'no_payment' ? 'No confirmed payment' : customer.customer_type + ' customer'}
              </span>
              {customer.has_onramp && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                  Uses Onramp
                </span>
              )}
              {customer.churn_risk && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                  <AlertTriangle size={11} /> At Risk
                </span>
              )}
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                First seen {relativeTime(customer.first_seen)}
              </span>
            </div>

            {/* Contact info */}
            <Section title="Contact Information">
              <Field label="Email">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-900 dark:text-white break-all">{customer.email}</span>
                  <button onClick={() => copy(customer.email)} className="text-slate-400 hover:text-slate-600 shrink-0"><Copy size={13} /></button>
                </div>
              </Field>
              {p?.phone && <Field label="Phone"><span className="text-sm text-slate-900 dark:text-white">{p.phone}</span></Field>}
              {p?.company && <Field label="Company"><span className="text-sm text-slate-900 dark:text-white">{p.company}</span></Field>}
              {p?.ip_address && (
                <Field label="IP Address">
                  <span className="text-sm font-mono text-slate-600 dark:text-slate-300">{p.ip_address}</span>
                </Field>
              )}
            </Section>

            {/* Billing address */}
            {hasAddress && (
              <Section title="Billing Address">
                <div className="text-sm text-slate-700 dark:text-slate-300 space-y-0.5">
                  {p?.billing_address_line1 && <p>{p.billing_address_line1}</p>}
                  {p?.billing_address_line2 && <p>{p.billing_address_line2}</p>}
                  {(p?.billing_city || p?.billing_state) && (
                    <p>{[p?.billing_city, p?.billing_state].filter(Boolean).join(', ')}</p>
                  )}
                  {(p?.billing_postal_code || p?.billing_country) && (
                    <p>{[p?.billing_postal_code, p?.billing_country].filter(Boolean).join(' ')}</p>
                  )}
                </div>
              </Section>
            )}

            {/* Shipping address */}
            {hasShipping && (
              <Section title="Shipping Address">
                <div className="text-sm text-slate-700 dark:text-slate-300 space-y-0.5">
                  {p?.shipping_address_line1 && <p>{p.shipping_address_line1}</p>}
                  {p?.shipping_address_line2 && <p>{p.shipping_address_line2}</p>}
                  {(p?.shipping_city || p?.shipping_state) && (
                    <p>{[p?.shipping_city, p?.shipping_state].filter(Boolean).join(', ')}</p>
                  )}
                  {(p?.shipping_postal_code || p?.shipping_country) && (
                    <p>{[p?.shipping_postal_code, p?.shipping_country].filter(Boolean).join(' ')}</p>
                  )}
                </div>
              </Section>
            )}

            {/* Custom fields */}
            {p?.custom_fields && Object.keys(p.custom_fields).length > 0 && (
              <Section title="Custom Fields">
                <div className="space-y-2">
                  {Object.entries(p.custom_fields).map(([k, v]) => (
                    <Field key={k} label={k}>
                      <span className="text-sm text-slate-900 dark:text-white">{String(v)}</span>
                    </Field>
                  ))}
                </div>
              </Section>
            )}

            {/* Payment pattern chart */}
            {detail && detail.chart.length >= 1 && (
              <Section title="Payment Pattern (last 90 days)">
                <div className="h-[160px] w-full mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={detail.chart} barSize={8}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-slate-700/50" />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94A3B8', fontSize: 9 }}
                        tickFormatter={v => {
                          const d = new Date(v);
                          return `${d.getMonth() + 1}/${d.getDate()}`;
                        }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94A3B8', fontSize: 9 }}
                        tickFormatter={v => fmt(v, currency, exchangeRate)}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1E293B', border: 'none', borderRadius: '8px', fontSize: '12px' }}
                        itemStyle={{ color: '#fff' }}
                        labelStyle={{ color: '#94A3B8' }}
                        formatter={(v: number | undefined) => [fmt(v ?? 0, currency, exchangeRate), 'Volume']}
                        labelFormatter={v => new Date(v).toLocaleDateString()}
                      />
                      <Bar dataKey="volume" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>
            )}

            {/* Payment history */}
            {detail && detail.payments.length > 0 && (
              <Section title={`Payment History (${detail.payments.length})`}>
                <div className="space-y-2 mt-1">
                  {detail.payments.map(pay => (
                    <div key={pay.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {fmt(pay.amount_usd, currency, exchangeRate)}
                          </p>
                          <p className="text-xs text-slate-400">
                            {new Date(pay.created_at).toLocaleDateString()}
                            {pay.is_onramp && <span className="ml-1 text-orange-500">· Onramp</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[pay.status] || STATUS_STYLES.expired}`}>
                          {pay.status}
                        </span>
                        {pay.transaction_signature && (
                          <a
                            href={`https://solscan.io/tx/${pay.transaction_signature}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-slate-400 hover:text-primary transition-colors"
                          >
                            <ExternalLink size={13} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}
        </div>
      </div>
    </>
  );

  return createPortal(modal, document.body);
}

// ── Small primitives ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 w-28">{label}</span>
      <div className="flex-1 min-w-0 text-right">{children}</div>
    </div>
  );
}
