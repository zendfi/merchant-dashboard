'use client';

import { useState, useEffect, useRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types (public endpoint response shape)
// ─────────────────────────────────────────────────────────────────────────────

interface PublicChargeStatus {
  charge_id: string;
  status: string;
  amount_ngn: number;
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
  merchant_name: string;
  reference: string | null;
  created_at: string;
  confirmed_at: string | null;
  expires_at: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public Display Page — shown to customers (no auth)
// ─────────────────────────────────────────────────────────────────────────────

export default function TerminalDisplayPage({ params }: { params: { chargeId: string } }) {
  const chargeId = params.chargeId;
  const [data, setData] = useState<PublicChargeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch charge status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/v1/terminal/charges/${chargeId}/status`);
        if (!res.ok) {
          setError('Charge not found');
          return;
        }
        const json = await res.json();
        setError(null);
        setData(json);

        if (json.status === 'COMPLETED' || json.status === 'EXPIRED' || json.status === 'FAILED') {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        setError('Failed to load payment details');
      }
    };

    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [chargeId]);

  // Timer
  useEffect(() => {
    if (!data || data.status === 'COMPLETED' || data.status === 'EXPIRED' || data.status === 'FAILED') return;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [data?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatElapsed = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const handleCopy = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.bank_account_number).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Shared shell ──
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
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
          <p className="text-sm font-medium text-slate-500">{error}</p>
        </div>
      </Shell>
    );
  }

  // ── Loading state ──
  if (!data) {
    return (
      <Shell>
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin" />
        </div>
      </Shell>
    );
  }

  // ── COMPLETED state ──
  if (data.status === 'COMPLETED') {
    return (
      <Shell>
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full border-2 border-emerald-400 flex items-center justify-center mx-auto mb-6">
            <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-2">Payment received</p>
          <h1 className="text-4xl font-light text-slate-900 tracking-tight mb-1">
            ₦{data.amount_ngn.toLocaleString()}
          </h1>
          <p className="text-sm text-slate-400 mt-3">{data.merchant_name}</p>
          {data.reference && <p className="text-xs text-slate-300 mt-1">Ref: {data.reference}</p>}
        </div>
      </Shell>
    );
  }

  // ── EXPIRED / FAILED state ──
  if (data.status === 'EXPIRED' || data.status === 'FAILED') {
    return (
      <Shell>
        <div className="text-center py-8">
          <div className="w-14 h-14 rounded-full border-2 border-slate-200 flex items-center justify-center mx-auto mb-5">
            <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">
            {data.status === 'EXPIRED' ? 'Payment expired' : 'Payment failed'}
          </p>
          <p className="text-xs text-slate-400">Ask the merchant to generate a new charge.</p>
        </div>
      </Shell>
    );
  }

  // ── PENDING / PROCESSING — show bank details ──
  return (
    <Shell>
      {/* Merchant + amount */}
      <div className="text-center mb-8">
        <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">{data.merchant_name}</p>
        <h1 className="text-5xl font-light text-slate-900 tracking-tight">
          <span className="text-slate-300">₦</span>{data.amount_ngn.toLocaleString()}
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
              {data.bank_account_number}
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
            <span className="text-sm text-slate-900 font-medium">{data.bank_name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">Account Name</span>
            <span className="text-sm text-slate-900 font-medium">{data.bank_account_name}</span>
          </div>
        </div>
      </div>

      {/* Reference */}
      {data.reference && (
        <p className="text-center text-xs text-slate-300 mb-4">Ref: {data.reference}</p>
      )}

      {/* Waiting indicator */}
      <div className="flex items-center justify-center gap-2 py-2">
        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
        <span className="text-xs text-slate-400">Listening for transfer · {formatElapsed(elapsed)}</span>
      </div>
    </Shell>
  );
}
