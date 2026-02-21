'use client';

import { useEffect, useState, useCallback } from 'react';
import { paymentLinks as paymentLinksApi, PaymentLink, PaymentLinkPayment, PaymentLinkDailyCount } from '@/lib/api';
import { X, Copy, ExternalLink, CheckCircle, Clock, TrendingUp, Link } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface PaymentLinkDetailModalProps {
  link: PaymentLink | null;
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  failed: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  expired: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

export default function PaymentLinkDetailModal({ link, isOpen, onClose }: PaymentLinkDetailModalProps) {
  const [payments, setPayments] = useState<PaymentLinkPayment[]>([]);
  const [dailyCounts, setDailyCounts] = useState<PaymentLinkDailyCount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    if (!link) return;
    setIsLoading(true);
    try {
      const data = await paymentLinksApi.getLinkTransactions(link.link_code);
      setPayments(data.payments);
      setDailyCounts(data.daily_counts);
    } catch (err) {
      console.error('Failed to load link transactions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [link]);

  useEffect(() => {
    if (isOpen && link) {
      loadTransactions();
    } else {
      setPayments([]);
      setDailyCounts([]);
    }
  }, [isOpen, link, loadTransactions]);

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // fallback
    }
  };

  if (!isOpen || !link) return null;

  const confirmedCount = payments.filter(p => p.status === 'confirmed').length;
  const pendingCount = payments.filter(p => p.status === 'pending').length;
  const totalVolume = payments
    .filter(p => p.status === 'confirmed')
    .reduce((sum, p) => sum + p.amount_usd, 0);

  const chartData = dailyCounts.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    uses: d.count,
    confirmed: d.confirmed,
  }));

  const isExpired = link.expires_at && new Date(link.expires_at) < new Date();
  const isActive = link.is_active && !isExpired;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-[#1f162b] rounded-2xl shadow-2xl border border-slate-200/50 dark:border-white/10 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0">
              <Link size={18} className="text-primary dark:text-purple-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-900 dark:text-white font-mono">{link.link_code}</h2>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  isActive
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  {isActive ? 'Active' : isExpired ? 'Expired' : 'Inactive'}
                </span>
                {link.onramp && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    Bank Pay
                  </span>
                )}
                {link.payer_service_charge && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    +Fee
                  </span>
                )}
              </div>
              {link.description && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate">{link.description}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors shrink-0 ml-2"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Amount + stats */}
          <div className="px-6 py-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 dark:bg-white/[0.03] rounded-xl p-3.5">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Amount</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                ${link.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{link.token}</p>
            </div>
            <div className="bg-slate-50 dark:bg-white/[0.03] rounded-xl p-3.5">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Uses</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {link.uses_count}
                {link.max_uses != null && (
                  <span className="text-sm font-normal text-slate-400"> / {link.max_uses}</span>
                )}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{link.max_uses == null ? 'unlimited' : 'limit'}</p>
            </div>
            <div className="bg-slate-50 dark:bg-white/[0.03] rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle size={12} className="text-emerald-500" />
                <p className="text-xs text-slate-500 dark:text-slate-400">Confirmed</p>
              </div>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{confirmedCount}</p>
              <p className="text-xs text-slate-400 mt-0.5">payments</p>
            </div>
            <div className="bg-slate-50 dark:bg-white/[0.03] rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp size={12} className="text-primary" />
                <p className="text-xs text-slate-500 dark:text-slate-400">Volume</p>
              </div>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                ${totalVolume.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">confirmed</p>
            </div>
          </div>

          {/* URLs */}
          <div className="px-6 space-y-2 pb-4">
            {[
              { label: 'Checkout URL', value: link.hosted_page_url, field: 'checkout' },
              { label: 'Payment API URL', value: link.payment_url, field: 'api' },
            ].map(({ label, value, field }) => (
              <div key={field} className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-white/[0.03] rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                  <p className="text-xs font-mono text-slate-700 dark:text-slate-300 truncate">{value}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => copyToClipboard(value, field)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                    title="Copy"
                  >
                    {copiedField === field ? <CheckCircle size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                  <a
                    href={value}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                    title="Open"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="px-6 pb-5">
            <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800 p-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Usage (last 90 days)</h3>
              {isLoading ? (
                <div className="h-40 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : chartData.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-sm text-slate-400">
                  No usage data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradUses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradConfirmed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: 'rgba(148,163,184,0.8)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: 'rgba(148,163,184,0.8)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(30,20,45,0.95)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#e2e8f0',
                      }}
                    />
                    <Area type="monotone" dataKey="uses" stroke="#8b5cf6" strokeWidth={2} fill="url(#gradUses)" name="Uses" />
                    <Area type="monotone" dataKey="confirmed" stroke="#10b981" strokeWidth={2} fill="url(#gradConfirmed)" name="Confirmed" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Payments list */}
          <div className="px-6 pb-6">
            <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Payment IDs
                  <span className="ml-2 text-xs font-normal text-slate-400">({payments.length})</span>
                </h3>
                {pendingCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-amber-500">
                    <Clock size={11} />
                    {pendingCount} pending
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-50 dark:border-slate-800/50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">ID</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide hidden sm:table-cell">Customer</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">Amount</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50">
                          <td className="px-4 py-3"><div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" /></td>
                          <td className="px-4 py-3 hidden sm:table-cell"><div className="h-3 w-28 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" /></td>
                          <td className="px-4 py-3"><div className="h-3 w-14 bg-slate-100 dark:bg-slate-800 rounded animate-pulse ml-auto" /></td>
                          <td className="px-4 py-3"><div className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" /></td>
                          <td className="px-4 py-3 hidden md:table-cell"><div className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse ml-auto" /></td>
                        </tr>
                      ))
                    ) : payments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                          No payments yet for this link
                        </td>
                      </tr>
                    ) : (
                      payments.map(p => (
                        <tr key={p.id} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs text-amber-500 dark:text-amber-400">{p.id.slice(0, 8)}</span>
                              <button
                                onClick={() => copyToClipboard(p.id, `pay-${p.id}`)}
                                className="text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 transition-colors"
                              >
                                {copiedField === `pay-${p.id}` ? <CheckCircle size={11} className="text-emerald-500" /> : <Copy size={11} />}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            {p.customer_email ? (
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{p.customer_name || 'Customer'}</p>
                                <p className="text-xs text-slate-400 truncate">{p.customer_email}</p>
                              </div>
                            ) : p.customer_wallet ? (
                              <span className="text-xs font-mono text-slate-400">
                                {p.customer_wallet.slice(0, 6)}…{p.customer_wallet.slice(-4)}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">Anonymous</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-xs font-semibold text-slate-900 dark:text-white">
                              ${p.amount_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[p.status ?? 'expired'] ?? STATUS_STYLES.expired}`}>
                              {p.status ?? 'unknown'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right hidden md:table-cell">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Meta */}
          <div className="px-6 pb-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-slate-500 dark:text-slate-400">
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300 mb-0.5">Created</p>
                <p>{new Date(link.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
              </div>
              {link.expires_at && (
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-300 mb-0.5">Expires</p>
                  <p className={isExpired ? 'text-rose-500' : ''}>
                    {new Date(link.expires_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                </div>
              )}
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300 mb-0.5">Service Charge</p>
                <p>{link.payer_service_charge ? 'Payer pays fee' : 'Merchant absorbs'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
