'use client';

import { useEffect, useState, useCallback } from 'react';
import { useMode } from '@/lib/mode-context';
import { paymentLinks as paymentLinksApi, PaymentLink } from '@/lib/api';
import PaymentLinkDetailModal from '../PaymentLinkDetailModal';
import CreatePaymentLinkModal from '../CreatePaymentLinkModal';
import { Copy, ExternalLink, CheckCircle, Plus, Link, TrendingUp, RefreshCw } from 'lucide-react';

interface PaymentLinksTabProps {
  onModalToggle?: (open: boolean) => void;
}

export default function PaymentLinksTab({ onModalToggle }: PaymentLinksTabProps = {}) {
  const { mode } = useMode();
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLink, setSelectedLink] = useState<PaymentLink | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

  const loadLinks = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await paymentLinksApi.listSession();
      setLinks(data);
    } catch (err) {
      console.error('Failed to load payment links:', err);
      setLinks([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLinks();
  }, [mode, loadLinks]);

  const copyToClipboard = async (text: string, code: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleRowClick = (link: PaymentLink) => {
    setSelectedLink(link);
    setIsDetailOpen(true);
  };

  const handleCreateClose = () => {
    setIsCreateOpen(false);
    loadLinks(); // Refresh after creation
  };


  const now = new Date();
  const filteredLinks = links.filter(link => {
    const isExpired = link.expires_at && new Date(link.expires_at) < now;
    const isActive = link.is_active && !isExpired;
    if (filterActive === 'active') return isActive;
    if (filterActive === 'inactive') return !isActive;
    return true;
  });

  const totalActive = links.filter(l => l.is_active && (!l.expires_at || new Date(l.expires_at) > now)).length;
  const totalUses = links.reduce((s, l) => s + l.uses_count, 0);
  const onrampCount = links.filter(l => l.onramp).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Payment Links</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {links.length} link{links.length !== 1 ? 's' : ''} in {mode} mode
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadLinks()}
            title="Refresh"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
          >
            <Plus size={15} /> New Link
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800 p-3 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Link size={13} className="text-primary shrink-0" />
            <span className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">Active</span>
          </div>
          <p className="text-base sm:text-xl font-bold text-slate-900 dark:text-white">{totalActive}</p>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 hidden sm:block">of {links.length} total</p>
        </div>
        <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800 p-3 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={13} className="text-emerald-500 shrink-0" />
            <span className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">Uses</span>
          </div>
          <p className="text-base sm:text-xl font-bold text-slate-900 dark:text-white">{totalUses.toLocaleString()}</p>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 hidden sm:block">all time</p>
        </div>
        <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800 p-3 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm leading-none shrink-0">🏦</span>
            <span className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">Bank</span>
          </div>
          <p className="text-base sm:text-xl font-bold text-slate-900 dark:text-white">{onrampCount}</p>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 hidden sm:block">onramp enabled</p>
        </div>
      </div>

      {/* Filter pills — horizontally scrollable on mobile */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
        {(['all', 'active', 'inactive'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilterActive(f)}
            className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterActive === f
                ? 'bg-primary text-white'
                : 'bg-white dark:bg-[#1f162b] border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">

        {/* ── Mobile card list (< sm) ── */}
        <div className="sm:hidden">
          {isLoading ? (
            <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-3.5 space-y-2">
                  <div className="flex justify-between">
                    <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                    <div className="h-4 w-14 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                  </div>
                  <div className="flex justify-between">
                    <div className="h-5 w-16 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse" />
                    <div className="h-3 w-12 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredLinks.length === 0 ? (
            <p className="py-16 text-center text-slate-400 dark:text-slate-500 text-sm">
              {links.length === 0 ? 'No payment links yet. Create one to start accepting payments!' : 'No links match the current filter.'}
            </p>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {filteredLinks.map(link => {
                const isExpired = link.expires_at && new Date(link.expires_at) < now;
                const isActive = link.is_active && !isExpired;
                return (
                  <div
                    key={link.link_code}
                    onClick={() => handleRowClick(link)}
                    className="p-3.5 cursor-pointer active:bg-slate-50 dark:active:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs font-semibold text-primary dark:text-purple-300">{link.link_code}</p>
                        {link.description && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate">{link.description}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-slate-900 dark:text-white text-sm">${link.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                        <p className="text-[11px] text-slate-400">{link.token}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        isActive
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : isExpired
                            ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            : 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
                      }`}>
                        {isActive ? 'Active' : isExpired ? 'Expired' : 'Inactive'}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>{link.uses_count} uses</span>
                        <div
                          className="flex items-center gap-1"
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            onClick={() => copyToClipboard(link.hosted_page_url, link.link_code)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                          >
                            {copiedCode === link.link_code
                              ? <CheckCircle size={14} className="text-emerald-500" />
                              : <Copy size={14} />}
                          </button>
                          <a
                            href={link.hosted_page_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                          >
                            <ExternalLink size={14} />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Desktop table (sm+) ── */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3 text-left">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Link</span>
                </th>
                <th className="px-4 py-3 text-right">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Amount</span>
                </th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Type</span>
                </th>
                <th className="px-4 py-3 text-center">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Uses</span>
                </th>
                <th className="px-4 py-3 text-left">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</span>
                </th>
                <th className="px-4 py-3 text-right hidden md:table-cell">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Created</span>
                </th>
                <th className="px-4 py-3 text-center">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50">
                    <td className="px-4 py-3">
                      <div className="space-y-1.5">
                        <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                        <div className="h-2.5 w-36 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                      </div>
                    </td>
                    <td className="px-4 py-3"><div className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse ml-auto" /></td>
                    <td className="px-4 py-3 hidden sm:table-cell"><div className="h-5 w-14 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-10 bg-slate-100 dark:bg-slate-800 rounded animate-pulse mx-auto" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-14 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" /></td>
                    <td className="px-4 py-3 hidden md:table-cell"><div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded animate-pulse ml-auto" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-10 bg-slate-100 dark:bg-slate-800 rounded animate-pulse mx-auto" /></td>
                  </tr>
                ))
              ) : filteredLinks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-slate-400 dark:text-slate-500 text-sm">
                    {links.length === 0
                      ? 'No payment links yet. Create one to start accepting payments!'
                      : 'No links match the current filter.'}
                  </td>
                </tr>
              ) : (
                filteredLinks.map(link => {
                  const isExpired = link.expires_at && new Date(link.expires_at) < now;
                  const isActive = link.is_active && !isExpired;
                  const usagePct = link.max_uses ? Math.min(100, (link.uses_count / link.max_uses) * 100) : null;

                  return (
                    <tr
                      key={link.link_code}
                      onClick={() => handleRowClick(link)}
                      className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors last:border-0"
                    >
                      {/* Link code + description */}
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-semibold text-primary dark:text-purple-300">{link.link_code}</p>
                        {link.description && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[160px]">{link.description}</p>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-slate-900 dark:text-white text-sm">
                          ${link.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                        <p className="text-xs text-slate-400">{link.token}</p>
                      </td>

                      {/* Type badges */}
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="flex flex-col gap-1">
                          {link.onramp && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 w-fit">
                              Bank Pay
                            </span>
                          )}
                          {link.payer_service_charge && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 w-fit">
                              +Fee
                            </span>
                          )}
                          {!link.onramp && !link.payer_service_charge && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 w-fit">
                              Crypto
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Uses */}
                      <td className="px-4 py-3 text-center">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {link.uses_count}
                          {link.max_uses != null && (
                            <span className="text-xs font-normal text-slate-400"> / {link.max_uses}</span>
                          )}
                        </p>
                        {usagePct !== null && (
                          <div className="w-12 h-1 bg-slate-100 dark:bg-slate-800 rounded-full mx-auto mt-1 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${usagePct >= 90 ? 'bg-rose-500' : 'bg-primary'}`}
                              style={{ width: `${usagePct}%` }}
                            />
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : isExpired
                              ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                              : 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
                        }`}>
                          {isActive ? 'Active' : isExpired ? 'Expired' : 'Inactive'}
                        </span>
                      </td>

                      {/* Created */}
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(link.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </td>

                      {/* Actions — stop propagation to prevent row click */}
                      <td className="px-4 py-3">
                        <div
                          className="flex items-center justify-center gap-1"
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            onClick={() => copyToClipboard(link.hosted_page_url, link.link_code)}
                            title="Copy checkout URL"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                          >
                            {copiedCode === link.link_code
                              ? <CheckCircle size={14} className="text-emerald-500" />
                              : <Copy size={14} />}
                          </button>
                          <a
                            href={link.hosted_page_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open checkout page"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                          >
                            <ExternalLink size={14} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <PaymentLinkDetailModal
        link={selectedLink}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedLink(null);
        }}
      />

      {/* Create Modal */}
      <CreatePaymentLinkModal
        isOpen={isCreateOpen}
        onClose={handleCreateClose}
        mode={mode}
        onCreated={loadLinks}
      />
    </div>
  );
}
