"use client";

import { useEffect, useState, useCallback } from "react";
import React from "react";
import { useMode } from "@/lib/mode-context";
import { invoices as invoicesApi, Invoice } from "@/lib/api";
import {
  Plus,
  RefreshCw,
  Send,
  Copy,
  ExternalLink,
  CheckCircle,
  FileText,
  Clock,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  Banknote,
  Search,
} from "lucide-react";
import CreateInvoiceModal from "../CreateInvoiceModal";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(amount: number, token = "USDC") {
  return `${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${token}`;
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isOverdue(inv: Invoice) {
  return (
    inv.status === "sent" && inv.due_date && new Date(inv.due_date) < new Date()
  );
}

type DisplayStatus = Invoice["status"] | "overdue";

function effectiveStatus(inv: Invoice): DisplayStatus {
  if (inv.status === "sent" && isOverdue(inv)) return "overdue";
  return inv.status;
}

const STATUS_META: Record<
  DisplayStatus,
  { label: string; dot: string; pill: string }
> = {
  draft: {
    label: "Draft",
    dot: "bg-slate-400",
    pill: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
  sent: {
    label: "Sent",
    dot: "bg-blue-500",
    pill: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  },
  paid: {
    label: "Paid",
    dot: "bg-emerald-500",
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  },
  overdue: {
    label: "Overdue",
    dot: "bg-red-500",
    pill: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  },
  cancelled: {
    label: "Cancelled",
    dot: "bg-slate-300 dark:bg-slate-600",
    pill: "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500",
  },
};

function StatusBadge({ inv }: { inv: Invoice }) {
  const s = effectiveStatus(inv);
  const m = STATUS_META[s];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${m.pill}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/5 p-4 flex items-center gap-4">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
          {value}
        </p>
      </div>
    </div>
  );
}

// ── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100 dark:border-white/5 animate-pulse">
      {[40, 140, 120, 80, 80, 90].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div
            className="h-4 bg-slate-200 dark:bg-slate-700 rounded"
            style={{ width: w }}
          />
        </td>
      ))}
    </tr>
  );
}

// ── Detail panel (expanded row) ───────────────────────────────────────────────

