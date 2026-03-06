'use client';

import { useState, useEffect, useRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface KioskCharge {
  charge_id: string;
  status: string;
  amount_ngn: number;
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
  reference: string | null;
  created_at: string;
  confirmed_at: string | null;
  expires_at: string | null;
}

interface KioskResponse {
  has_active_charge: boolean;
  business_name: string;
  charge: KioskCharge | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Kiosk Mode — persistent customer-facing display (second screen / tablet)
// ─────────────────────────────────────────────────────────────────────────────

export default function KioskPage({ params }: { params: { merchantId: string } }) {
  const merchantId = params.merchantId;
  const [data, setData] = useState<KioskResponse | null>(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successAmount, setSuccessAmount] = useState(0);
  const prevChargeRef = useRef<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Poll for active charge
  useEffect(() => {
    const fetchKiosk = async () => {
      try {
        const res = await fetch(`/api/v1/terminal/kiosk/${merchantId}/active`);
        if (!res.ok) {
          setError(true);
          return;
        }
        const json: KioskResponse = await res.json();
        setData(json);

        // Detect completion transition
        if (json.charge && json.charge.status === 'COMPLETED') {
          setSuccessAmount(json.charge.amount_ngn);
          setShowSuccess(true);
          // Auto-clear success after 8 seconds
          setTimeout(() => setShowSuccess(false), 8000);
        }

        // Detect new charge — reset timer
        const currentChargeId = json.charge?.charge_id || null;
        if (currentChargeId && currentChargeId !== prevChargeRef.current) {
          setElapsed(0);
          setShowSuccess(false);
          setCopied(false);
        }
        prevChargeRef.current = currentChargeId;
      } catch {
        // Keep polling through errors
      }
    };

    fetchKiosk();
    pollRef.current = setInterval(fetchKiosk, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [merchantId]);

  // Elapsed timer — only when there's an active pending charge
  useEffect(() => {
    if (!data?.charge || data.charge.status !== 'PENDING' && data.charge.status !== 'PROCESSING') {
      return;
    }
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [data?.charge?.charge_id, data?.charge?.status]);

  const formatElapsed = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const handleCopy = () => {
    if (!data?.charge) return;
    navigator.clipboard.writeText(data.charge.bank_account_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Shell wrapper — full screen, no scroll, centered
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 select-none">
      <div className="w-full max-w-sm">
        {children}
      </div>
      <p className="mt-10 text-[11px] text-slate-300 tracking-wide">
        Powered by <span className="text-slate-400 font-medium">ZendFi</span>
      </p>
    </div>
  );

  // ── Error state ──
  if (error) {
    return (
      <Shell>
        <div className="text-center py-8">
          <div className="w-14 h-14 rounded-full border-2 border-slate-200 flex items-center justify-center mx-auto mb-5">
            <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-500">Terminal not found</p>
        </div>
      </Shell>
    );
  }

  // ── Initial loading ──
  if (!data) {
    return (
      <Shell>
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin" />
        </div>
      </Shell>
    );
  }

  // ── Success flash (payment just completed) ──
  if (showSuccess) {
    return (
      <Shell>
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full border-2 border-emerald-400 flex items-center justify-center mx-auto mb-6">
            <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-2">Payment received</p>
          <h1 className="text-4xl font-light text-slate-900 tracking-tight">
            ₦{successAmount.toLocaleString()}
          </h1>
          <p className="text-sm text-slate-400 mt-3">{data.business_name}</p>
        </div>
      </Shell>
    );
  }

  // ── Idle — no active charge ──
  if (!data.has_active_charge || !data.charge) {
    return (
      <Shell>
        <div className="text-center py-8">
          <p className="text-lg font-medium text-slate-900 mb-1">{data.business_name}</p>
          <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Ready to accept payments</p>
          <div className="mt-8 flex items-center justify-center gap-2">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-xs text-slate-400">Waiting for next charge</span>
          </div>
        </div>
      </Shell>
    );
  }

  // ── Active charge — show bank details ──
  const charge = data.charge;

  return (
    <Shell>
      {/* Merchant + amount */}
      <div className="text-center mb-8">
        <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">{data.business_name}</p>
        <h1 className="text-5xl font-light text-slate-900 tracking-tight">
          <span className="text-slate-300">₦</span>{charge.amount_ngn.toLocaleString()}
        </h1>
        <p className="text-xs text-slate-400 mt-2 uppercase tracking-wider font-medium">Transfer exactly this amount</p>
      </div>

      {/* Bank details card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-4">
        {/* Account number */}
        <div className="text-center mb-6">
          <p className="text-[10px] text-slate-400 uppercase font-medium tracking-[0.15em] mb-2">Account Number</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl font-mono font-semibold tracking-wider text-slate-900">
              {charge.bank_account_number}
            </span>
            <button
              onClick={handleCopy}
              className="p-1.5 text-slate-300 hover:text-slate-500 active:scale-90 transition-all"
              title="Copy"
            >
              {copied ? (
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </div>
          {copied && <p className="text-[11px] text-emerald-500 mt-1">Copied</p>}
        </div>

        {/* Bank & name */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">Bank</span>
            <span className="text-sm text-slate-900 font-medium">{charge.bank_name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">Account Name</span>
            <span className="text-sm text-slate-900 font-medium">{charge.bank_account_name}</span>
          </div>
        </div>
      </div>

      {/* Reference */}
      {charge.reference && (
        <p className="text-center text-xs text-slate-300 mb-4">Ref: {charge.reference}</p>
      )}

      {/* Waiting indicator */}
      <div className="flex items-center justify-center gap-2 py-2">
        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
        <span className="text-xs text-slate-400">Listening for transfer · {formatElapsed(elapsed)}</span>
      </div>
    </Shell>
  );
}