function DetailPanel({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const totalLineItems = inv.line_items.reduce(
    (s, i) => s + i.quantity * i.unit_price,
    0
  );

  return (
    <div className="bg-slate-50 dark:bg-white/[0.03] border-t border-b border-slate-200 dark:border-white/5 px-6 py-5">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Invoice detail —{" "}
          <span className="font-mono text-primary">{inv.invoice_number}</span>
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
            Customer
          </p>
          <p className="font-medium text-slate-900 dark:text-white">
            {inv.customer_name || "—"}
          </p>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            {inv.customer_email}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
            Amount
          </p>
          <p className="font-semibold text-slate-900 dark:text-white">
            {fmt(inv.amount_usd, inv.token)}
          </p>
          {inv.amount_ngn && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              ≈ ₦{inv.amount_ngn.toLocaleString()}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
            Due
          </p>
          <p className="font-medium text-slate-900 dark:text-white">
            {fmtDate(inv.due_date)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
            Sent
          </p>
          <p className="font-medium text-slate-900 dark:text-white">
            {fmtDate(inv.sent_at)}
          </p>
        </div>
      </div>

      {inv.line_items.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            Line items
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10">
                <th className="text-left py-1.5 text-xs font-medium text-slate-400 pr-4">
                  Item
                </th>
                <th className="text-right py-1.5 text-xs font-medium text-slate-400 pr-4">
                  Qty
                </th>
                <th className="text-right py-1.5 text-xs font-medium text-slate-400 pr-4">
                  Unit price
                </th>
                <th className="text-right py-1.5 text-xs font-medium text-slate-400">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {inv.line_items.map((li, idx) => (
                <tr
                  key={idx}
                  className="border-b border-slate-100 dark:border-white/5"
                >
                  <td className="py-1.5 text-slate-700 dark:text-slate-300 pr-4">
                    {li.description}
                  </td>
                  <td className="py-1.5 text-right text-slate-500 dark:text-slate-400 pr-4">
                    {li.quantity}
                  </td>
                  <td className="py-1.5 text-right text-slate-500 dark:text-slate-400 pr-4">
                    ${li.unit_price.toFixed(2)}
                  </td>
                  <td className="py-1.5 text-right font-medium text-slate-700 dark:text-slate-300">
                    ${(li.quantity * li.unit_price).toFixed(2)}
                  </td>
                </tr>
              ))}
              <tr>
                <td
                  colSpan={3}
                  className="pt-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 pr-4"
                >
                  Total
                </td>
                <td className="pt-2 text-right font-bold text-slate-900 dark:text-white">
                  ${totalLineItems.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {inv.onramp && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 text-xs font-medium">
            <Banknote className="w-3.5 h-3.5" /> Bank transfer (onramp)
          </span>
        )}
        {inv.payer_service_charge && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium">
            Service charge (payer)
          </span>
        )}
        {inv.payment_url && (
          <a
            href={inv.payment_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-200 dark:hover:bg-white/15 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open payment link
          </a>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Filter = "all" | "draft" | "sent" | "paid" | "overdue";

export default function InvoicesTab() {
  const { mode } = useMode();
  const [items, setItems] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentOk, setSentOk] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await invoicesApi.list();
      setItems(data);
    } catch (e) {
      console.error("Failed to load invoices:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, mode]);

  const handleSend = async (inv: Invoice) => {
    setSendingId(inv.id);
    try {
      await invoicesApi.send(inv.id, mode);
      setSentOk(inv.id);
      setTimeout(() => setSentOk(null), 3000);
      load();
    } catch (e) {
      console.error("Failed to send invoice:", e);
    } finally {
      setSendingId(null);
    }
  };

  const handleCopy = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyOk(id);
      setTimeout(() => setCopyOk(null), 2000);
    } catch {
      /* ignore */
    }
  };

  // ── Derived data ─────────────────────────────────────────────────────────

  const totalPaid = items.filter((i) => i.status === "paid").length;
  const totalPending = items.filter(
    (i) => ["draft", "sent"].includes(i.status) || isOverdue(i)
  ).length;

  const filtered = items.filter((inv) => {
    const es = effectiveStatus(inv);
    if (filter !== "all" && es !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        inv.invoice_number.toLowerCase().includes(q) ||
        inv.customer_email.toLowerCase().includes(q) ||
        (inv.customer_name?.toLowerCase().includes(q) ?? false) ||
        inv.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "draft", label: "Draft" },
    { id: "sent", label: "Sent" },
    { id: "paid", label: "Paid" },
    { id: "overdue", label: "Overdue" },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Invoices
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Create, send, and track professional invoices
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Invoice
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-white dark:bg-[#13131f] rounded-lg border border-slate-200 dark:border-slate-800 p-3 sm:p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <FileText size={13} className="text-slate-600 dark:text-slate-400 shrink-0" />
            <span className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">Total</span>
          </div>
          <p className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">{items.length}</p>
        </div>
        <div className="bg-white dark:bg-[#13131f] rounded-lg border border-slate-200 dark:border-slate-800 p-3 sm:p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Clock size={13} className="text-slate-600 dark:text-slate-400 shrink-0" />
            <span className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">Pending</span>
          </div>
          <p className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">{totalPending}</p>
        </div>
        <div className="bg-white dark:bg-[#13131f] rounded-lg border border-slate-200 dark:border-slate-800 p-3 sm:p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <CheckCircle size={13} className="text-slate-600 dark:text-slate-400 shrink-0" />
            <span className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">Paid</span>
          </div>
          <p className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">{totalPaid}</p>
        </div>
      </div>

      {/* Filter pills — horizontally scrollable on mobile */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.id
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                : 'bg-white dark:bg-[#13131f] border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

        {/* Search */}
        <div className="relative sm:ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search invoices…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 w-full sm:w-56"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#13131f] rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">

        {/* ── Mobile card list (< sm) ── */}
        <div className="sm:hidden">
          {isLoading ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-3.5 space-y-2">
                  <div className="flex justify-between">
                    <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                    <div className="h-4 w-14 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                  </div>
                  <div className="flex justify-between">
                    <div className="h-5 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                    <div className="h-3 w-12 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
              {search || filter !== "all" ? "No invoices match your filters" : "No invoices yet"}
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((inv) => {
                const isExpanded = expandedId === inv.id;
                const es = effectiveStatus(inv);
                const canSend = es === "draft" || es === "overdue";

                return (
                  <div
                    key={inv.id}
                    onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                    className="p-3.5 cursor-pointer active:bg-slate-50 dark:active:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <p className="font-mono text-xs font-semibold text-primary dark:text-purple-300">{inv.invoice_number}</p>
                          {inv.onramp && <Banknote size={13} className="text-violet-500" />}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                          {inv.customer_name || inv.customer_email}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-slate-900 dark:text-white text-sm">${inv.amount_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                        <p className="text-[11px] text-slate-400">{inv.token}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 gap-2">
                      {sentOk === inv.id ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          <CheckCircle size={12} /> Sent
                        </span>
                      ) : (
                        <StatusBadge inv={inv} />
                      )}
                      <span className="text-[11px] text-slate-400">{fmtDate(inv.due_date)}</span>
                    </div>
                    {isExpanded && <DetailPanel inv={inv} onClose={() => setExpandedId(null)} />}
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
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="px-4 py-3 text-left">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Invoice</span>
                </th>
                <th className="px-4 py-3 text-left">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Customer</span>
                </th>
                <th className="px-4 py-3 text-right">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Amount</span>
                </th>
                <th className="px-4 py-3 text-left">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</span>
                </th>
                <th className="px-4 py-3 text-left">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Due</span>
                </th>
                <th className="px-4 py-3 text-center">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3">
                      <div className="space-y-1.5">
                        <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                        <div className="h-2.5 w-32 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                      </div>
                    </td>
                    <td className="px-4 py-3"><div className="h-3 w-32 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse ml-auto" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-10 bg-slate-100 dark:bg-slate-800 rounded animate-pulse mx-auto" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
                    {search || filter !== "all" ? "No invoices match your filters" : "No invoices yet"}
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => {
                  const isExpanded = expandedId === inv.id;
                  const es = effectiveStatus(inv);
                  const canSend = es === "draft" || es === "overdue";

                  return (
                    <React.Fragment key={inv.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                        className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors last:border-0"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <p className="font-mono text-xs font-semibold text-primary dark:text-purple-300">{inv.invoice_number}</p>
                            {inv.onramp && (
                              <span title="Onramp enabled">
                                <Banknote size={13} className="text-violet-500" />
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900 dark:text-white text-sm">{inv.customer_name || inv.customer_email}</p>
                          {inv.customer_name && (
                            <p className="text-xs text-slate-400 mt-0.5">{inv.customer_email}</p>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <span className="font-semibold text-slate-900 dark:text-white text-sm">
                            ${inv.amount_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                          <p className="text-xs text-slate-400 mt-0.5">{inv.token}</p>
                        </td>

                        <td className="px-4 py-3">
                          {sentOk === inv.id ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              <CheckCircle size={12} /> Sent
                            </span>
                          ) : (
                            <StatusBadge inv={inv} />
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {fmtDate(inv.due_date)}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div
                            className="flex items-center justify-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {canSend && (
                              <button
                                onClick={() => handleSend(inv)}
                                disabled={sendingId === inv.id}
                                title="Send invoice"
                                className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors disabled:opacity-60"
                              >
                                {sendingId === inv.id ? (
                                  <RefreshCw size={14} className="animate-spin" />
                                ) : (
                                  <Send size={14} />
                                )}
                              </button>
                            )}
                            {inv.payment_url && (
                              <a
                                href={inv.payment_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open payment link"
                                className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                              >
                                <ExternalLink size={14} />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-slate-100 dark:border-slate-800">
                          <td colSpan={6} className="p-0">
                            <DetailPanel inv={inv} onClose={() => setExpandedId(null)} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Overdue warning banner */}
      {!isLoading && items.some((i) => effectiveStatus(i) === "overdue") && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-sm text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>
            You have{" "}
            <strong>
              {items.filter((i) => effectiveStatus(i) === "overdue").length}
            </strong>{" "}
            overdue invoice(s). Re-send them to remind your customers.
          </span>
        </div>
      )}

      <CreateInvoiceModal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          load();
        }}
        mode={mode}
      />
    </div>
  );
}
